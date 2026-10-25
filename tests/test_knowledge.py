import time

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from backend.app.config import Settings
from backend.app.identity.models import User
from backend.app.knowledge.adapters import EmbeddingUnavailable, OllamaEmbedder
from backend.app.knowledge.domain import chunk_text, clean_text
from backend.app.knowledge.models import Chunk, Document, DocumentVersion, Embedding, IngestionJob
from backend.app.knowledge.worker import claim, process_one

from .conftest import account


class TestEmbedder:
    __test__ = False
    model_key = 'test-only-v1:3'

    def embed(self, texts):
        return [[1.0, 0.5, 0.2] for _ in texts]


class BrokenEmbedder(TestEmbedder):
    def embed(self, texts):
        raise EmbeddingUnavailable('test-unavailable')


def payload(scope='private', text=None):
    return {'title':'Учебный документ', 'text':text or '# HTTP\n\nПриватныймаркер. HTTP GET безопасен и идемпотентен по семантике метода.',
            'scope':scope, 'competency_id':'qa-http-methods', 'license':'Own authored test material'}


def upload(client, scope='private', text=None):
    response=client.post('/api/knowledge/documents',json=payload(scope,text))
    assert response.status_code == 201, response.text
    return response.json()


def process_uploaded(app, version_id, embedder=None):
    with app.state.sessions() as db:
        job=db.scalar(select(IngestionJob).where(IngestionJob.version_id==version_id))
        job.model_key=TestEmbedder.model_key
        db.commit()
    assert process_one(app.state.sessions, embedder or TestEmbedder())


def test_ingestion_private_acl_and_delete_tree(client,app):
    document=upload(client)
    process_uploaded(app,document['version_id'])
    query={'query':'Приватныймаркер','mode':'lexical'}
    sources=client.post('/api/knowledge/search',json=query).json()['sources']
    assert len(sources)==1
    assert sources[0]['document_version_id']==document['version_id']
    assert sources[0]['start_offset']==0 and sources[0]['received_at']
    assert client.get('/api/knowledge/jobs/'+document['job_id']).json()['status']=='completed'
    with TestClient(app) as other:
        account(other,'other@example.com')
        assert other.get('/api/knowledge/documents/'+document['id']).status_code==404
        assert other.get('/api/knowledge/jobs/'+document['job_id']).status_code==404
        assert other.post('/api/knowledge/search',json=query).json()['sources']==[]
        assert other.request('DELETE','/api/knowledge/documents/'+document['id'],json={}).status_code==404
    assert client.request('DELETE','/api/knowledge/documents/'+document['id'],json={}).status_code==204
    with app.state.sessions() as db:
        assert db.get(Document,document['id']) is None
        assert db.get(DocumentVersion,document['version_id']) is None
        assert db.scalar(select(func.count()).select_from(Chunk).where(Chunk.version_id==document['version_id']))==0
        assert db.scalar(select(func.count()).select_from(Embedding))==0
        assert db.get(IngestionJob,document['job_id']) is None


def test_public_requires_admin_and_versions_preserve_old_text(client,app):
    assert client.post('/api/knowledge/documents',json=payload('public')).status_code==403
    actor=client.get('/api/me').json()
    with app.state.sessions() as db:
        db.get(User,actor['id']).is_admin=True
        db.commit()
    document=upload(client,'public')
    process_uploaded(app,document['version_id'])
    new_text='# HTTP\n\nНовыймаркер: повторное выполнение GET имеет одинаковый предполагаемый эффект.'
    response=client.post('/api/knowledge/documents/'+document['id']+'/versions',json=payload('public',new_text))
    assert response.status_code==201
    process_uploaded(app,response.json()['version_id'])
    old_search=client.post('/api/knowledge/search',json={'query':'Приватныймаркер'}).json()
    assert old_search['sources']==[]
    assert client.post('/api/knowledge/search',json={'query':'Новыймаркер'}).json()['sources'][0]['version']==2
    with app.state.sessions() as db:
        assert 'Приватныймаркер' in db.get(DocumentVersion,document['version_id']).text
    with TestClient(app) as other:
        account(other,'other@example.com')
        assert other.post('/api/knowledge/search',json={'query':'Новыймаркер'}).json()['sources']
        assert other.post('/api/knowledge/documents/'+document['id']+'/reindex',json={}).status_code==404


def test_restart_lease_recovery_and_bounded_retry(client,app):
    document=upload(client)
    with app.state.sessions() as db:
        job=db.get(IngestionJob,document['job_id'])
        job.model_key=TestEmbedder.model_key
        db.commit()
        job_id,token=claim(db,TestEmbedder.model_key)
        assert token
        db.get(IngestionJob,job_id).lease_until=time.time()-1
        db.commit()
    # New DB session, as after a killed process; expired lease is reclaimed.
    assert process_one(app.state.sessions,BrokenEmbedder())
    with app.state.sessions() as db:
        job=db.get(IngestionJob,job_id)
        assert job.status=='retry' and job.attempts==2
        assert db.get(DocumentVersion,document['version_id']).status=='text_ready'
        job.available_at=0
        db.commit()
    assert process_one(app.state.sessions,BrokenEmbedder())
    with app.state.sessions() as db:
        assert db.get(IngestionJob,job_id).status=='failed'
        assert db.get(IngestionJob,job_id).attempts==3
    assert not process_one(app.state.sessions,BrokenEmbedder())
    # Text retrieval remains real and available, failed embeddings never become success.
    assert client.post('/api/knowledge/search',json={'query':'Приватныймаркер'}).json()['sources']


@pytest.mark.parametrize('response',[{'embeddings':[[0,0,0]]},{'embeddings':[]},{'embeddings':[[1,2]]},{'bad':1}])
def test_embedding_contract_invalid_response(response):
    adapter=OllamaEmbedder(Settings(embedding_dimensions=3, embedding_digest='a'*64),httpx.MockTransport(
        lambda request:httpx.Response(200,json={'models':[{'name':'nomic-embed-text:latest','digest':'a'*64}]}
                                     if request.url.path=='/api/tags' else response)))
    with pytest.raises(EmbeddingUnavailable):
        adapter.embed(['private document'])


def test_embedding_contract_success_and_timeout():
    def handler(request):
        if request.url.path=='/api/tags':
            return httpx.Response(200,json={'models':[{'name':'nomic-embed-text:latest','digest':'a'*64}]})
        assert request.url.path=='/api/embed'
        assert b'"truncate":false' in request.content
        return httpx.Response(200,json={'embeddings':[[1.0,2.0,3.0]]})
    adapter=OllamaEmbedder(Settings(embedding_dimensions=3, embedding_digest='a'*64),httpx.MockTransport(handler))
    assert adapter.embed(['test'])==[[1.0,2.0,3.0]]
    def timeout(request):
        raise httpx.ReadTimeout('private provider message')
    adapter=OllamaEmbedder(Settings(embedding_dimensions=3, embedding_digest='a'*64),httpx.MockTransport(timeout))
    with pytest.raises(EmbeddingUnavailable,match='embedding_provider_unavailable_or_invalid'):
        adapter.embed(['private text'])


def test_chunk_boundaries_offsets_and_invalid_document(client):
    text='# SQL\n\nОписание определения.\n\n```sql\nSELECT x;\n\nSELECT y;\n```\n\n| a | b |\n| 1 | 2 |'
    chunks=chunk_text(text,max_chars=20)
    assert any('SELECT x;' in c['text'] and 'SELECT y;' in c['text'] for c in chunks)
    assert any('| a | b |\n| 1 | 2 |' in c['text'] for c in chunks)
    assert all(text[c['start_offset']:c['end_offset']]==c['text'] for c in chunks)
    with pytest.raises(Exception,match='бинарные'):
        clean_text('A'*50+'\x00')
    assert client.post('/api/knowledge/documents',json={**payload(),'format':'application/pdf'}).status_code==422
    assert client.post('/api/knowledge/documents',json=payload(text='A'*50+'\x00')).status_code==422
    assert client.post('/api/knowledge/search',json={'query':'HTTP','mode':'vector'}).status_code==503
    assert client.post('/api/knowledge/search',json={'query':'qwertynotfound'}).json()['status']=='no_sources'


def test_seed_is_idempotent_and_contains_real_text(client,app):
    from backend.app.seed import seed
    with app.state.sessions() as db:
        before=db.scalar(select(func.count()).select_from(Chunk))
        seed(db)
        assert db.scalar(select(func.count()).select_from(Chunk))==before
    result=client.post('/api/knowledge/search',json={'query':'идемпотентность','competency_id':'qa-http-methods'}).json()
    assert result['sources'] and result['context_chars']>40
    assert all(s['competency_id']=='qa-http-methods' for s in result['sources'])


def test_document_deleted_during_embedding_is_not_resurrected(client,app):
    document=upload(client)
    class DeletingEmbedder(TestEmbedder):
        def embed(self,texts):
            response=client.request('DELETE','/api/knowledge/documents/'+document['id'],json={})
            assert response.status_code==204
            return super().embed(texts)
    process_uploaded(app,document['version_id'],DeletingEmbedder())
    with app.state.sessions() as db:
        assert db.get(Document,document['id']) is None
        assert db.scalar(select(func.count()).select_from(Embedding))==0
