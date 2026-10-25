"""Replaceable server provider port. No provider objects enter domain rules."""
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import httpx


class ProviderFailure(Exception):
    def __init__(self, code, retryable=True):
        super().__init__(code)
        self.code, self.retryable = code, retryable


def configured_digest(settings, purpose):
    digest = getattr(settings, purpose + '_digest')
    if not digest:
        try:
            lock = json.loads(Path(settings.model_lock_file).read_text(encoding='utf-8'))
            entry = lock[purpose]
            if entry['model'] == getattr(settings, purpose + '_model'):
                digest = entry['digest']
        except (OSError, ValueError, KeyError, TypeError):
            pass
    digest = digest.removeprefix('sha256:')
    return digest if re.fullmatch(r'[a-f0-9]{64}', digest) else ''


def verify_digest(client, model, expected):
    if not expected:
        raise ProviderFailure('model_not_pinned', retryable=False)
    response = client.get('/api/tags')
    response.raise_for_status()
    models = response.json()['models']
    aliases = {model, model + ':latest'}
    actual = next((m['digest'].removeprefix('sha256:') for m in models if m['name'] in aliases), None)
    if actual != expected:
        raise ProviderFailure('model_digest_mismatch', retryable=False)


@dataclass(frozen=True)
class Completion:
    content: str
    model: str
    digest: str
    input_tokens: int
    output_tokens: int


class LanguageModel(Protocol):
    model: str
    digest: str

    def complete(self, messages: list[dict], schema: dict, parameters: dict) -> Completion: ...


class OllamaLanguageModel:
    def __init__(self, settings, transport=None):
        self.settings, self.transport = settings, transport
        self.model = settings.llm_model
        self.digest = configured_digest(settings, 'llm')

    def complete(self, messages, schema, parameters):
        try:
            with httpx.Client(base_url=self.settings.ollama_url, transport=self.transport,
                              timeout=self.settings.llm_timeout_seconds) as client:
                verify_digest(client, self.model, self.digest)
                # Streaming decode bounds provider output before JSON parsing.
                with client.stream('POST', '/api/chat', json={
                    'model': self.model, 'messages': messages, 'format': schema,
                    'stream': False, 'options': parameters, 'keep_alive': '2m',
                }) as response:
                    response.raise_for_status()
                    body = bytearray()
                    for chunk in response.iter_bytes():
                        body.extend(chunk)
                        if len(body) > 131072:
                            raise ProviderFailure('provider_response_too_large')
                data = json.loads(body)
                if data.get('done') is not True or data.get('done_reason') == 'length':
                    raise ProviderFailure('provider_response_truncated')
                content = data['message']['content']
                if not isinstance(content, str) or not content.strip():
                    raise ProviderFailure('provider_empty_response')
                input_tokens, output_tokens = data['prompt_eval_count'], data['eval_count']
                if (type(input_tokens) is not int or type(output_tokens) is not int or
                        min(input_tokens, output_tokens) < 0 or
                        input_tokens > self.settings.llm_context_tokens or
                        output_tokens > self.settings.llm_max_output_tokens):
                    raise ProviderFailure('provider_usage_invalid')
                verify_digest(client, self.model, self.digest)
            return Completion(content, self.model, self.digest, input_tokens, output_tokens)
        except ProviderFailure:
            raise
        except httpx.TimeoutException as exc:
            raise ProviderFailure('provider_timeout') from exc
        except httpx.HTTPError as exc:
            raise ProviderFailure('provider_unavailable') from exc
        except (ValueError, KeyError, TypeError) as exc:
            raise ProviderFailure('provider_invalid_envelope') from exc
