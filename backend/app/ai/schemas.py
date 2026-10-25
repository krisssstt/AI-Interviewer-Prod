"""Strict provider schemas. Expected answers/rubrics never use a public response schema."""
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

Text = Annotated[str, Field(min_length=1, max_length=1800)]


class Strict(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)


class Support(Strict):
    source_id: str = Field(min_length=1, max_length=80)
    quote: str = Field(min_length=10, max_length=500)


class CitedBlock(Strict):
    text: Text
    support: list[Support] = Field(min_length=1, max_length=3)


class Criterion(Strict):
    id: str = Field(pattern=r'^[a-z][a-z0-9_-]{0,39}$')
    description: Text
    max_score: int = Field(ge=1, le=5)
    weight: int = Field(ge=1, le=5)


class Exercise(Strict):
    title: str = Field(min_length=20, max_length=2000)
    kind: Literal['open', 'logs', 'code_analysis']
    criteria: list[Criterion] = Field(min_length=2, max_length=5)
    expected_elements: list[Text] = Field(min_length=1, max_length=8)
    expected_answer: str = Field(min_length=20, max_length=3000)
    hints: list[Text] = Field(min_length=1, max_length=3)
    support: list[Support] = Field(min_length=1, max_length=3)


class LessonOutput(Strict):
    competency_id: str = Field(max_length=60)
    difficulty: Literal['Intern', 'Junior', 'Middle']
    explanation: list[CitedBlock] = Field(min_length=1, max_length=4)
    examples: list[CitedBlock] = Field(min_length=1, max_length=3)
    common_mistakes: list[CitedBlock] = Field(min_length=1, max_length=3)
    exercise: Exercise


class CriterionGrade(Strict):
    criterion_id: str = Field(max_length=40)
    score: int = Field(ge=0, le=5)
    evidence: list[Annotated[str, Field(min_length=1, max_length=1000)]] = Field(max_length=5)
    errors: list[Text] = Field(max_length=5)
    omissions: list[Text] = Field(max_length=5)
    explanation: CitedBlock


class AssessmentOutput(Strict):
    criteria: list[CriterionGrade] = Field(min_length=2, max_length=5)
    recommendations: list[CitedBlock] = Field(min_length=1, max_length=4)
