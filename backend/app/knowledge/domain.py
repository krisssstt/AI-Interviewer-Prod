import re

from ..errors import RuleError


def clean_text(value):
    value = value.replace('\r\n', '\n').replace('\r', '\n').lstrip('\ufeff')
    if '\x00' in value or any(ord(c) < 32 and c not in '\n\t' for c in value):
        raise RuleError('Файл содержит бинарные данные или недопустимые управляющие символы.', 422)
    if len(value.strip()) < 40:
        raise RuleError('Материал должен содержать минимум 40 символов текста.', 422)
    return value.strip()


def chunk_text(text, max_chars=2400):
    """Paragraph/section splitting; fenced code and contiguous tables stay atomic.

    Offsets refer to the cleaned version text. Oversized atomic blocks remain intact
    instead of silently truncating definitions/code. Ingestion has a total size bound.
    """
    blocks, start, in_fence = [], 0, False
    offset = 0
    for line in text.splitlines(keepends=True):
        if line.lstrip().startswith('```'):
            in_fence = not in_fence
        if not in_fence and not line.strip():
            if text[start:offset].strip():
                blocks.append((start, offset))
            start = offset + len(line)
        offset += len(line)
    if text[start:].strip():
        blocks.append((start, len(text)))
    result, group, section = [], [], 'Введение'

    def flush():
        if group:
            a, b = group[0][0], group[-1][1]
            result.append({'text': text[a:b], 'section': section[:300],
                           'start_offset': a, 'end_offset': b, 'ordinal': len(result)})
            group.clear()

    for a, b in blocks:
        heading = re.match(r'^#{1,6}\s+(.+)', text[a:b])
        if heading:
            flush()
            section = heading.group(1)
        if group and b - group[0][0] > max_chars:
            flush()
        group.append((a, b))
    flush()
    return result


def terms(text):
    return set(re.findall(r'[\w-]{2,}', text.casefold()))

