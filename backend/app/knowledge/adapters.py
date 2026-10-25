import math
from typing import Protocol

import httpx

from ..ai.providers import ProviderFailure, configured_digest, verify_digest


class EmbeddingUnavailable(Exception):
    """A public error code only: no provider payload or private document text."""


class Embedder(Protocol):
    model_key: str

    def embed(self, texts: list[str]) -> list[list[float]]: ...


class OllamaEmbedder:
    def __init__(self, settings, transport=None):
        self.settings, self.transport = settings, transport
        self.digest = configured_digest(settings, 'embedding')
        revision = self.digest or settings.embedding_revision
        self.model_key = f'{settings.embedding_model}@{revision}:{settings.embedding_dimensions}'

    def embed(self, texts):
        try:
            with httpx.Client(base_url=self.settings.ollama_url, transport=self.transport,
                              timeout=self.settings.ai_timeout_seconds) as client:
                verify_digest(client, self.settings.embedding_model, self.digest)
                response = client.post('/api/embed', json={
                    'model': self.settings.embedding_model, 'input': texts, 'truncate': False})
                response.raise_for_status()
                vectors = response.json()['embeddings']
                verify_digest(client, self.settings.embedding_model, self.digest)
            if len(vectors) != len(texts):
                raise ValueError('count')
            if any(len(v) != self.settings.embedding_dimensions or
                   any(type(x) not in (float, int) or not math.isfinite(x) for x in v) or
                   not any(x != 0 for x in v) for v in vectors):
                raise ValueError('invalid-vector')
            return vectors
        except ProviderFailure as exc:
            raise EmbeddingUnavailable(exc.code) from exc
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
            raise EmbeddingUnavailable('embedding_provider_unavailable_or_invalid') from exc

