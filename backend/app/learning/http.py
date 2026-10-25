from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from ..competencies.models import Competency
from ..dependencies import current, get_db
from ..errors import RuleError
from . import service
from .models import Favorite

router = APIRouter(prefix='/api', tags=['learning'])


@router.get('/plan')
def plan(actor=Depends(current), db=Depends(get_db)):
    return service.current_plan(db, actor[0].id)


@router.get('/analytics')
def analytics(actor=Depends(current), db=Depends(get_db)):
    return service.analytics(db, actor[0].id)


@router.get('/favorites')
def favorites(actor=Depends(current), db=Depends(get_db)):
    return list(db.scalars(select(Favorite.competency_id).where(Favorite.user_id == actor[0].id)))


@router.put('/favorites/{competency_id}', status_code=204)
def add_favorite(competency_id: str, actor=Depends(current), db=Depends(get_db)):
    if not db.get(Competency, competency_id):
        raise RuleError('Компетенция не найдена.', 404)
    if not db.get(Favorite, (actor[0].id, competency_id)):
        try:
            db.add(Favorite(user_id=actor[0].id, competency_id=competency_id))
            db.commit()
        except IntegrityError:
            db.rollback()  # Concurrent identical PUT is still success.


@router.delete('/favorites/{competency_id}', status_code=204)
def remove_favorite(competency_id: str, actor=Depends(current), db=Depends(get_db)):
    favorite = db.get(Favorite, (actor[0].id, competency_id))
    if favorite:
        db.delete(favorite)
        db.commit()

