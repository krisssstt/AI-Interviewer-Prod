"""Development-only lexical/chunk-size experiment on a temporary migrated database.

No model calls. Relevance by authored competency label, not expert judgement.
Final split is deliberately not accepted by this tuning command.
"""
import json
import tempfile
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import delete, select

from backend.app.config import Settings
from backend.app.db import database
from backend.app.knowledge.adapters import OllamaEmbedder
from backend.app.knowledge.domain import chunk_text
from backend.app.knowledge.models import Chunk, DocumentVersion, Embedding
from backend.app.knowledge.service import search
from backend.app.seed import seed


def main():
    root=Path(__file__).resolve().parents[1]
    dataset=json.loads((root/'evaluation/retrieval-dev.json').read_text(encoding='utf-8'))
    results=[]
    # TemporaryDirectory context removes only its own newly-created isolated directory.
    with tempfile.TemporaryDirectory(prefix='qa-retrieval-eval-') as directory:
        url='sqlite:///'+(Path(directory)/'evaluation.db').as_posix()
        config=Config(str(root/'alembic.ini'))
        config.attributes['database_url']=url
        command.upgrade(config,'head')
        engine,sessions=database(url)
        try:
            with sessions() as db:
                seed(db)
                for size in [800,1600,2400]:
                    db.execute(delete(Embedding))
                    db.execute(delete(Chunk))
                    for version in db.scalars(select(DocumentVersion)):
                        db.add_all([Chunk(version_id=version.id,**part) for part in chunk_text(version.text,size)])
                    db.commit()
                    reciprocal,recall=[],[]
                    for query in dataset['queries']:
                        found=search(db,'evaluation-no-private-user',query['query'],None,'lexical',
                                     OllamaEmbedder(Settings()),limit=5)['sources']
                        ranks=[i for i,s in enumerate(found,1) if s['competency_id']==query['competency_id']]
                        # Document-level relevance, not chunk-level: this corpus has one document per competency.
                        recall.append(int(bool(ranks)))
                        reciprocal.append(1/min(ranks) if ranks else 0)
                    results.append({'max_chars':size,'Recall@5_document':sum(recall)/len(recall),
                                    'MRR@5_document':sum(reciprocal)/len(reciprocal),
                                    'query_count':len(recall)})
        finally:
            engine.dispose()
    report={'split':'development','labels':dataset['provenance'],'method':'SQLite lexical overlap v1',
            'corpus':'12 original project-authored QA notes, seeded v1',
            'limitations':['Not expert labels','Not a vector/hybrid or LLM experiment',
                            'Final split not run','max_chars is characters, not tokens',
                            'Tiny corpus, no claim of generalization'],
            'results':results}
    output=root/'docs/experiments/retrieval-development.json'
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))


if __name__=='__main__':
    main()
