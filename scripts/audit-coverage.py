#!/usr/bin/env python3
"""Complete-archive audit. Missing documents and missed question numbers cannot be hidden.

Never treats an unverified split, AI label, or paper link as a completed question.
"""
from __future__ import annotations
import json,re,argparse
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--out',type=Path,default=ROOT/'data/coverage.json')
    args=ap.parse_args()
    src=(ROOT/'data/official-links.js').read_text(encoding='utf8')
    m=re.search(r'window\.ATLAS_OFFICIAL_PDFS\s*=\s*({[\s\S]*?})\s*;',src)
    if not m:raise SystemExit('找不到官方索引')
    index=json.loads(m.group(1))
    papers=[]
    status=Counter()
    for key,links in sorted(index.items(),key=lambda x:x[0]):
        if key.count(':')!=2:continue
        exam,year,subject=key.split(':',2)
        pdfs=[x for x in links if x.get('label')=='官方試題 PDF']
        answer=[x for x in links if '答案' in x.get('label','')]
        entry={'key':key,'exam':exam,'year':int(year),'subject':subject,'sourceUrl':pdfs[0]['url'] if pdfs else '',
               'hasAnswerDocument':bool(answer),'totalQuestions':None,'parsedQuestions':0,'aiClassified':0,
               'verifiedQuestions':0,'missingQuestionNumbers':[],'notes':[]}
        f=ROOT/'data/candidates'/f'{exam}_{year}_{subject}.json'
        if not pdfs:
            entry['status']='無試卷連結';entry['notes'].append('官方資料沒有可用試題 PDF')
        elif not f.exists():
            failure=ROOT/'data/failures'/f'{exam}_{year}_{subject}.json'
            if failure.exists():
                entry['status']='擷取失敗待重試'
                try:
                    v=json.loads(failure.read_text(encoding='utf8'))
                    entry['notes']=[str(v.get('lastError','來源讀取失敗'))[:200],'下次重試：'+str(v.get('nextRetryAt','未知'))]
                except (ValueError,OSError):entry['notes']=['失敗記錄無法讀取']
            else:entry['status']='未擷取'
        else:
            try:
                item=json.loads(f.read_text(encoding='utf8'))
                qs=item.get('questions',[])
                no=[q.get('questionNo') for q in qs if isinstance(q.get('questionNo'),int)]
                if no:
                    unique=set(no)
                    entry['missingQuestionNumbers']=[i for i in range(1,max(unique)+1) if i not in unique]
                    if len(no)!=len(unique):entry['notes'].append('重複題號')
                    entry['parsedQuestions']=len(unique)
                entry['aiClassified']=sum(q.get('ai',{}).get('status')=='完成' for q in qs)
                entry['verifiedQuestions']=sum(q.get('reviewed') is True and q.get('answerVerified') is True and q.get('sourceVerified') is True for q in qs)
                # No official question count exists yet. Parsed count is NOT the expected count.
                entry['totalQuestions']=item.get('officialQuestionCount')
                if entry['totalQuestions'] is None:entry['notes'].append('尚未核對官方完整題數，可能漏掉試卷尾部或非選題')
                elif len(unique)!=entry['totalQuestions']:entry['notes'].append('擷取題數與官方題數不一致')
                if entry['missingQuestionNumbers']:entry['notes'].append('題號中斷')
                if entry['verifiedQuestions']==entry['totalQuestions'] and entry['totalQuestions'] is not None and not entry['notes']:
                    entry['status']='全部核對完成'
                elif entry['aiClassified'] == len(qs) and qs:entry['status']='AI分類待核對'
                else:entry['status']='已擷取待處理'
            except (ValueError, OSError, TypeError) as ex:
                entry['status']='資料異常';entry['notes'].append(str(ex))
        status[entry['status']]+=1
        papers.append(entry)
    totals={
      'sourcePapersIndexed':len(papers),'sourcePapersWithPdf':sum(bool(p['sourceUrl']) for p in papers),
      'papersWithCandidates':sum(p['parsedQuestions']>0 for p in papers),
      'extractedCandidateQuestions':sum(p['parsedQuestions'] for p in papers),
      'aiClassifiedQuestions':sum(p['aiClassified'] for p in papers),
      'verifiedQuestions':sum(p['verifiedQuestions'] for p in papers),
      'fullyVerifiedPapers':sum(p['status']=='全部核對完成' for p in papers),
      'papersMissing':sum(p['status']!='全部核對完成' for p in papers),
      'statusCounts':dict(status)
    }
    data={'schema':'exam-atlas-full-coverage-v1','source':'大考中心一般試題官方列表','completionDefinition':'每份官方原卷的所有題目都已核對，分類及答案經驗證','totals':totals,'papers':papers,
      'limitations':['官方索引未必涵蓋官網未公開或已下架的所有試卷','PDF 擷取題數不能代替原卷題數；需逐份核對','試題 PDF 連結不能算作逐題收錄','AI 自動分類並非答案與圖片驗證']}
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    (ROOT/'data/coverage.js').write_text('// 自動生成：全歷屆完整性稽核；每題驗證完成才能計入正式題庫。\nwindow.ATLAS_COVERAGE='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf8')
    print(json.dumps(totals,ensure_ascii=False,indent=2))
    return 0
if __name__=='__main__':raise SystemExit(main())
