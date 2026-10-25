"""Import original authors' public GGUF weights when the Ollama registry is unreachable.

These small CPU models are a local integration profile, not a validated grading
configuration. Source commit and SHA256 are recorded; weights never enter Git.
"""
import hashlib
import json
import subprocess
from pathlib import Path

import httpx
from range_download import parallel_download

ROOT=Path(__file__).resolve().parents[1]
TARGET=ROOT/'.runtime/gguf'
MODELS=[
    ('nomic-ai/nomic-embed-text-v1.5-GGUF','nomic-embed-text-v1.5.Q4_K_M.gguf','qa-nomic-q4'),
    ('Qwen/Qwen2.5-0.5B-Instruct-GGUF','qwen2.5-0.5b-instruct-q4_k_m.gguf','qa-qwen-small'),
]


def main():
    TARGET.mkdir(parents=True,exist_ok=True)
    provenance=[]
    with httpx.Client(timeout=60,follow_redirects=True) as client:
        for repo,filename,name in MODELS:
            response=client.get('https://huggingface.co/api/models/'+repo+'?blobs=true')
            response.raise_for_status()
            metadata=response.json()
            entry=next(f for f in metadata['siblings'] if f['rfilename']==filename)
            expected=entry['lfs']['sha256']
            size=entry['lfs']['size']
            commit=metadata['sha']
            url=f'https://huggingface.co/{repo}/resolve/{commit}/{filename}'
            path=TARGET/filename
            print('Downloading original model:',repo,filename,size,flush=True)
            parallel_download(url,path,total_size=size)
            with path.open('rb') as source:
                actual=hashlib.file_digest(source,'sha256').hexdigest()
            if actual!=expected:
                raise ValueError('GGUF SHA256 verification failed')
            modelfile=TARGET/(name+'.Modelfile')
            modelfile.write_text('FROM '+path.as_posix()+'\n',encoding='utf-8')
            subprocess.run([str(ROOT/'.runtime/ollama/ollama.exe'),'create',name,'-f',str(modelfile)],check=True)
            provenance.append({'model':name,'repo':repo,'commit':commit,'file':filename,'sha256':actual,'bytes':size})
            (ROOT/'config/local-model-provenance.json').write_text(json.dumps(provenance,indent=2)+'\n',encoding='utf-8')
    print('Local CPU integration models imported. Pin digests before application use.')


if __name__=='__main__':
    main()
