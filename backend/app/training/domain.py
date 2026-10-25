from ..errors import RuleError

MODES = {'diagnostic', 'practice', 'exam'}
TRANSITIONS = {'active': {'paused', 'completed'}, 'paused': {'active', 'completed'}}


def transition(current, target):
    if current == target:
        return
    if target not in TRANSITIONS.get(current, set()):
        raise RuleError('Недопустимый переход состояния сессии.')


def evaluate(question, value):
    """Only objective grading. Open answers must use a separate, validated evaluator."""
    if question['type'] == 'choice':
        if value not in [str(i) for i in range(len(question['options']))]:
            raise RuleError('Выберите один из предложенных вариантов.', 422)
        score = 100 if value == str(question['correct']) else 0
    elif question['type'] == 'short':
        normalized = ' '.join(value.casefold().split())
        score = 100 if normalized in question['accepted'] else 0
    else:
        raise RuleError('Оценщик открытых ответов пока не подключён.', 503)
    return score, {'method': 'objective-v1', 'status': 'completed',
                   'criteria': [{'id': 'correctness', 'score': score}],
                   'sources': question['sources'], 'model': None, 'prompt_version': None,
                   'parameters': {}, 'question_version_id': question['id']}

