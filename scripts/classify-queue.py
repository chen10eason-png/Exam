#!/usr/bin/env python3
"""Spend this Actions run's classification budget across all pending official papers.
A failure is recorded as a failure; nothing is marked AI-classified on error.
"""
import argparse,json,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--questions',type=int,default=48)
    ap.add_argument('--paper',default='')
    a=ap.parse_args()
    if a.questions<0 or a.questions>500:raise SystemExit('questions must be 0..500')
    remaining=a.questions
    files=sorted((ROOT/'data/candidates').glob('*.json'),key=lambda f:(-int(f.stem.split('_')[1]),f.name))
    if a.paper:
        files=[f for f in files if f.stem==a.paper.replace(':','_')]
    ok=0;failed=0
    for f in files:
        if remaining<=0:break
        try:
            v=json.loads(f.read_text(encoding='utf8'))
            pending=sum(q.get('ai',{}).get('status')!='完成' for q in v.get('questions',[]))
        except (OSError,ValueError) as e:
            print(f'INVALID {f}: {e}',file=sys.stderr);failed+=1;continue
        if not pending:continue
        limit=min(remaining,pending,32)
        p=subprocess.run(['node',str(ROOT/'scripts/ai-classify.mjs'),'--file',str(f),'--limit',str(limit)],cwd=ROOT)
        v=json.loads(f.read_text(encoding='utf8'))
        now=sum(q.get('ai',{}).get('status')!='完成' for q in v.get('questions',[]))
        classified=pending-now
        remaining-=classified;ok+=classified
        if p.returncode!=0 or classified<limit:
            failed+=1;print(f'INCOMPLETE {f.name}: {classified}/{limit}',file=sys.stderr)
            break # likely quota exhausted; no repeated API failures this run
    print(f'AI分類完成 {ok} 道，本次預算 {a.questions} 道，處理失敗 {failed} 次；仍待人工品質校驗')
    if failed:sys.exit(1)
if __name__=='__main__':main()
