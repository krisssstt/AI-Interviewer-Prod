from typing import Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field, HttpUrl

from ..dependencies import current, get_db
from . import service
from .adapters import OllamaEmbedder

router = APIRouter(prefix='/api/knowledge', tags=['knowledge'])


class Upload(BaseModel):
    model_config = ConfigDict(extra='forbid')
    title: str = Field(min_length=2, max_length=200, pattern=r'\S')
    text: str = Field(min_length=40, max_length=30000)
    format: Literal['text/plain', 'text/markdown'] = 'text/markdown'
    scope: Literal['private', 'public'] = 'private'
    competency_id: str = Field(min_length=1, max_length=60)
    source_url: HttpUrl | None = None
    language: Literal['ru', 'en'] = 'ru'
    license: str = Field(min_length=2, max_length=200)


class Search(BaseModel):
    model_config = ConfigDict(extra='forbid')
    query: str = Field(min_length=2, max_length=300)
    competency_id: str | None = Field(default=None, max_length=60)
    mode: Literal['lexical', 'vector', 'hybrid'] = 'lexical'
    limit: int = Field(default=5, ge=1, le=10)


def embedder(request):
    return OllamaEmbedder(request.app.state.settings)


@router.get('/documents')
def documents(actor=Depends(current), db=Depends(get_db)):
    return service.list_documents(db, actor[0])


@router.post('/documents', status_code=201)
def upload(data: Upload, request: Request, actor=Depends(current), db=Depends(get_db)):
    return service.upload(db, actor[0], data, embedder(request).model_key)


@router.get('/documents/{document_id}')
def detail(document_id: str, actor=Depends(current), db=Depends(get_db)):
    return service.detail(db, actor[0].id, document_id)


@router.post('/documents/{document_id}/versions', status_code=201)
def version(document_id: str, data: Upload, request: Request,
            actor=Depends(current), db=Depends(get_db)):
    return service.upload(db, actor[0], data, embedder(request).model_key, document_id)


@router.delete('/documents/{document_id}', status_code=204)
def remove(document_id: str, actor=Depends(current), db=Depends(get_db)):
    service.remove(db, actor[0], document_id)


@router.post('/documents/{document_id}/reindex')
def retry(document_id: str, request: Request, actor=Depends(current), db=Depends(get_db)):
    return service.retry(db, actor[0], document_id, embedder(request).model_key)


@router.get('/jobs/{job_id}')
def job(job_id: str, actor=Depends(current), db=Depends(get_db)):
    return service.job_view(db, actor[0], job_id)


@router.post('/search')
def search(data: Search, request: Request, actor=Depends(current), db=Depends(get_db)):
    return service.search(db, actor[0].id, data.query, data.competency_id,
                          data.mode, embedder(request), data.limit)

