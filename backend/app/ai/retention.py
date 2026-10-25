from sqlalchemy import delete, select

from ..knowledge.models import DocumentVersion
from .models import AiSource, AiTask


def purge_private_document(db, document):
    """Explicit user deletion removes private source snapshots and derived artifacts.

    Public snapshots remain immutable for previous results. No score is recalculated.
    Descendant tasks and attempts are removed through FK cascade.
    """
    if document.scope == 'private':
        affected = select(AiSource.task_id).join(DocumentVersion).where(
            DocumentVersion.document_id == document.id)
        db.execute(delete(AiTask).where(AiTask.id.in_(affected)).execution_options(synchronize_session=False))
