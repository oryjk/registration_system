#!/usr/bin/env python3
"""Publish the existing jd installation; --check performs read-only preflight."""
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

BASE = Path('/root/docker_data/registration-go-v3')
HTML = Path('/root/docker_data/nginx/html')
ORIGIN = 'https://oryjk.cn:82'


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


def reload_nginx():
    # nginx resolves Docker upstream names on reload; container replacement changes IPs.
    command('docker', 'exec', 'nginx-server', 'nginx', '-t')
    command('docker', 'exec', 'nginx-server', 'nginx', '-s', 'reload')


def activate_backend(base, image):
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
        reload_nginx()
    except Exception:
        compose.write_text(before)
        command(*args)
        if not healthy():
            raise RuntimeError('Backend rollback health check failed; inspect jd locally') from None
        reload_nginx()
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


def preflight():
    for name in ['compose.yaml', 'backend.env', 'minio.env', 'nginx82.conf']:
        if not (BASE / name).is_file():
            raise RuntimeError('Missing existing jd deployment file: ' + name)
    with_image((BASE / 'compose.yaml').read_text(), 'registration:preflight')
    # Inspect only required keys; never print env values or resolved compose config.
    env = dict(line.split('=', 1) for line in (BASE / 'backend.env').read_text().splitlines()
               if '=' in line and not line.startswith('#'))
    for key in ['DATABASE_URL', 'JWT_SECRET', 'PUBLIC_BASE_URL', 'UPLOAD_MINIO_ENDPOINT']:
        if not env.get(key):
            raise RuntimeError('backend.env missing ' + key)
    if env['UPLOAD_MINIO_ENDPOINT'] != 'http://registration-minio:9000':
        raise RuntimeError('Storage must use jd private MinIO; inspect backend.env')
    command('docker', 'compose', '-f', BASE / 'compose.yaml', 'config', '-q')
    for container in ['nginx-server', 'registration-minio', 'registration-https82']:
        data = json.loads(command('docker', 'inspect', container, stdout=subprocess.PIPE).stdout)[0]
        if not data['State']['Running'] or 'registration-v3' not in data['NetworkSettings']['Networks']:
            raise RuntimeError(container + ' must be running on registration-v3')
    command('docker', 'exec', 'nginx-server', 'nginx', '-t')
    print('jd preflight passed: Compose, environment keys, private network and nginx.', flush=True)


def remote(args):
    preflight()
    if args.check:
        return
    import fcntl
    with (BASE / '.deploy.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        release = Path(args.release)
        if release.parent != BASE / 'releases':
            raise ValueError('Unexpected release directory')
        for name, skip in [('mini-v3', args.skip_h5), ('regist-admin-v3', args.skip_admin)]:
            if not skip and not (release / name / 'index.html').is_file():
                raise ValueError('Missing staged frontend: ' + name)
        if not args.skip_go:
            source = release / 'registration_system_go'
            image = 'registration-system-backend-go-v3:' + release.name
            command('docker', 'build', '-t', image, source)
            if args.migrate:
                # backend.env 自带 PATH 会覆盖镜像默认 PATH（不含 /usr/local/go/bin），
                # 迁移必须用绝对路径调 go，否则容器启动即报 executable file not found。
                command('docker', 'run', '--rm', '--network', 'host',
                        '--env-file', BASE / 'backend.env',
                        '-e', 'GOPROXY=https://goproxy.cn,direct',
                        '-e', 'GOSUMDB=sum.golang.google.cn',
                        '-v', str(source) + ':/src:ro', '-v', 'registration-go-mod-cache:/go/pkg/mod',
                        '-w', '/src', 'golang:1.26.5-bookworm', '/usr/local/go/bin/go', 'run', './cmd/dbmigrate')
            activate_backend(BASE, image)
        for name, skip in [('mini-v3', args.skip_h5), ('regist-admin-v3', args.skip_admin)]:
            if not skip:
                backup = HTML / '_backups' / (name + '-' + release.name)
                publish_static(release / name, HTML / name, backup)
        print('jd release activated: ' + release.name)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Read-only jd preflight; no build or deployment')
    parser.add_argument('--skip-go', action='store_true', default=os.getenv('SKIP_GO') == '1')
    parser.add_argument('--skip-h5', action='store_true', default=os.getenv('SKIP_H5') == '1')
    parser.add_argument('--skip-admin', action='store_true', default=os.getenv('SKIP_ADMIN') == '1')
    parser.add_argument('--migrate', action='store_true', help='Run forward database migrations before backend replacement')
    parser.add_argument('--remote', action='store_true', help=argparse.SUPPRESS)
    parser.add_argument('--release', help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.migrate and args.skip_go:
        parser.error('--migrate cannot be combined with --skip-go')
    if args.remote:
        remote(args)
        return
    repo = Path(__file__).resolve().parents[1]
    host = os.getenv('DEPLOY_HOST', 'jd')
    if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_.-]*', host):
        raise ValueError('DEPLOY_HOST must be an SSH alias')
    ssh = ['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', host]
    helper = Path(__file__).read_bytes()
    command(*ssh, 'python3 - --remote --check', input=helper)
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
    release = BASE / 'releases' / stamp
    command(*ssh, shlex.join(['mkdir', '-p', str(release)]))
    if not args.skip_go:
        archive = command('git', 'archive', revision, 'registration_system_go', cwd=repo, stdout=subprocess.PIPE).stdout
        command(*ssh, shlex.join(['tar', '-xf', '-', '-C', str(release)]), input=archive)
    for folder, name in builds:
        archive = io.BytesIO()
        with tarfile.open(fileobj=archive, mode='w:gz') as tar:
            tar.add(folder, arcname=name)
        command(*ssh, shlex.join(['tar', '-xzf', '-', '-C', str(release)]), input=archive.getvalue())
    flags = ['python3', '-', '--remote', '--release', str(release)]
    for name in ['skip_go', 'skip_h5', 'skip_admin', 'migrate']:
        if getattr(args, name):
            flags.append('--' + name.replace('_', '-'))
    command(*ssh, shlex.join(flags), input=helper)
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
