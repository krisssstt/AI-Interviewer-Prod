"""Fetch only fixed official sources; never fetch URLs supplied by uploaded documents."""
import hashlib
import json
import re
import time
from html.parser import HTMLParser
from pathlib import Path

import httpx

CORPUS = Path(__file__).resolve().parents[1] / 'corpus'


class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts, self.skip = [], 0

    def handle_starttag(self, tag, attrs):
        if tag in {'script', 'style', 'nav', 'header', 'footer'}:
            self.skip += 1
        if not self.skip and tag in {'p', 'pre', 'tr', 'h1', 'h2', 'h3', 'li', 'div'}:
            self.parts.append('\n' if tag == 'tr' else '\n\n')
        if not self.skip and tag == 'pre':
            self.parts.append('```text\n')
        if not self.skip and tag in {'h1', 'h2', 'h3'}:
            self.parts.append('#' * int(tag[1]) + ' ')
        if not self.skip and tag in {'td', 'th'}:
            self.parts.append(' | ')

    def handle_endtag(self, tag):
        if not self.skip and tag == 'pre':
            self.parts.append('\n```')
        if tag in {'script', 'style', 'nav', 'header', 'footer'}:
            self.skip = max(0, self.skip - 1)
        if not self.skip and tag in {'p', 'pre', 'h1', 'h2', 'h3', 'li'}:
            self.parts.append('\n\n')

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)

    def text(self):
        return re.sub(r'\n[ \t]*\n(?:[ \t]*\n)+', '\n\n', ''.join(self.parts)).strip()


def fetch(client, url, target):
    if target.is_file():
        return target.read_text(encoding='utf-8')
    for attempt in range(5):
        try:
            response = client.get(url)
            response.raise_for_status()
            break
        except httpx.HTTPError:
            if attempt == 4:
                raise
            print('Official source fetch retry:', httpx.URL(url).host, flush=True)
            time.sleep(2)
    if len(response.content) > 2000000:
        raise ValueError('Official source exceeds size limit')
    target.parent.mkdir(parents=True, exist_ok=True)
    value = response.content.decode('utf-8-sig').replace('\r\n', '\n')
    target.write_text(value, encoding='utf-8')
    return value


def section(text, start, stop):
    left = list(re.finditer(r'(?m)^' + re.escape(start) + r'  [^\n]+\n', text))
    right = list(re.finditer(r'(?m)^' + re.escape(stop) + r'  [^\n]+\n', text))
    if not left or not right or left[-1].start() >= right[-1].start():
        raise ValueError('Official RFC structure changed; extraction requires review')
    return text[left[-1].start():right[-1].start()].strip()


def main():
    records = []
    with httpx.Client(timeout=60, follow_redirects=True) as client:
        rfc_url = 'https://www.rfc-editor.org/rfc/rfc9110.txt'
        raw = fetch(client, rfc_url, CORPUS/'raw/rfc9110.txt')
        excerpt = ('# RFC 9110 — selected unmodified sections\n\n'
            'Source: '+rfc_url+'\nVersion: June 2022. Copyright and IETF Trust notice are preserved '
            'in corpus/raw/rfc9110.txt. See https://trustee.ietf.org/license-info.\n\n'+
            '\n\n'.join([section(raw,'9.2.1.','9.2.3.'), section(raw,'15.5.2.','15.5.4.'),
                          section(raw,'15.4.5.','15.4.6.')]))
        path = CORPUS/'official/rfc9110-selected.md'
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(excerpt, encoding='utf-8')
        records.append({'id':'official-rfc9110','version':1,'file':'official/rfc9110-selected.md',
            'title':'RFC 9110: method properties, 401/403 and 304','language':'en',
            'license':'IETF Trust Legal Provisions / BCP 78; notice in raw RFC', 'url':rfc_url,
            'competencies':['qa-http-methods','qa-http-status','qa-http-cache','qa-api-retry']})
        for slug, title, competencies in [
            ('queries-table-expressions','PostgreSQL 16: Table Expressions', ['qa-sql-join','qa-sql-groups']),
            ('functions-comparison','PostgreSQL 16: Comparison Functions', ['qa-sql-null'])]:
            url = f'https://www.postgresql.org/docs/16/{slug}.html'
            raw_html = fetch(client, url, CORPUS/f'raw/{slug}.html')
            content = raw_html.split('<div id="docContent"',1)[-1].split('<div id="docComments"',1)[0]
            if '<div id="docContent"' in raw_html:
                content = content.split('>',1)[-1]
            content = re.sub(r'<div class="nav(?:header|footer)".*?</div>', '', content, flags=re.DOTALL)
            extractor=TextExtractor(); extractor.feed(content)
            extracted = '# '+title+'\n\nSource: '+url+'\n\n'+extractor.text()
            path=CORPUS/f'official/{slug}-v2.md'; path.write_text(extracted,encoding='utf-8')
            records.append({'id':'official-pg16-'+('joins' if 'queries' in slug else 'null'),
                'version':2,'file':f'official/{slug}-v2.md','title':title,'language':'en',
                'license':'PostgreSQL License; see official/POSTGRESQL-LICENSE.txt','url':url,
                'competencies':competencies})
        license_html=fetch(client,'https://www.postgresql.org/about/licence/',CORPUS/'raw/postgresql-license.html')
        license_text=TextExtractor(); license_text.feed(license_html)
        (CORPUS/'official/POSTGRESQL-LICENSE.txt').write_text(license_text.text(),encoding='utf-8')
    for record in records:
        content=(CORPUS/record['file']).read_text(encoding='utf-8').strip()
        record['sha256']=hashlib.sha256(content.encode()).hexdigest()
        record['received_at']=time.time()
    (CORPUS/'official-manifest.json').write_text(json.dumps({'schema_version':1,'documents':records},
        ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Official snapshots prepared: {len(records)}; raw files and notices preserved.')


if __name__=='__main__':
    main()
