from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select

from ..dependencies import current, get_db
from . import service
from .models import TrainingSession

router = APIRouter(prefix='/api/sessions', tags=['training'])


class CreateSession(BaseModel):
    model_config = ConfigDict(extra='forbid')
    mode: Literal['diagnostic', 'practice', 'exam']
    competency_id: str | None = Field(default=None, max_length=60)
    request_key: str = Field(min_length=8, max_length=64)


class SubmitAnswer(BaseModel):
    model_config = ConfigDict(extra='forbid')
    question_version_id: str = Field(min_length=1, max_length=80)
    value: str = Field(min_length=1, max_length=10000)
    request_key: str = Field(min_length=8, max_length=64)


@router.post('', status_code=201)
def create(data: CreateSession, actor=Depends(current), db=Depends(get_db)):
    return service.view(db, service.create(db, actor[0].id, data.mode, data.competency_id, data.request_key))


@router.get('')
def history(actor=Depends(current), db=Depends(get_db)):
    sessions = db.scalars(select(TrainingSession).where(TrainingSession.user_id == actor[0].id)
                          .order_by(TrainingSession.created_at.desc()).limit(100)).all()
    # No report payload for list; source snapshots are returned only by detail endpoint.
    return [{'id': s.id, 'mode': s.mode, 'status': s.status, 'position': s.position,
             'total': len(s.questions), 'created_at': s.created_at, 'finished_at': s.finished_at}
            for s in sessions]


@router.get('/{session_id}')
def detail(session_id: str, actor=Depends(current), db=Depends(get_db)):
    return service.view(db, service.owned(db, actor[0].id, session_id))


@router.post('/{session_id}/answers')
def answer(session_id: str, data: SubmitAnswer, actor=Depends(current), db=Depends(get_db)):
    session = service.submit(db, actor[0].id, session_id, data.question_version_id,
                             data.value, data.request_key)
    return service.view(db, session)


@router.post('/{session_id}/hint')
def hint(session_id: str, actor=Depends(current), db=Depends(get_db)):
    return service.hint(db, actor[0].id, session_id)


@router.post('/{session_id}/state/{action}')
def state(session_id: str, action: Literal['pause', 'resume', 'finish'],
          actor=Depends(current), db=Depends(get_db)):
    return service.view(db, service.change_state(db, actor[0].id, session_id, action))

