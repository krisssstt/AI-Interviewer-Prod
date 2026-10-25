"""Metadata registration for migrations; ownership stays in functional modules."""
from .ai.models import AiAttempt, AiQuota, AiSource, AiTask  # noqa: F401
from .competencies.models import Competency, QuestionVersion  # noqa: F401
from .identity.models import AuthSession, RateWindow, User  # noqa: F401
from .knowledge.models import (  # noqa: F401
    Chunk,
    Document,
    DocumentVersion,
    Embedding,
    IngestionJob,
    VersionCompetency,
)
from .learning.models import Favorite, LearningPlan  # noqa: F401
from .training.models import Answer, TrainingSession  # noqa: F401
