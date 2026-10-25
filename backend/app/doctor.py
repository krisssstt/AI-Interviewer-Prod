"""Read-only readiness report, no schema changes, generation or model downloads."""
import argparse
import json
import shutil
from pathlib import Path

import httpx
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from .ai.providers import ProviderFailure, configured_digest, verify_digest
from .config import Settings


def inspect(settings):
    result = {'docker_cli': bool(shutil.which('docker')), 'database': {}, 'models': {}}
    engine = create_engine(settings.database_url)
    try:
        with engine.connect() as db:
            revision = db.execute(text('SELECT version_num FROM alembic_version')).scalar()
            result['database'] = {'dialect': engine.dialect.name, 'schema': revision, 'available': True}
            if engine.dialect.name == 'postgresql':
                version = db.execute(text("SELECT extversion FROM pg_extension WHERE extname='vector'")).scalar()
                result['database']['pgvector'] = version
    except SQLAlchemyError:
        result['database'] = {'available': False, 'error': 'database_or_schema_unavailable'}
    finally:
        engine.dispose()
    for purpose in ['embedding', 'llm']:
        try:
            with httpx.Client(base_url=settings.ollama_url, timeout=3) as client:
                # Check reachability before pinning so an absent provider is explicit.
                response = client.get('/api/tags')
                response.raise_for_status()
                verify_digest(client, getattr(settings, purpose + '_model'), configured_digest(settings, purpose))
            result['models'][purpose] = {'available': True, 'pinned': True}
        except (ProviderFailure, httpx.HTTPError, ValueError, KeyError, TypeError) as error:
            code = getattr(error, 'code', 'provider_unavailable_or_invalid')
            result['models'][purpose] = {'available': False, 'error': code}
    result['full_rag_ready'] = (result['database'].get('dialect') == 'postgresql' and
                               bool(result['database'].get('pgvector')) and
                               all(model['available'] for model in result['models'].values()))
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--report')
    args = parser.parse_args()
    result = inspect(Settings())
    encoded = json.dumps(result, indent=2) + '\n'
    if args.report:
        Path(args.report).write_text(encoded, encoding='utf-8')
    print(encoded)


if __name__ == '__main__':
    main()
