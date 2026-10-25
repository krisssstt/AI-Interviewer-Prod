"""Alternative small native PostgreSQL distribution from Zonky's Maven artifact.

PG major version 16 matches Compose. No service, system database or administrator
account is changed. Artifact checksum is verified before extraction.
"""
import hashlib
import io
import tarfile
import zipfile
from pathlib import Path

import httpx

ROOT=Path(__file__).resolve().parents[1]
RUNTIME=ROOT/'.runtime'
VERSION='16.15.0'
NAME='embedded-postgres-binaries-windows-amd64'
URL=f'https://repo.maven.apache.org/maven2/io/zonky/test/postgres/{NAME}/{VERSION}/{NAME}-{VERSION}.jar'


def main():
    RUNTIME.mkdir(exist_ok=True)
    archive=RUNTIME/f'postgres-embedded-{VERSION}.jar'
    with httpx.Client(timeout=60,follow_redirects=True) as client:
        response=client.get(URL+'.sha1');response.raise_for_status()
        checksum=response.text.strip().split()[0]
        if not archive.is_file():
            with client.stream('GET',URL) as response:
                response.raise_for_status()
                with archive.open('wb') as output:
                    for data in response.iter_bytes(1024*1024):
                        output.write(data)
                        output.flush()
            print('Zonky native archive downloaded',archive.stat().st_size,flush=True)
    with archive.open('rb') as source:
        actual=hashlib.file_digest(source,'sha1').hexdigest()
    if actual!=checksum:
        raise ValueError('Maven artifact checksum mismatch')
    target=RUNTIME/'postgres-native'
    target.mkdir(exist_ok=True)
    with zipfile.ZipFile(archive) as zipped:
        resource=next(name for name in zipped.namelist() if name.endswith('.txz'))
        with tarfile.open(fileobj=io.BytesIO(zipped.read(resource)),mode='r:xz') as tar:
            for member in tar.getmembers():
                path=(target/member.name).resolve()
                if not path.is_relative_to(target.resolve()) or member.issym() or member.islnk():
                    raise ValueError('Unsafe native archive entry')
            tar.extractall(target,filter='data')
    print('PostgreSQL native runtime ready at .runtime/postgres-native')


if __name__=='__main__':
    main()
