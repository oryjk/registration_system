import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('deploy_jd', Path(__file__).parents[1] / 'scripts/deploy_jd.py')
m = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(m)

COMPOSE = '''services:
  minio:
    image: sha256:minio
  backend:
    image: sha256:old
    env_file: [backend.env]
    volumes: ["./uploads:/app/uploads"]
  legacy82:
    image: sha256:nginx
'''

class DeploymentTests(unittest.TestCase):
    def test_only_backend_image_changes(self):
        updated = m.with_image(COMPOSE, 'registration:abc')
        self.assertEqual(updated.replace('registration:abc', 'sha256:old'), COMPOSE)

    def test_unknown_compose_layout_is_rejected(self):
        with self.assertRaises(ValueError):
            m.with_image('services: {}', 'registration:abc')

    def test_failed_backend_restores_compose_and_reloads_nginx(self):
        with tempfile.TemporaryDirectory() as t:
            base = Path(t); (base/'compose.yaml').write_text(COMPOSE)
            calls=[]
            with patch.object(m, 'command', side_effect=lambda *args, **kwargs: calls.append(args)), patch.object(m, 'healthy', side_effect=[False, True]):
                with self.assertRaises(RuntimeError):
                    m.activate_backend(base, 'registration:abc')
            self.assertEqual((base/'compose.yaml').read_text(), COMPOSE)
            self.assertEqual(sum('up' in c for c in calls), 2)
            self.assertTrue(any('reload' in c for c in calls))

    def test_missing_static_index_keeps_live_directory(self):
        with tempfile.TemporaryDirectory() as t:
            root=Path(t); src=root/'new'; dst=root/'live'; src.mkdir(); dst.mkdir()
            (dst/'index.html').write_text('old')
            with self.assertRaises(ValueError): m.publish_static(src,dst,root/'backup')
            self.assertEqual((dst/'index.html').read_text(),'old')

    def test_static_publish_keeps_previous_files_as_backup(self):
        with tempfile.TemporaryDirectory() as t:
            root = Path(t)
            src, dst, backup = root/'new', root/'live', root/'backup'
            src.mkdir(); dst.mkdir()
            (src/'index.html').write_text('new')
            (dst/'index.html').write_text('old')
            m.publish_static(src, dst, backup)
            self.assertEqual((dst/'index.html').read_text(), 'new')
            self.assertEqual((backup/'index.html').read_text(), 'old')

    def test_backend_success_only_recreates_backend(self):
        with tempfile.TemporaryDirectory() as t:
            base = Path(t)
            (base/'compose.yaml').write_text(COMPOSE)
            with patch.object(m, 'command') as command, patch.object(m, 'healthy', return_value=True):
                m.activate_backend(base, 'registration:new')
            self.assertEqual((base/'compose.yaml').read_text(), COMPOSE.replace('sha256:old', 'registration:new'))
            self.assertEqual(command.call_args_list[0].args[-4:], ('up', '-d', '--no-deps', 'backend'))
            self.assertEqual(len(list(base.glob('compose.before-*.yaml'))), 1)

if __name__ == '__main__': unittest.main()

