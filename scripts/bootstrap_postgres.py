"""Install official EDB PostgreSQL binaries locally; no administrator or Windows service.

Only absent installation files are written. Existing database directories are never
initialized or removed by this command. Source URL is fixed to the official vendor.
"""
import argparse
import time
import zipfile
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / '.runtime'


def download(url, path):
    if path.is_file():
        return
    partial = path.with_suffix(path.suffix + '.partial')
    for attempt in range(15):
        try:
            offset = partial.stat().st_size if partial.exists() else 0
            with httpx.stream('GET', url, headers={'Range': f'bytes={offset}-'},
                              follow_redirects=True, timeout=60) as response:
                response.raise_for_status()
                if response.status_code != 206:
                    offset = 0
                total = offset + int(response.headers.get('content-length', 0))
                size, reported = offset, offset
                with partial.open('ab' if offset else 'wb') as output:
                    for data in response.iter_bytes(1024 * 1024):
                        output.write(data)
                        output.flush()
                        size += len(data)
                        if size - reported > 20 * 1024 * 1024:
                            print(f'Downloaded {size // 1048576} MiB / {total // 1048576} MiB', flush=True)
                            reported = size
                if total and size != total:
                    raise OSError('Incomplete download')
                partial.replace(path)
                return
        except (httpx.HTTPError, OSError) as error:
            print(f'Download retry {attempt + 1}: {type(error).__name__}', flush=True)
            if attempt == 14:
                raise
            time.sleep(2)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--version', default='16.15-5')
    parser.add_argument('--selective', action='store_true', help='Extract required binaries via HTTP byte ranges')
    args = parser.parse_args()
    if not all(char.isdigit() or char in '.-' for char in args.version):
        parser.error('Invalid version')
    RUNTIME.mkdir(exist_ok=True)
    target = RUNTIME / 'postgres'
    if (target / 'pgsql/bin/postgres.exe').exists():
        print('Existing PostgreSQL binaries preserved.')
        return
    archive = RUNTIME / ('postgresql-' + args.version + '.zip')
    url = f'https://get.enterprisedb.com/postgresql/postgresql-{args.version}-windows-x64-binaries.zip'
    print('Downloading official EDB archive:', url, flush=True)
    if args.selective:
        from bootstrap_ollama import RemoteArchive
        with httpx.Client(timeout=90, follow_redirects=True) as client:
            response = client.head(url)
            response.raise_for_status()
            remote = RemoteArchive(client, url, int(response.headers['content-length']))
            with zipfile.ZipFile(remote) as zipped:
                selected = [entry for entry in zipped.infolist() if not entry.is_dir() and
                    entry.filename.startswith(('pgsql/bin/', 'pgsql/lib/', 'pgsql/share/')) and
                    not entry.filename.endswith('.pdb')]
                print(f'Selected {len(selected)} PostgreSQL runtime files', flush=True)
                import shutil
                for number, entry in enumerate(selected):
                    path = (target / entry.filename).resolve()
                    if not path.is_relative_to(target.resolve()):
                        raise ValueError('Unsafe archive path')
                    if path.exists() and path.stat().st_size == entry.file_size:
                        continue
                    path.parent.mkdir(parents=True, exist_ok=True)
                    with zipped.open(entry) as source, path.open('wb') as destination:
                        shutil.copyfileobj(source, destination, 1024 * 1024)
                    if number % 100 == 0:
                        print(f'Extracted runtime file {number}/{len(selected)}', flush=True)
        print('PostgreSQL runtime extracted from official archive.')
        return
    download(url, archive)
    target.mkdir(exist_ok=True)
    with zipfile.ZipFile(archive) as zipped:
        for entry in zipped.infolist():
            resolved = (target / entry.filename).resolve()
            if not resolved.is_relative_to(target.resolve()):
                raise ValueError('Archive path outside installation directory')
            if entry.filename.startswith(('pgsql/bin/', 'pgsql/lib/', 'pgsql/share/', 'pgsql/include/')):
                zipped.extract(entry, target)
    print('PostgreSQL installed under .runtime/postgres; no database has been initialized.')


if __name__ == '__main__':
    main()
