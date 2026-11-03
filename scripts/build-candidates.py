#!/usr/bin/env python3
"""Import CEEC PDF into traceable, UNREVIEWED question candidates.

Safe-by-default behavior: downloads only official www.ceec.edu.tw PDFs, never guesses
answers and never publishes an OCR/transcription as a verified quiz question.
Optional AI classification runs through scripts/ai-classify.mjs separately.
"""
from __future__ import annotations
import argparse, hashlib, json, re, sys, urllib.request, urllib.parse
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data' / 'official-links.js'
OUT = ROOT / 'data' / 'candidates'
USER_AGENT = 'ExamAtlasSourceImporter/0.2 (+https://github.com; small-batch education project)'

def parse_index(path=SOURCE):
    s=path.read_text(encoding='utf8')
    match=re.search(r'window\.ATLAS_OFFICIAL_PDFS\s*=\s*({[\s\S]*?})\s*;',s)
    if not match: raise ValueError('尚無官方 PDF 索引；請先執行 node scripts/sync-official.mjs')
    return json.loads(match.group(1))

def safe_ceec_pdf(url):
    p=urllib.parse.urlparse(url)
    return p.scheme=='https' and p.hostname=='www.ceec.edu.tw' and p.path.lower().endswith('.pdf')

def download_pdf(url, max_bytes=16_000_000):
    if not safe_ceec_pdf(url): raise ValueError('禁止非大考中心 PDF 網址')
    req=urllib.request.Request(url,headers={'User-Agent':USER_AGENT,'Accept':'application/pdf'})
    with urllib.request.urlopen(req,timeout=28) as f:
        data=f.read(max_bytes+1)
        if len(data)>max_bytes: raise ValueError('試卷超過檔案大小限制')
        if not data.startswith(b'%PDF'):raise ValueError('來源未傳回 PDF')
        return data

def tidy(text):
    return re.sub(r'[ \t]+',' ',text).strip()

# Leading question numbers, not numerals in paragraphs, headings or option labels.
QUESTION_START=re.compile(r'^\s*(\d{1,2})\s*[\.．、]\s*(?=\S)')
OPTION_START=re.compile(r'^\s*[(（][1-8][)）]')
SECTION=re.compile(r'單選題|多選題|選填題|非選擇題|綜合題|第[壹貳參肆伍]部分')

def split_pdf(pdf_bytes):
    import fitz
    doc=fitz.open(stream=pdf_bytes,filetype='pdf')
    questions=[]
    section='未判定'
    current=None
    for page_index,page in enumerate(doc):
        content=page.get_text('text',sort=True)
        lines=[tidy(x) for x in content.splitlines() if x.strip()]
        for line in lines:
            # Section markers may occur on same page as questions.
            sm=SECTION.search(line)
            if sm and len(line)<58: section=sm.group(0)
            m=QUESTION_START.match(line)
            if m and len(line)<150 and not OPTION_START.match(line):
                num=int(m.group(1))
                # Require monotone question numbers; restart/duplicate often means a header or another subquestion.
                if 1<=num<=80 and (current is None and num<=3 or current is not None and num==current['number']+1):
                    if current: questions.append(current)
                    current={'number':num,'page':page_index+1,'section':section,'lines':[line[m.end():]],'flags':[]}
                    continue
            if current:
                current['lines'].append(line)
        if current and page_index == len(doc)-1:
            questions.append(current)
    if not questions:return []
    out=[]
    for c in questions:
        text='\n'.join(c.pop('lines')).strip()
        # Footer and end matter after last question may be included; preserve uncertainty.
        flags=[]
        if len(text)<28: flags.append('文字過短／公式可能未擷取')
        if len(text)>3600: flags.append('題組或跨頁擷取可能混入其他內容')
        if re.search(r'[□�◌]',text):flags.append('含 PDF 特殊數學符號，需對照原卷')
        if '圖' in text or '表' in text:flags.append('可能含圖表，須逐圖核對')
        if not re.search(r'\(1\)|（1）|\(A\)|（A）',text):flags.append('選項未完整辨認或為非選題')
        out.append({'questionNo':c['number'],'page':c['page'],'section':c['section'],
          'rawText':text,'textSha256':hashlib.sha256(text.encode()).hexdigest(),
          'issues':flags,'status':'待複核','reviewed':False,'tags':[],'difficulty':None})
    return out

def normalize_subject(subject):
    if subject.startswith('數學'):return '數學'
    if subject in ('國文','國綜','國寫'):return '國文'
    if subject=='公民與社會':return '公民'
    if subject in ('自然','社會'):
        return None  # Mixed subject: AI must assess question-by-question.
    return subject

def create_candidates(index, key, pdf_bytes):
    exam,year,subject=key.split(':',2)
    records=split_pdf(pdf_bytes)
    url=next(x['url'] for x in index[key] if x['label']=='官方試題 PDF')
    return {'schema':'exam-atlas-candidates-v1','exam':exam,'year':int(year),'paperSubject':subject,
      'defaultSubject':normalize_subject(subject),'sourceUrl':url,'sourceIndex':'https://www.ceec.edu.tw/xmfile?xsmsid='+('0J052424829869345634' if exam=='學測' else '0J052427633128416650'),
      'sourceSha256':hashlib.sha256(pdf_bytes).hexdigest(),'parser':'pymupdf-heuristic-v1',
      'status':'未複核','extractedCount':len(records),'questions':[
        {**r,'id':f'ceec-{exam}-{year}-{subject}-{r["questionNo"]:02d}', 'sourceUrl':url+'#page='+str(r['page'])}
        for r in records]}

def main():
    ap=argparse.ArgumentParser(description='CEEC 官方試題 → 待複核分類候選檔')
    ap.add_argument('--key',default='',help='學測:115:數學A；空白時從尚未匯入的索引依序處理')
    ap.add_argument('--max-papers',type=int,default=3)
    ap.add_argument('--fixture-pdf',type=Path,help='測試用 PDF（不需下載）')
    ap.add_argument('--retry-days',type=int,default=7,help='失敗的試卷至少間隔幾天重試')
    ap.add_argument('--out-dir',type=Path,default=OUT)
    args=ap.parse_args()
    index=parse_index()
    if args.key and args.key not in index:raise ValueError('索引尚無這份試卷：'+args.key)
    if args.max_papers<1 or args.max_papers>20:raise ValueError('單次處理上限 20 份，避免造成官方流量負擔')
    keys=[args.key] if args.key else sorted(index,key=lambda x:(-int(x.split(':')[1]),x))
    args.out_dir.mkdir(parents=True,exist_ok=True)
    failures_dir=ROOT/'data/failures'
    failures_dir.mkdir(parents=True,exist_ok=True)
    attempted=0; written=0; failed=0
    for key in keys:
        exam,year,subject=key.split(':',2)
        dest=args.out_dir/(f'{exam}_{year}_{subject}.json')
        if dest.exists() and not args.key:continue
        fail_path=failures_dir/(f'{exam}_{year}_{subject}.json')
        if fail_path.exists() and not args.key and not args.fixture_pdf:
            try:
                fail=json.loads(fail_path.read_text(encoding='utf8'))
                next_retry=datetime.fromisoformat(fail['nextRetryAt'])
                if datetime.now(timezone.utc)<next_retry:continue
            except (ValueError,KeyError,OSError):pass
        pdf_urls=[x['url'] for x in index[key] if x.get('label')=='官方試題 PDF' and safe_ceec_pdf(x['url'])]
        if not pdf_urls:continue
        if attempted>=args.max_papers:break
        attempted+=1
        try:
            content=args.fixture_pdf.read_bytes() if args.fixture_pdf else download_pdf(pdf_urls[0])
            item=create_candidates(index,key,content)
            if item['extractedCount']<1:
                raise ValueError('找不到可靠的題號；保留原始官方試卷索引，等待特殊解析')
            dest.write_text(json.dumps(item,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
            if fail_path.exists():fail_path.unlink()
            written+=1; print(f'OK {key}: {item["extractedCount"]} candidates -> {dest.name}')
        except Exception as e:
            failed+=1
            if not args.fixture_pdf:
                failed_before=0
                try:failed_before=int(json.loads(fail_path.read_text(encoding='utf8')).get('attempts',0))
                except (OSError,ValueError):pass
                fail_path.write_text(json.dumps({'key':key,'attempts':failed_before+1,'lastError':str(e)[:600],
                   'lastAttemptAt':datetime.now(timezone.utc).isoformat(),
                   'nextRetryAt':(datetime.now(timezone.utc)+timedelta(days=args.retry_days)).isoformat()},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
            print(f'REVIEW {key}: {e}',file=sys.stderr)
    print(f'Processed {attempted}, saved {written}, errors {failed}; candidates are NOT verified quiz questions')
    if attempted and not written:sys.exit(1)

if __name__=='__main__':main()
