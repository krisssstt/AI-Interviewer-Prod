`python -m backend.app.model_lock` creates `model-lock.json` here from installed
Ollama models. This file contains names and public weight digests, never credentials.
Review and commit the lock after selecting models. Reindex after changing it.
No weights are downloaded automatically. Compose mounts this directory read-only.
