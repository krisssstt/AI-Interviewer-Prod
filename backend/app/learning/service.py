import time

from sqlalchemy import select

from ..competencies.models import Competency
from ..identity.models import User
from ..training.models import Answer, TrainingSession
from .models import LearningPlan


def statistics(db, user_id):
    rows = db.execute(select(Answer, TrainingSession).join(TrainingSession).where(
        TrainingSession.user_id == user_id,
        TrainingSession.status.in_(['completed', 'expired']))).all()
    result = {}
    for answer, session in rows:
        question = next(q for q in session.questions if q['id'] == answer.question_version_id)
        values = result.setdefault(question['competency_id'], [])
        values.append({'score': answer.score, 'question_slug': question['id'].rsplit(':v', 1)[0],
                       'hint_used': answer.hint_used,
                       'mode': session.mode, 'at': answer.created_at})
    return result


def update_plan(db, user_id):
    # Serialize plan version allocation for a user on PostgreSQL.
    db.scalar(select(User).where(User.id == user_id).with_for_update())
    latest = db.scalar(select(LearningPlan).where(LearningPlan.user_id == user_id)
                       .order_by(LearningPlan.version.desc()).limit(1))
    stats = statistics(db, user_id)
    items = []
    for comp in db.scalars(select(Competency).order_by(Competency.id)):
        answers = stats.get(comp.id, [])
        independent = sorted([a for a in answers if not a['hint_used']], key=lambda a: a['at'])
        recent = independent[-3:]
        distinct = len({a['question_slug'] for a in independent})
        mean = round(sum(a['score'] for a in recent) / len(recent)) if recent else None
        confirmed = len(recent) >= 3 and distinct >= 3 and mean >= 80
        reason = ('Недостаточно разных самостоятельных заданий: нужно минимум 3.' if distinct < 3
                  else 'Средний балл последних 3 самостоятельных ответов ниже 80.' if not confirmed
                  else 'Учебное правило выполнено; повторите через 14 дней.')
        stale = bool(recent and time.time() - recent[-1]['at'] > 14 * 86400)
        prerequisites = [p for p in comp.prerequisites if len([
            a for a in stats.get(p, []) if not a['hint_used'] and a['score'] >= 80]) < 3]
        items.append({'competency_id': comp.id, 'topic': comp.topic,
                      'description': comp.description, 'reason': reason,
                      'attempts': len(answers), 'independent_attempts': len(independent),
                      'distinct_questions': distinct,
                      'score': mean, 'confidence': 'учебная' if confirmed else 'недостаточно данных',
                      'status': 'review' if stale else 'confirmed' if confirmed else 'learn',
                      'prerequisites_to_review': prerequisites,
                      'priority': 0 if not answers else 1 if stale else 3 if confirmed else 2})
    items.sort(key=lambda item: (item['priority'], item['score'] or 0, item['competency_id']))
    plan = LearningPlan(user_id=user_id, version=latest.version + 1 if latest else 1, items=items)
    db.add(plan)
    db.flush()
    return plan


def current_plan(db, user_id):
    plan = db.scalar(select(LearningPlan).where(LearningPlan.user_id == user_id)
                     .order_by(LearningPlan.version.desc()).limit(1))
    if not plan:
        plan = update_plan(db, user_id)
        db.commit()
    return {'id': plan.id, 'version': plan.version, 'rules_version': plan.rules_version,
            'created_at': plan.created_at, 'items': plan.items}


def analytics(db, user_id):
    stats = statistics(db, user_id)
    return {'competencies': stats,
            'modes': {mode: {'answers': len(values), 'mean': round(sum(a['score'] for a in values)
                         / len(values)) if values else None}
                      for mode in ['diagnostic', 'practice', 'exam']
                      for values in [[a for group in stats.values() for a in group if a['mode'] == mode]]},
            'notice': 'Учебные показатели, не подтверждение профессиональной квалификации.'}

