#!/usr/bin/env python3
"""Generate safe, compact public summary. All auto-extracted items remain review-required."""
from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
rows=[]
for f in sorted((root/'data/candidates').glob('*.json')):
    try:item=json.loads(f.read_text(encoding='utf8'))
    except (ValueError,OSError): continue
    if item.get('schema')!='exam-atlas-candidates-v1':continue
    qs=[]
    for q in item.get('questions',[]):
        a=q.get('ai') or {}
        qs.append({'no':q.get('questionNo'), 'page':q.get('page'),'sourceUrl':q.get('sourceUrl',''),
          'topicIds':a.get('topicIds',[]),'difficulty':a.get('difficulty'),
          'confidence':a.get('confidence'), 'concept':a.get('reason',''),
          'issues':q.get('issues',[])[:3], 'aiStatus':a.get('status','尚未AI分類'),
          'reviewed':False})
    rows.append({'exam':item.get('exam'),'year':item.get('year'), 'paperSubject':item.get('paperSubject'),
      'sourceUrl':item.get('sourceUrl'), 'extractedCount':item.get('extractedCount'),
      'aiCount':sum(q['aiStatus']=='完成' for q in qs), 'questions':qs})
path=root/'data/candidate-index.js'
path.write_text('// 自動產生：AI分類僅為候選，不等於已校對可作答題。\nwindow.ATLAS_CANDIDATE_INDEX='+json.dumps(rows,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf8')
print(f'Updated {path.name}: {len(rows)} papers, {sum(len(r["questions"]) for r in rows)} candidates')
