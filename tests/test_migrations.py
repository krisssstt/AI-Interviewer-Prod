import io

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text


def test_upgrade_preserves_existing_account(tmp_path):
    url='sqlite:///'+(tmp_path/'upgrade.db').as_posix()
    config=Config('alembic.ini')
    config.attributes['database_url']=url
    command.upgrade(config,'34f69dec8cd4')
    engine=create_engine(url)
    with engine.begin() as db:
        db.execute(text("INSERT INTO users (id,email,password_hash,name,direction,created_at) "
                        "VALUES ('existing','existing@example.com','not-a-real-password','Existing','qa',0)"))
    command.upgrade(config,'head')
    with engine.connect() as db:
        assert db.execute(text("SELECT is_admin FROM users WHERE id='existing'")).scalar()==0
    engine.dispose()


def test_postgres_ddl_compiles_offline():
    output=io.StringIO()
    config=Config('alembic.ini',output_buffer=output)
    config.attributes['database_url']='postgresql+psycopg://unused:unused@localhost/unused'
    command.upgrade(config,'head',sql=True)
    ddl=output.getvalue()
    assert 'CREATE EXTENSION IF NOT EXISTS vector' in ddl
    assert 'vector VECTOR' in ddl
    assert 'ON DELETE CASCADE' in ddl
    # Compilation is not a running PostgreSQL integration test.
