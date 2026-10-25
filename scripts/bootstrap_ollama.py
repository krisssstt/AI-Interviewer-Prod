"""Extract official Ollama CPU runtime using HTTP ranges; skip multi-GB GPU libraries.

The selected release archive is published by ollama/ollama. ZIP CRC is checked by
zipfile. Executable signature is independently checked by the installation command.
"""
import io
import shutil
import zipfile
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / '.runtime/ollama'


class RemoteArchive(io.RawIOBase):
    def __init__(self, client, url, length):
        self.client, self.url, self.length = client, url, length
        self.position, self.cached_start, self.cached = 0, -1, b''

    def seekable(self):
        return True

    def tell(self):
        return self.position

    def seek(self, offset, whence=0):
        self.position = offset if whence == 0 else self.position + offset if whence == 1 else self.length + offset
        return self.position

    def read(self, size=-1):
        if size < 0:
            size = self.length - self.position
        size = min(size, self.length - self.position)
        if not size:
            return b''
        start, end = self.position, self.position + size
        if not (self.cached_start <= start and end <= self.cached_start + len(self.cached)):
            stop = min(self.length - 1, start + max(size, 8 * 1024 * 1024) - 1)
            request_url = self.url
            if httpx.URL(self.url).host in {'get.enterprisedb.com', 'desktop.docker.com'}:
                request_url += f'?qa_range={start}-{stop}'
            with self.client.stream('GET', request_url, headers={'Range': f'bytes={start}-{stop}'}) as response:
                if response.status_code != 206:
                    raise RuntimeError('Official archive server did not honor byte ranges')
                self.cached_start, self.cached = start, response.read()
        data = self.cached[start - self.cached_start:end - self.cached_start]
        self.position += len(data)
        return data


def main():
    TARGET.mkdir(parents=True, exist_ok=True)
    with httpx.Client(timeout=90, follow_redirects=True) as client:
        release = client.get('https://api.github.com/repos/ollama/ollama/releases/tags/v0.13.5')
        release.raise_for_status()
        asset = next(a for a in release.json()['assets'] if a['name'] == 'ollama-windows-amd64.zip')
        redirect = client.get(asset['url'] + '?download=1', headers={'Accept': 'application/octet-stream'},
                              follow_redirects=False)
        if redirect.status_code != 302:
            raise RuntimeError('Official GitHub asset download redirect unavailable')
        archive = RemoteArchive(client, redirect.headers['location'], asset['size'])
        with zipfile.ZipFile(archive) as zipped:
            files = [entry for entry in zipped.infolist() if not entry.is_dir() and (
                entry.filename == 'ollama.exe' or
                entry.filename.startswith('lib/ollama/') and
                entry.filename.count('/') == 2 and entry.filename.endswith('.dll'))]
            print('Selected CPU runtime:', [(f.filename, f.file_size) for f in files], flush=True)
            for entry in files:
                path = (TARGET / entry.filename).resolve()
                if not path.is_relative_to(TARGET.resolve()):
                    raise ValueError('Unsafe archive path')
                if path.is_file() and path.stat().st_size == entry.file_size:
                    continue
                path.parent.mkdir(parents=True, exist_ok=True)
                with zipped.open(entry) as source, path.open('wb') as destination:
                    shutil.copyfileobj(source, destination, 1024 * 1024)
                print('Installed', entry.filename, flush=True)
    print('Ollama CPU runtime ready in .runtime/ollama')


if __name__ == '__main__':
    main()
