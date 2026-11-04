#!/usr/bin/env python3
"""Import every available CEEC item partition from public rbnyng/ceec corpus.

This tool is NOT an AI classifier, official transcript validator, or proof of
copyright permission to redistribute embedded third-party passages. Imported
records remain '待原卷核對' and never enter the vetted question builder.

Sources: https://github.com/rbnyng/ceec (partitioned JSONL + manifest)
Official exam paper index: https://www.ceec.edu.tw/xmfile
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
from hashlib import sha256
import json
import re
import sys
import time
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'data' / 'archive'
BASE = 'https://raw.githubusercontent.com/rbnyng/ceec/main/'
MANIFEST = 'data/items/partition_manifest.json'
PATH_RE = re.compile(r'^data/items/(學測|學測補|指考|指考補|分科)/(\d{2,3})/([a-z][a-z0-9_]*)\.jsonl$')
INDEX_URLS = {
 '學測': 'https://www.ceec.edu.tw/xmfile?xsmsid=0J052424829869345634',
 '學測補': 'https://www.ceec.edu.tw/xmfile?xsmsid=0J052424829869345634',
 '分科': 'https://www.ceec.edu.tw/xmfile?xsmsid=0J052427633128416650',
 '指考': 'https://www.ceec.edu.tw/xmfile?xsmsid=0J052427633128416650',
 '指考補': 'https://www.ceec.edu.tw/xmfile?xsmsid=0J052427633128416650'
}


def get_bytes(path, fixture_dir=None, max_size=4_000_000):
    if fixture_dir:
        f = fixture_dir / path
        raw = f.read_bytes()
        if len(raw) > max_size: raise ValueError('fixture too large')
        return raw
    u = BASE + quote(path, safe='/')
    req = Request(u, headers={'User-Agent': 'ExamAtlasArchiveImporter/0.4 (+metadata and provenance)', 'Accept': 'application/json,text/plain'})
    with urlopen(req, timeout=45) as response:
        raw = response.read(max_size + 1)
    if len(raw) > max_size: raise ValueError(f'file too large: {path}')
    return raw


def grade_from_stat(p):
    """Tentative empirical 1–6 tiers. This is not AI/class difficulty."""
    if isinstance(p, (float, int)) and not isinstance(p, bool) and 0 <= p <= 100:
        return 1 if p >= 85 else 2 if p >= 70 else 3 if p >= 55 else 4 if p >= 40 else 5 if p >= 25 else 6
    return None


def transform(row, path):
    exam, year, subjkey = PATH_RE.fullmatch(path).groups()
    options = row.get('options') if isinstance(row.get('options'), dict) else {}
    options = {k: str(v) for k, v in options.items() if re.fullmatch('[A-H]', str(k)) and v is not None}
    stem = row.get('stem') if isinstance(row.get('stem'), str) else ''
    keys = row.get('keys') if isinstance(row.get('keys'), str) else ''
    flags = row.get('item_flags') if isinstance(row.get('item_flags'), list) else []
    flags = [str(f)[:100] for f in flags][:12]
    p = row.get('p_value')
    readable = bool(stem.strip())
    correct_options = bool(options) and bool(keys) and set(keys) <= set(options) and not any(k.isspace() for k in keys)
    # Text present is not enough: math formulas and diagrams may be stripped in extraction.
    cautions = list(flags)
    if not readable: cautions.append('missing_question_text')
    if not options: cautions.append('no_extracted_options_or_nonchoice')
    if not keys: cautions.append('no_answer_key')
    elif not correct_options: cautions.append('answer_format_or_options_unmatched')
    if row.get('group_id') and not row.get('group_passage'): cautions.append('shared_context_may_be_missing')
    return {
      'id': str(row.get('item_uid') or f'{exam}{year}-{subjkey}-{row.get("number")}'),
      'exam': str(row.get('exam_system') or exam), 'year': int(row.get('year_roc') or year),
      'subject': str(row.get('subject_zh') or subjkey), 'subjectKey': subjkey,
      'number': row.get('number'), 'question': stem, 'options': options,
      'answerKey': keys, 'section': str(row.get('section') or ''),
      'groupId': row.get('group_id'), 'groupPassage': row.get('group_passage'),
      'multiple': bool(row.get('multi_select')), 'source': 'rbnyng/ceec',
      'sourceFile': path, 'officialIndex': INDEX_URLS[exam],
      'officialScorePercent': p if isinstance(p, (float, int)) else None,
      'difficulty': grade_from_stat(p),
      'difficultyMethod': 'official-score-percent-estimate' if grade_from_stat(p) else 'unassigned',
      'topicIds': [], 'aiClassified': False, 'sourceVerified': False,
      'reviewed': False, 'readable': readable, 'hasAnswerOptions': correct_options,
      'issues': list(dict.fromkeys(cautions)),
      'curriculum': str(row.get('curriculum') or ''),
    }


def read_paper(path, expected, fixture_dir):
    raw = get_bytes(path, fixture_dir)
    rows = []
    for i, line in enumerate(raw.decode('utf-8-sig').splitlines(), 1):
        if not line.strip(): continue
        try: record = json.loads(line)
        except json.JSONDecodeError as ex: raise ValueError(f'{path}:{i} bad JSON') from ex
        rows.append(transform(record, path))
    if len(rows) != expected: raise ValueError(f'count mismatch for {path}: got {len(rows)}, expected {expected}')
    if len({q['id'] for q in rows}) != len(rows): raise ValueError('duplicate item IDs: '+path)
    return rows, sha256(raw).hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--fixture-dir', type=Path, default=None)
    ap.add_argument('--max-files', type=int, default=0, help='0 = attempt all files in this run')
    ap.add_argument('--delay', type=float, default=0.25, help='delay between requests (seconds)')
    ap.add_argument('--out', type=Path, default=TARGET)
    ap.add_argument('--overwrite', action='store_true')
    a = ap.parse_args()
    if a.max_files < 0 or a.delay < 0: ap.error('invalid limits')
    mbytes = get_bytes(MANIFEST, a.fixture_dir)
    manifest = json.loads(mbytes)
    declared = manifest.get('files')
    if not isinstance(declared, dict) or not declared: raise ValueError('empty/invalid partition manifest')
    if any(not PATH_RE.fullmatch(k) or not isinstance(v,int) or v<=0 for k,v in declared.items()):
        raise ValueError('unexpected manifest entries: decline unknown remote paths')
    expected_total = sum(declared.values())
    if expected_total != manifest.get('total_rows'): raise ValueError('manifest row total does not match sum of partitions')
    a.out.mkdir(parents=True, exist_ok=True)
    (a.out/'source-manifest.json').write_bytes(mbytes)  # exact upstream scope for later audits
    papers_dir = a.out/'papers'
    papers_dir.mkdir(parents=True,exist_ok=True)
    catalog_path = a.out/'catalog.json'
    prior = {}
    if catalog_path.exists():
        try:
            prior = {x['sourceFile']: x for x in json.loads(catalog_path.read_text(encoding='utf8')).get('papers', [])}
        except (ValueError,KeyError): pass
    papers = []
    errors = []
    attempts = 0
    for idx,(path,expected) in enumerate(sorted(declared.items())):
        parts = PATH_RE.fullmatch(path)
        exam,year,subjkey = parts.groups()
        dest = papers_dir/f'{exam}_{year}_{subjkey}.json'
        data = None
        if dest.exists() and not a.overwrite:
            try:
                cached = json.loads(dest.read_text(encoding='utf8'))
                if cached.get('sourceFile') == path and len(cached.get('questions', [])) == expected:
                    data = cached
            except (ValueError,OSError): pass
        if data is None:
            if a.max_files and attempts >= a.max_files:
                if path in prior and dest.exists(): papers.append(prior[path])
                continue
            attempts += 1
            try:
                rows, checksum = read_paper(path,expected,a.fixture_dir)
                data = {'schema':'exam-atlas-open-archive-v1','sourceFile':path,'sourceSha256':checksum,'questions':rows}
                dest.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8')
                print(f'OK {idx+1}/{len(declared)} {path}: {len(rows)} records')
            except Exception as ex:
                errors.append({'sourceFile':path,'error':str(ex)[:320]})
                print('FAILED',path,str(ex)[:190],file=sys.stderr)
                if path in prior and dest.exists(): papers.append(prior[path])
                continue
            if not a.fixture_dir: time.sleep(a.delay)
        qs = data['questions']
        papers.append({
          'sourceFile':path,'file':f'data/archive/papers/{dest.name}',
          'exam':exam,'year':int(year),'subject':next((q['subject'] for q in qs if q['subject']),'未知'),
          'subjectKey':subjkey,'count':len(qs),
          'readable':sum(q['readable'] for q in qs),
          'withAnswerOptions':sum(q['hasAnswerOptions'] for q in qs),
          'scoreBasedDifficulty':sum(q['difficulty'] is not None for q in qs),
          'aiClassified':sum(bool(q.get('aiClassified')) for q in qs),'verified':sum(bool(q.get('reviewed')) for q in qs),
        })
    downloaded = sum(x['count'] for x in papers)
    output = {
      'schema':'exam-atlas-open-archive-index-v1',
      'sourceRepository':'https://github.com/rbnyng/ceec',
      'sourceManifestSha256':sha256(mbytes).hexdigest(),
      'generatedAt':datetime.now(timezone.utc).isoformat(),
      'expectedPapersFromRemoteManifest':len(declared),'expectedRecordsFromRemoteManifest':expected_total,
      'importedPapers':len(papers),'importedRecords':downloaded,
      'readableRecords':sum(x['readable'] for x in papers),
      'aiClassifiedRecords':sum(x['aiClassified'] for x in papers),
      'verifiedRecords':sum(x['verified'] for x in papers),
      'recordsWithAnswerOptions':sum(x['withAnswerOptions'] for x in papers),
      'missingPapers':len(declared)-len(papers),
      'errors':errors,'papers':papers,
      'disclaimer':'本資料庫並非大考中心官方校對結果；公式、圖片、題幹、題組及答案可能不完整。未完成逐題核對與AI單元分類，不能宣稱題庫全部完成。'
    }
    catalog_path.write_text(json.dumps(output,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8')
    print(f'IMPORTED {len(papers)}/{len(declared)} papers; {downloaded}/{expected_total} items; readable {output["readableRecords"]}; errors {len(errors)}')
    return 1 if errors else 0


if __name__=='__main__': raise SystemExit(main())
