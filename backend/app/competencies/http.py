from fastapi import APIRouter, Depends
from sqlalchemy import select

from ..dependencies import current, get_db
from .models import Competency

router = APIRouter(prefix='/api/catalog', tags=['competencies'], dependencies=[Depends(current)])


@router.get('')
def catalog(db=Depends(get_db)):
    return {'directions': [{'id': 'qa', 'name': 'QA Engineer', 'status': 'objective-practice-preview'}],
            'backlog': ['Backend Developer', 'Frontend Developer', 'Data Analyst'],
            'competencies': [{key: getattr(comp, key) for key in (
                'id', 'topic', 'description', 'prerequisites', 'levels', 'task_types', 'criteria', 'sources')}
                for comp in db.scalars(select(Competency).order_by(Competency.id))]}

