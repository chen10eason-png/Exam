#!/usr/bin/env python3
"""Strict completeness audit of every downloaded paper against upstream manifest.

Exit nonzero unless every source partition is present, has exact declared row count,
unique IDs, and includes a transparent quality summary. 'Complete inventory'
does NOT mean verified text/formula/diagram or AI classification.
"""
import json
from pathlib import Path
from collections import Counter
import argparse

ROOT=Path(__file__).resolve().parents[1]
def audit(root):
    target=root/'data/archive'
    manifest_path=target/'source-manifest.json'
    if not manifest_path.is_file():
        return {'status':'source-manifest-missing','completeInventory':False,'expectedRecords':None,'expectedPapers':None,'missing':[],'errors':['沒有已下載的官方歷屆資料分卷清單']}
    manifest=json.loads(manifest_path.read_text(encoding='utf8'))
    expected=manifest.get('files',{})
    errors=[]; missing=[]; counts=Counter(); total=0; papers=0
    for key,count in sorted(expected.items()):
        parts=key.split('/')
        if len(parts)!=5 or parts[0:2]!=['data','items'] or '..' in key:
            errors.append(f'invalid manifest path: {key}');continue
        exam,year,subject=parts[2],parts[3],parts[4].removesuffix('.jsonl')
        dest=target/'papers'/f'{exam}_{year}_{subject}.json'
        if not dest.exists():missing.append(key);continue
        try:
            obj=json.loads(dest.read_text(encoding='utf8'))
            rows=obj.get('questions',[])
            if obj.get('sourceFile')!=key or len(rows)!=count:raise ValueError(f'wrong source or row count (expected {count}, got {len(rows)})')
            ids=[str(q.get('id')) for q in rows]
            if len(set(ids))!=len(ids):raise ValueError('duplicate IDs')
            papers+=1;total+=len(rows)
            for q in rows:
                if q.get('readable'):counts['readable']+=1
                else:counts['missingText']+=1
                if q.get('hasAnswerOptions'):counts['optionKeyMatches']+=1
                else:counts['needsAnswerOrOptions']+=1
                if q.get('aiClassified') and q.get('topicIds'):counts['aiClassified']+=1
                else:counts['needsAIClassification']+=1
                if q.get('reviewed') and q.get('sourceVerified'):counts['verified']+=1
                else:counts['needsOriginalReview']+=1
                if q.get('issues'):counts['hasExtractionFlags']+=1
        except (ValueError,TypeError,OSError) as exc:errors.append(f'{key}: {exc}')
    declared_sum=sum(expected.values())
    complete=(not errors and not missing and total==declared_sum and papers==len(expected) and declared_sum==manifest.get('total_rows'))
    return {'status':'complete-inventory-only' if complete else 'incomplete-inventory',
      'completeInventory':complete,'completeReviewedCorpus':complete and counts['verified']==total and counts['aiClassified']==total,
      'expectedPapers':len(expected),'expectedRecords':declared_sum,
      'downloadedPapers':papers,'downloadedRecords':total,
      'missingPapers':len(missing),'missing':missing,
      'errors':errors,'quality':dict(counts)}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--root',type=Path,default=ROOT);ap.add_argument('--strict',action='store_true');a=ap.parse_args()
    report=audit(a.root)
    out=a.root/'data/archive/audit.json';out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(json.dumps({k:v for k,v in report.items() if k not in ('missing','errors')},ensure_ascii=False,indent=2))
    print('Missing papers:',report.get('missingPapers',len(report['missing'])),'Errors:',len(report['errors']))
    if a.strict and not report['completeReviewedCorpus']:raise SystemExit(2)
if __name__=='__main__':main()
