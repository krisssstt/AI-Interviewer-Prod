import hashlib
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent))
from bootstrap_postgres import RUNTIME
from range_download import parallel_download

RUNTIME.mkdir(exist_ok=True)
with httpx.Client(timeout=30, follow_redirects=True) as client:
    response = client.get('https://desktop.docker.com/win/main/amd64/checksums.txt')
    response.raise_for_status()
    lines = [line for line in response.text.splitlines() if 'Installer.exe' in line]
    if not lines:
        raise RuntimeError('Official Docker checksum manifest did not contain installer')
    expected = lines[0].split()[0].lower()
target = RUNTIME / 'DockerDesktopInstaller.exe'
parallel_download('https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe', target)
with target.open('rb') as source:
    actual = hashlib.file_digest(source, 'sha256').hexdigest()
if expected != actual:
    raise RuntimeError('Docker installer checksum mismatch; installer was not launched')
print('Official Docker installer downloaded and SHA256 verified.')
