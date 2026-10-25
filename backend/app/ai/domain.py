"""Rules for citations, fixed rubrics and scores: no HTTP, SQLAlchemy or model SDK."""
from decimal import ROUND_HALF_UP, Decimal


class InvalidArtifact(Exception):
    pass


def validate_support(items, sources):
    available = {source['id']: source['text'] for source in sources}
    for item in items:
        if item.source_id not in available or item.quote not in available[item.source_id]:
            raise InvalidArtifact('unverifiable_citation')


def validate_lesson(lesson, request, sources):
    if lesson.competency_id != request['competency_id'] or lesson.difficulty != request['difficulty']:
        raise InvalidArtifact('lesson_scope_mismatch')
    ids = [criterion.id for criterion in lesson.exercise.criteria]
    if len(set(ids)) != len(ids):
        raise InvalidArtifact('duplicate_criterion')
    for block in [*lesson.explanation, *lesson.examples, *lesson.common_mistakes]:
        validate_support(block.support, sources)
    validate_support(lesson.exercise.support, sources)


def validate_assessment(assessment, snapshot, answer, sources):
    rubric = {criterion['id']: criterion for criterion in snapshot['criteria']}
    ids = [grade.criterion_id for grade in assessment.criteria]
    if set(ids) != set(rubric) or len(ids) != len(rubric):
        raise InvalidArtifact('rubric_mismatch')
    weighted, total = Decimal(0), Decimal(0)
    for grade in assessment.criteria:
        criterion = rubric[grade.criterion_id]
        if grade.score > criterion['max_score']:
            raise InvalidArtifact('score_out_of_bounds')
        if grade.score > 0 and not grade.evidence:
            raise InvalidArtifact('missing_answer_evidence')
        if any(evidence not in answer for evidence in grade.evidence):
            raise InvalidArtifact('fabricated_answer_evidence')
        validate_support(grade.explanation.support, sources)
        weighted += Decimal(grade.score) / Decimal(criterion['max_score']) * criterion['weight']
        total += criterion['weight']
    for block in assessment.recommendations:
        validate_support(block.support, sources)
    return int((100 * weighted / total).quantize(Decimal(1), rounding=ROUND_HALF_UP))
