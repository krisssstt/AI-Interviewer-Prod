"""Metadata registration for migrations; ownership stays in functional modules."""
from .competencies.models import Competency, QuestionVersion  # noqa: F401
from .identity.models import AuthSession, RateWindow, User  # noqa: F401
from .learning.models import Favorite, LearningPlan  # noqa: F401
from .training.models import Answer, TrainingSession  # noqa: F401
