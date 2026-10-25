"""Initialize only the project's dedicated PostgreSQL directory; preserve existing data."""
import json
import secrets
import subprocess
import zipfile
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL

ROOT=Path(__file__).resolve().parents[1]
RUNTIME=ROOT/'.runtime'


def run(args):
    completed=subprocess.run([str(a) for a in args],capture_output=True,
        creationflags=subprocess.CREATE_NO_WINDOW,encoding='utf-8',errors='replace')
    if completed.returncode:
        # initdb/pg_ctl commands contain file paths, never inline passwords.
        raise RuntimeError(completed.stderr[-1500:] or completed.stdout[-1500:])


def main():
    base=RUNTIME/'postgres/pgsql'
    if not (base/'bin/postgres.exe').is_file():
        raise RuntimeError('PostgreSQL extraction is not finished')
    config_path=RUNTIME/'postgres-credentials.json'
    if config_path.exists():
        credentials=json.loads(config_path.read_text())
    else:
        credentials={'admin':secrets.token_urlsafe(32),'application':secrets.token_urlsafe(32),'port':5432}
        config_path.write_text(json.dumps(credentials),encoding='utf-8')
    with zipfile.ZipFile(RUNTIME/'pgvector.zip') as zipped:
        for entry in zipped.infolist():
            if entry.is_dir():
                continue
            filename=entry.filename
            if filename.startswith('share/extension/'):
                filename=filename.replace('share/extension/','share/extension/',1)
            path=(base/filename).resolve()
            if not path.is_relative_to(base.resolve()):
                raise ValueError('Unsafe extension archive path')
            path.parent.mkdir(parents=True,exist_ok=True)
            if not path.exists():
                path.write_bytes(zipped.read(entry))
    data=RUNTIME/'pgdata'
    if not (data/'PG_VERSION').exists():
        if data.exists() and any(data.iterdir()):
            raise RuntimeError('Existing incomplete data directory preserved; inspect it before continuing')
        password=RUNTIME/'pg-init-password.txt'; password.write_text(credentials['admin'],encoding='ascii')
        run([base/'bin/initdb.exe','-D',data,'-U','qa_admin','-A','scram-sha-256','--pwfile',password,
             '--encoding=UTF8','--locale=C'])
        password.unlink()
    status=subprocess.run([str(base/'bin/pg_ctl.exe'),'-D',str(data),'status'],capture_output=True,
                          creationflags=subprocess.CREATE_NO_WINDOW)
    if status.returncode:
        run([base/'bin/pg_ctl.exe','-D',data,'-l',RUNTIME/'postgres.log','-w','-o',
             '-h 127.0.0.1 -p 5432 -c shared_buffers=64MB -c max_connections=30','start'])
    admin_url=URL.create('postgresql+psycopg',username='qa_admin',password=credentials['admin'],
                         host='127.0.0.1',port=5432,database='postgres')
    engine=create_engine(admin_url,isolation_level='AUTOCOMMIT')
    with engine.connect() as db:
        if not db.execute(text("SELECT 1 FROM pg_roles WHERE rolname='interviewer'")).scalar():
            # Generated password contains URL-safe characters only. Quote through
            # the driver's SQL literal rather than assembling an identifier from input.
            from psycopg import sql
            db.connection.driver_connection.execute(sql.SQL('CREATE ROLE interviewer LOGIN PASSWORD {}').format(
                sql.Literal(credentials['application'])))
        for name in ['interviewer','interviewer_test']:
            if not db.execute(text('SELECT 1 FROM pg_database WHERE datname=:name'),{'name':name}).scalar():
                db.exec_driver_sql(f'CREATE DATABASE {name} OWNER interviewer')
    engine.dispose()
    for name in ['interviewer','interviewer_test']:
        engine=create_engine(admin_url.set(database=name),isolation_level='AUTOCOMMIT')
        with engine.connect() as db:
            db.execute(text('CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public'))
            db.execute(text('GRANT CREATE ON SCHEMA public TO interviewer'))
        engine.dispose()
    app_url=admin_url.set(username='interviewer',password=credentials['application'],database='interviewer')
    (RUNTIME/'postgres-urls.json').write_text(json.dumps({
        'DATABASE_URL':app_url.render_as_string(hide_password=False),
        'TEST_DATABASE_URL':app_url.set(database='interviewer_test').render_as_string(hide_password=False)}),encoding='utf-8')
    print('Project PostgreSQL and pgvector ready. Credentials stored only under ignored .runtime/.')


if __name__=='__main__':
    main()
