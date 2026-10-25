"""Explicit operator action: pin installed models, never download weights implicitly."""
import argparse
import json
import re
from pathlib import Path

import httpx

from .config import Settings


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', default='config/model-lock.json')
    args = parser.parse_args()
    settings = Settings()
    try:
        with httpx.Client(base_url=settings.ollama_url, timeout=10) as client:
            response = client.get('/api/tags')
            response.raise_for_status()
            installed = response.json()['models']
        lock = {}
        for purpose in ['embedding', 'llm']:
            name = getattr(settings, purpose + '_model')
            digest = next((m['digest'].removeprefix('sha256:') for m in installed
                           if m['name'] in {name, name + ':latest'}), '')
            if not re.fullmatch('[a-f0-9]{64}', digest):
                parser.exit(1, f'Model not installed or invalid digest: {name}\n')
            lock[purpose] = {'model': name, 'digest': digest}
        path = Path(args.output)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(lock, indent=2) + '\n', encoding='utf-8')
        print('Model digests pinned. Reindex documents; existing vectors are not rewritten.')
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        parser.exit(1, 'Ollama unavailable or invalid response. Lock file unchanged.\n')


if __name__ == '__main__':
    main()
