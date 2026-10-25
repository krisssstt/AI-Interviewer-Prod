from typing import Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select

from ..dependencies import current, get_db
from . import application
from .models import AiTask

router = APIRouter(prefix='/api/study', tags=['generative-learning'])


class LessonRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    competency_id: str = Field(min_length=1, max_length=60)
    difficulty: Literal['Intern', 'Junior', 'Middle'] = 'Intern'
    query: str = Field(default='', max_length=300)
    include_private: bool = False
    previous_submission_id: str | None = Field(default=None, max_length=36)
    request_key: str = Field(min_length=8, max_length=64)


class AnswerRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    answer: str = Field(min_length=1, max_length=10000)
    request_key: str = Field(min_length=8, max_length=64)


@router.post('/lessons', status_code=202)
def lesson(data: LessonRequest, actor=Depends(current), db=Depends(get_db)):
    return application.view(db, application.create_lesson(db, actor[0].id, data))


@router.get('/tasks')
def history(actor=Depends(current), db=Depends(get_db)):
    tasks = db.scalars(select(AiTask).where(AiTask.user_id == actor[0].id)
                       .order_by(AiTask.created_at.desc()).limit(50)).all()
    return [{'id': t.id, 'kind': t.kind, 'status': t.status, 'parent_id': t.parent_id,
             'created_at': t.created_at, 'competency_id': t.request['competency_id']} for t in tasks]


@router.get('/tasks/{task_id}')
def detail(task_id: str, actor=Depends(current), db=Depends(get_db)):
    return application.view(db, application.owned(db, actor[0].id, task_id))


@router.post('/lessons/{lesson_id}/answers', status_code=202)
def answer(lesson_id: str, data: AnswerRequest, actor=Depends(current), db=Depends(get_db)):
    return application.view(db, application.submit(db, actor[0].id, lesson_id, data.answer, data.request_key))


@router.post('/lessons/{lesson_id}/hint')
def hint(lesson_id: str, actor=Depends(current), db=Depends(get_db)):
    return application.get_hint(db, actor[0].id, lesson_id)


@router.post('/tasks/{task_id}/retry')
def retry(task_id: str, request: Request, actor=Depends(current), db=Depends(get_db)):
    return application.view(db, application.retry(db, actor[0].id, task_id,
                                                  request.app.state.settings.ai_attempt_limit))
