import argparse
import time

from . import models  # noqa: F401
from .ai.providers import OllamaLanguageModel
from .ai.worker import process_one as process_ai
from .config import Settings
from .db import database
from .knowledge.adapters import OllamaEmbedder
from .knowledge.worker import process_one


def main():
    parser = argparse.ArgumentParser(description='Process a bounded batch of durable ingestion jobs')
    parser.add_argument('--limit', type=int, default=20)
    parser.add_argument('--watch', action='store_true', help='Poll durable jobs until stopped')
    args = parser.parse_args()
    if not 1 <= args.limit <= 100:
        parser.error('--limit must be 1..100')
    settings = Settings()
    engine, sessions = database(settings.database_url)
    embedder = OllamaEmbedder(settings)
    model = OllamaLanguageModel(settings)
    processed = 0
    try:
        while True:
            for _ in range(args.limit):
                learned = process_ai(sessions, settings, model, embedder)
                ingested = process_one(sessions, embedder, settings.chunk_max_chars)
                if not (learned or ingested):
                    break
                processed += int(learned) + int(ingested)
            if not args.watch:
                break
            time.sleep(2)
        print(f'Processed jobs: {processed}; inspect AI task and ingestion status for actual success.')
    finally:
        engine.dispose()


if __name__ == '__main__':
    main()

