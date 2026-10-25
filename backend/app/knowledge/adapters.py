import math
from typing import Protocol

import httpx


class EmbeddingUnavailable(Exception):
    """A public error code only: no provider payload or private document text."""


class Embedder(Protocol):
    model_key: str

    def embed(self, texts: list[str]) -> list[list[float]]: ...


class OllamaEmbedder:
    def __init__(self, settings, transport=None):
        self.settings, self.transport = settings, transport
        self.model_key = f'{settings.embedding_model}@{settings.embedding_revision}:{settings.embedding_dimensions}'

    def embed(self, texts):
        try:
            with httpx.Client(base_url=self.settings.ollama_url, transport=self.transport,
                              timeout=self.settings.ai_timeout_seconds) as client:
                response = client.post('/api/embed', json={
                    'model': self.settings.embedding_model, 'input': texts, 'truncate': False})
                response.raise_for_status()
                vectors = response.json()['embeddings']
            if len(vectors) != len(texts):
                raise ValueError('count')
            if any(len(v) != self.settings.embedding_dimensions or
                   any(not isinstance(x, (float, int)) or not math.isfinite(x) for x in v) or
                   not any(x != 0 for x in v) for v in vectors):
                raise ValueError('invalid-vector')
            return vectors
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
            raise EmbeddingUnavailable('embedding_provider_unavailable_or_invalid') from exc

