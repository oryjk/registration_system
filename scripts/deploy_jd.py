#!/usr/bin/env python3
"""Publish the registration system: Go backend to peiqian, H5/admin static files to jd.

--check performs read-only preflight on both hosts.

Topology (2026-11-04): the public entry stays on jd (`https://oryjk.cn:82`). jd's nginx proxies
`/regist-v3/` over WireGuard to the Go backend on peiqian (10.8.10.2:18081), which runs next to
PostgreSQL. The backend reaches jd's private MinIO through the WireGuard-only bridge 10.8.10.1:19000.
"""
import argparse
import datetime
import io
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import subprocess
import sys
import tarfile
import time
import urllib.request
import uuid

WEB_BASE = Path('/root/docker_data/registration-go-v3')  # jd: MinIO, :82 forwarder, frontend releases
GO_BASE = Path('/data/registration-go-v3')  # peiqian: Go backend compose, env, uploads, releases
HTML = Path('/root/docker_data/nginx/html')
NGINX_CONF = Path('/root/docker_data/nginx/conf/nginx.conf')
ORIGIN = 'https://oryjk.cn:82'
GO_UPSTREAM = 'upstream registration_go_backend { server 10.8.10.2:18081;'
MINIO_OVER_WIREGUARD = 'http://10.8.10.1:19000'


def command(*args, **kwargs):
    return subprocess.run([str(a) for a in args], check=True, **kwargs)


def with_image(text, image):
    if not re.fullmatch(r'[a-zA-Z0-9_./:@-]+', image):
        raise ValueError('Invalid Docker image reference')
    pattern = r'(?m)(^  backend:\n(?:(?!^  \S)[^\n]*\n)*?    image: )[^\n]+'
    updated, count = re.subn(pattern, lambda m: m[1] + image, text)
    if count != 1:
        raise ValueError('Expected exactly one backend image in compose.yaml; no changes made')
    return updated


def healthy():
    for _ in range(20):
        try:
            with urllib.request.urlopen('http://127.0.0.1:18081/health', timeout=3) as response:
                if json.load(response).get('data', {}).get('status') == 'ok':
                    return True
        except (OSError, ValueError):
            pass
        time.sleep(2)
    return False


def activate_backend(base, image):
    # jd nginx targets the fixed WireGuard address, so replacing the container needs no nginx reload.
    compose = base / 'compose.yaml'
    before = compose.read_text()
    after = with_image(before, image)
    backup = base / ('compose.before-' + uuid.uuid4().hex + '.yaml')
    backup.write_text(before)
    args = ('docker', 'compose', '-f', compose, 'up', '-d', '--no-deps', 'backend')
    try:
        compose.write_text(after)
        command(*args)
        if not healthy():
            raise RuntimeError('New backend health check failed')
    except Exception:
        compose.write_text(before)
        command(*args)
        if not healthy():
            raise RuntimeError('Backend rollback health check failed; inspect peiqian locally') from None
        raise RuntimeError('Deployment failed; previous backend image restored. Database changes are not rolled back.') from None


def publish_static(source, destination, backup):
    if not (source / 'index.html').is_file():
        raise ValueError('Missing staged static index.html')
    # Copy into the destination filesystem before exchanging directory names.
    stage = destination.with_name(destination.name + '.new-' + uuid.uuid4().hex)
    shutil.copytree(source, stage)
    existed = destination.exists()
    try:
        if existed:
            backup.parent.mkdir(parents=True, exist_ok=True)
            destination.rename(backup)
        stage.rename(destination)
    except Exception:
        if existed and backup.exists() and not destination.exists():
            backup.rename(destination)
        shutil.rmtree(stage, ignore_errors=True)
        raise


def read_env(path):
    return dict(line.split('=', 1) for line in path.read_text().splitlines()
                if '=' in line and not line.startswith('#'))


def preflight_go():
    for name in ['compose.yaml', 'backend.env']:
        if not (GO_BASE / name).is_file():
            raise RuntimeError('Missing peiqian backend deployment file: ' + name)
    with_image((GO_BASE / 'compose.yaml').read_text(), 'registration:preflight')
    # Inspect only required keys; never print env values or resolved compose config.
    env = read_env(GO_BASE / 'backend.env')
    for key in ['DATABASE_URL', 'JWT_SECRET', 'PUBLIC_BASE_URL', 'UPLOAD_MINIO_ENDPOINT']:
        if not env.get(key):
            raise RuntimeError('backend.env missing ' + key)
    if env['UPLOAD_MINIO_ENDPOINT'] != MINIO_OVER_WIREGUARD:
        raise RuntimeError('Storage must use jd private MinIO over WireGuard; inspect backend.env')
    command('docker', 'compose', '-f', GO_BASE / 'compose.yaml', 'config', '-q')
    with urllib.request.urlopen(MINIO_OVER_WIREGUARD + '/minio/health/live', timeout=5):
        pass
    print('peiqian preflight passed: Compose, environment keys and MinIO over WireGuard.', flush=True)


def preflight_web():
    for name in ['compose.yaml', 'minio.env', 'nginx82.conf', 'minio-wg.conf']:
        if not (WEB_BASE / name).is_file():
            raise RuntimeError('Missing existing jd deployment file: ' + name)
    command('docker', 'compose', '-f', WEB_BASE / 'compose.yaml', 'config', '-q')
    for container in ['nginx-server', 'registration-minio', 'registration-https82', 'registration-minio-wg']:
        data = json.loads(command('docker', 'inspect', container, stdout=subprocess.PIPE).stdout)[0]
        if not data['State']['Running'] or 'registration-v3' not in data['NetworkSettings']['Networks']:
            raise RuntimeError(container + ' must be running on registration-v3')
    if GO_UPSTREAM not in NGINX_CONF.read_text():
        raise RuntimeError('jd nginx must proxy /regist-v3/ to peiqian over WireGuard; inspect nginx.conf')
    command('docker', 'exec', 'nginx-server', 'nginx', '-t')
    print('jd preflight passed: MinIO, WireGuard bridge, private network and nginx.', flush=True)


def remote_go(args):
    preflight_go()
    if args.check:
        return
    import fcntl
    with (GO_BASE / '.deploy.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        release = Path(args.release)
        if release.parent != GO_BASE / 'releases':
            raise ValueError('Unexpected release directory')
        source = release / 'registration_system_go'
        image = 'registration-system-backend-go-v3:' + release.name
        dockerfile = release / 'Dockerfile.runtime'
        dockerfile.write_text(
            'FROM debian:bookworm-slim\n'
            'RUN useradd --system --uid 10001 --create-home app\n'
            'WORKDIR /app\n'
            'COPY ca-certificates.crt /etc/ssl/certs/ca-certificates.crt\n'
            'COPY zoneinfo /usr/share/zoneinfo\n'
            'COPY registration-system-go-api /app/registration-system-go-api\n'
            'RUN mkdir -p /app/uploads && chown -R app:app /app\n'
            'USER app\n'
            'EXPOSE 18081\n'
            'ENTRYPOINT ["/app/registration-system-go-api"]\n'
        )
        shutil.copy2('/etc/ssl/certs/ca-certificates.crt', release / 'ca-certificates.crt')
        if (release / 'zoneinfo').exists():
            shutil.rmtree(release / 'zoneinfo')
        shutil.copytree('/usr/share/zoneinfo', release / 'zoneinfo')
        command('docker', 'build', '-f', dockerfile, '-t', image, release)
        if args.migrate:
            env = read_env(GO_BASE / 'backend.env')
            db_url = env['DATABASE_URL'].replace('@host.docker.internal:', '@127.0.0.1:')
            migrate_env = dict(os.environ, **env, DATABASE_URL=db_url)
            command(release / 'dbmigrate', cwd=source, env=migrate_env)
        activate_backend(GO_BASE, image)
        print('peiqian backend activated: ' + release.name)


def remote_web(args):
    preflight_web()
    if args.check:
        return
    import fcntl
    with (WEB_BASE / '.deploy.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        release = Path(args.release)
        if release.parent != WEB_BASE / 'releases':
            raise ValueError('Unexpected release directory')
        for name, skip in [('mini-v3', args.skip_h5), ('regist-admin-v3', args.skip_admin)]:
            if not skip and not (release / name / 'index.html').is_file():
                raise ValueError('Missing staged frontend: ' + name)
        for name, skip in [('mini-v3', args.skip_h5), ('regist-admin-v3', args.skip_admin)]:
            if not skip:
                backup = HTML / '_backups' / (name + '-' + release.name)
                publish_static(release / name, HTML / name, backup)
        print('jd frontend release activated: ' + release.name)


def ssh_for(host):
    if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_.-]*', host):
        raise ValueError('Deploy hosts must be SSH aliases')
    return ['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', host]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Read-only preflight on both hosts; no build or deployment')
    parser.add_argument('--skip-go', action='store_true', default=os.getenv('SKIP_GO') == '1')
    parser.add_argument('--skip-h5', action='store_true', default=os.getenv('SKIP_H5') == '1')
    parser.add_argument('--skip-admin', action='store_true', default=os.getenv('SKIP_ADMIN') == '1')
    parser.add_argument('--migrate', action='store_true', help='Run forward database migrations before backend replacement')
    parser.add_argument('--remote', choices=['go', 'web'], help=argparse.SUPPRESS)
    parser.add_argument('--release', help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.migrate and args.skip_go:
        parser.error('--migrate cannot be combined with --skip-go')
    if args.remote == 'go':
        remote_go(args)
        return
    if args.remote == 'web':
        remote_web(args)
        return
    repo = Path(__file__).resolve().parents[1]
    web_ssh = ssh_for(os.getenv('DEPLOY_HOST', 'jd'))
    go_ssh = ssh_for(os.getenv('DEPLOY_GO_HOST', 'peiqian'))
    helper = Path(__file__).read_bytes()
    command(*web_ssh, 'python3 - --remote web --check', input=helper)
    command(*go_ssh, 'python3 - --remote go --check', input=helper)
    if args.check:
        return
    if args.skip_go and args.skip_h5 and args.skip_admin:
        raise ValueError('All deployment components are skipped')
    # Require a single clean, pushed source revision for backend and frontends.
    if command('git', 'status', '--porcelain', cwd=repo, stdout=subprocess.PIPE).stdout:
        raise RuntimeError('Commit or stash changes before deployment (including untracked files)')
    branch = os.getenv('DEPLOY_BRANCH', 'main')
    command('git', 'check-ref-format', '--branch', branch, stdout=subprocess.DEVNULL)
    command('git', 'fetch', 'origin', branch, cwd=repo)
    revision = command('git', 'rev-parse', 'HEAD', cwd=repo, stdout=subprocess.PIPE).stdout.decode().strip()
    expected = command('git', 'rev-parse', 'origin/' + branch, cwd=repo, stdout=subprocess.PIPE).stdout.decode().strip()
    if revision != expected:
        raise RuntimeError('HEAD must equal the pushed origin/' + branch)
    builds = []
    if not args.skip_h5:
        mini = repo / 'registration_system_mini'
        if not (mini / '.env.test').is_file():
            raise RuntimeError('Missing registration_system_mini/.env.test')
        env = dict(os.environ, VITE_PUBLIC_BASE='/mini-v3/', VITE_API_BASE_URL=ORIGIN + '/regist-v3/api/v1/app')
        command('bun', 'run', 'build:h5:acceptance', cwd=mini, env=env)
        builds.append((mini / 'dist/build/h5', 'mini-v3'))
    if not args.skip_admin:
        admin = repo / 'registration_system_backend_fe_go'
        command('bun', 'run', 'build:jd', cwd=admin)
        builds.append((admin / 'dist', 'regist-admin-v3'))
    for folder, name in builds:
        if '"/' + name + '/' not in (folder / 'index.html').read_text():
            raise RuntimeError('Incorrect asset base in ' + name)
    if command('git', 'status', '--porcelain', cwd=repo, stdout=subprocess.PIPE).stdout:
        raise RuntimeError('Build modified checkout; inspect before deployment')
    stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S') + '-' + revision[:12]
    # Backend first: frontends of the same revision may depend on new API fields.
    if not args.skip_go:
        release = GO_BASE / 'releases' / stamp
        go_dir = repo / 'registration_system_go'
        go_env = dict(os.environ, CGO_ENABLED='0', GOOS='linux', GOARCH='amd64')
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            api_bin = tmp_path / 'registration-system-go-api'
            command('go', 'build', '-trimpath', '-ldflags=-s -w', '-o', api_bin, './cmd/api', cwd=go_dir, env=go_env)
            if args.migrate:
                mig_bin = tmp_path / 'dbmigrate'
                command('go', 'build', '-trimpath', '-ldflags=-s -w', '-o', mig_bin, './cmd/dbmigrate', cwd=go_dir, env=go_env)
            archive = io.BytesIO()
            with tarfile.open(fileobj=archive, mode='w:gz') as tar:
                tar.add(api_bin, arcname='registration-system-go-api')
                if args.migrate:
                    tar.add(mig_bin, arcname='dbmigrate')
                    tar.add(go_dir / 'db/migrations', arcname='registration_system_go/db/migrations')
        command(*go_ssh, shlex.join(['mkdir', '-p', str(release / 'registration_system_go')]))
        command(*go_ssh, shlex.join(['tar', '-xzf', '-', '-C', str(release)]), input=archive.getvalue())
        flags = ['python3', '-', '--remote', 'go', '--release', str(release)]
        if args.migrate:
            flags.append('--migrate')
        command(*go_ssh, shlex.join(flags), input=helper)
    if builds:
        release = WEB_BASE / 'releases' / stamp
        command(*web_ssh, shlex.join(['mkdir', '-p', str(release)]))
        for folder, name in builds:
            archive = io.BytesIO()
            with tarfile.open(fileobj=archive, mode='w:gz') as tar:
                tar.add(folder, arcname=name)
            command(*web_ssh, shlex.join(['tar', '-xzf', '-', '-C', str(release)]), input=archive.getvalue())
        flags = ['python3', '-', '--remote', 'web', '--release', str(release)]
        for name in ['skip_h5', 'skip_admin']:
            if getattr(args, name):
                flags.append('--' + name.replace('_', '-'))
        command(*web_ssh, shlex.join(flags), input=helper)
    for path, skip in [('/regist-v3/health', args.skip_go), ('/mini-v3/', args.skip_h5), ('/regist-admin-v3/', args.skip_admin)]:
        if not skip:
            command('curl', '--noproxy', '*', '--fail', '--silent', '--show-error',
                    '--connect-timeout', '5', '--max-time', '15', '-o', '/dev/null', ORIGIN + path)
            print('Verified ' + ORIGIN + path)


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        # No subprocess output containing env values is attached to these errors.
        print('Deployment stopped: ' + str(exc), file=sys.stderr)
        sys.exit(1)
