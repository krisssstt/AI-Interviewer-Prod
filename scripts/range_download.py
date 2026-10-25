"""Bounded parallel HTTPS ranges for large official artifacts on slow connections."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import httpx


def parallel_download(url, target, workers=8, total_size=None):
    target = Path(target)
    if target.exists():
        return
    parts = target.parent / (target.name + '.parts')
    parts.mkdir(parents=True, exist_ok=True)
    with httpx.Client(timeout=90, follow_redirects=True) as client:
        if total_size:
            total = total_size
        else:
            head = client.head(url)
            head.raise_for_status()
            total = int(head.headers['content-length'])
        block = 8 * 1024 * 1024
        intervals = [(index, start, min(total, start + block)) for index, start in enumerate(range(0,total,block))]
        def one(interval):
            index, start, end = interval
            path = parts / str(index)
            if path.exists() and path.stat().st_size == end-start:
                return path
            for attempt in range(5):
                try:
                    with client.stream('GET',url+('&&' if '?' in url else '?')+f'qa_range={start}-{end-1}',
                                       headers={'Range':f'bytes={start}-{end-1}'}) as response:
                        if response.status_code != 206:
                            raise RuntimeError('Server does not support required byte ranges')
                        temporary = path.with_suffix('.partial')
                        with temporary.open('wb') as output:
                            for data in response.iter_bytes(262144):
                                output.write(data)
                    if temporary.stat().st_size != end-start:
                        raise OSError('Incomplete range')
                    temporary.replace(path)
                    return path
                except (httpx.HTTPError, OSError):
                    if attempt == 4:
                        raise
        with ThreadPoolExecutor(max_workers=workers) as pool:
            for count, _ in enumerate(pool.map(one,intervals),1):
                if count % 8 == 0:
                    print(f'Official artifact ranges: {count}/{len(intervals)}',flush=True)
    with target.open('wb') as output:
        for index,_,_ in intervals:
            with (parts/str(index)).open('rb') as source:
                import shutil
                shutil.copyfileobj(source,output,1024*1024)
