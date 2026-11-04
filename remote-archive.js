/* Remote official-exam extraction adapter.
 * Data upstream: rbnyng/ceec partitioned JSONL. This is NOT verified official source.
 * No browser credentials or paid API needed; origin is fixed to avoid arbitrary remote requests.
 */
(function(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ATLAS_REMOTE_ARCHIVE = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function () {
  'use strict';
  const base = 'https://raw.githubusercontent.com/rbnyng/ceec/main/';
  const manifestPath = 'data/items/partition_manifest.json';
  const re = /^data\/items\/(學測|學測補|指考|指考補|分科)\/(\d{2,3})\/([a-z][a-z0-9_]*)\.jsonl$/;
  const names = {
    chinese:'國文',chinese_reading:'國綜',chinese_writing:'國寫',english:'英文',math:'數學',math_a:'數學A',math_b:'數學B',
    math_jia:'數學甲',math_yi:'數學乙',physics:'物理',chemistry:'化學',biology:'生物',earth_science:'地球科學',
    history:'歷史',geography:'地理',civics:'公民與社會',social:'社會',science:'自然',
  };
  const officialIndex = {學測:'https://www.ceec.edu.tw/xmfile?xsmsid=0J052424829869345634',學測補:'https://www.ceec.edu.tw/xmfile?xsmsid=0J052424829869345634',指考:'https://www.ceec.edu.tw/xmfile?xsmsid=0J052427633128416650',指考補:'https://www.ceec.edu.tw/xmfile?xsmsid=0J052427633128416650',分科:'https://www.ceec.edu.tw/xmfile?xsmsid=0J052427633128416650'};
  function url(path) {
    if (!re.test(path) && path !== manifestPath) throw Error('未允許的分卷路徑');
    return base + path.split('/').map(encodeURIComponent).join('/');
  }
  function calcDifficulty(p) {
    if(typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 100) return null;
    return p>=85?1:p>=70?2:p>=55?3:p>=40?4:p>=25?5:6;
  }
  function manifestToCatalog(manifest) {
    if (!manifest || !manifest.files || typeof manifest.files !== 'object') throw Error('資料來源清單格式不正確');
    const entries = Object.entries(manifest.files);
    if(!entries.length || entries.length>1500) throw Error('來源分卷數量異常');
    let count=0;
    const papers = entries.map(([path, value]) => {
      const m=re.exec(path);
      if(!m || !Number.isInteger(value) || value<1 || value>1000) throw Error('不合法的來源分卷資料');
      count+=value;
      const [,exam,year,key]=m;
      return {sourceFile:path,file:null,exam,year:Number(year),subject:names[key]||key,subjectKey:key,count:value,readable:null,withAnswerOptions:null,aiClassified:0,verified:0,remote:true};
    }).sort((a,b)=>b.year-a.year || a.exam.localeCompare(b.exam,'zh-Hant') || a.subject.localeCompare(b.subject,'zh-Hant'));
    if(count!==manifest.total_rows) throw Error('題數總計不一致，暫停顯示');
    return {
      schema:'exam-atlas-open-archive-index-v1', remote:true,
      expectedPapersFromRemoteManifest:papers.length, expectedRecordsFromRemoteManifest:count,
      importedPapers:0,importedRecords:0, readableRecords:0,aiClassifiedRecords:0,verifiedRecords:0,
      missingPapers:papers.length, papers,sourceRepository:'https://github.com/rbnyng/ceec',
    };
  }
  function transform(row,path) {
    const m=re.exec(path);if(!m)throw Error('題目來源異常');
    const [,exam,year,key]=m;
    const opts=row.options && typeof row.options==='object' && !Array.isArray(row.options)
      ? Object.fromEntries(Object.entries(row.options).filter(([k,v])=>/^[A-H]$/.test(k)&&v!==null).map(([k,v])=>[k,String(v)])):{};
    const question=typeof row.stem==='string'?row.stem:'';
    const answerKey=typeof row.keys==='string'?row.keys:'';
    const issues=Array.isArray(row.item_flags)?row.item_flags.slice(0,20).map(String):[];
    const readable=question.trim().length>0;
    const hasAnswerOptions=!!Object.keys(opts).length && !!answerKey && [...answerKey].every(c=>Object.hasOwn(opts,c));
    if(!readable) issues.push('missing_question_text');
    if(!Object.keys(opts).length) issues.push('no_extracted_options_or_nonchoice');
    if(!answerKey) issues.push('no_answer_key');
    if(answerKey&&!hasAnswerOptions) issues.push('answer_format_or_options_unmatched');
    if(row.group_id&&!row.group_passage) issues.push('shared_context_may_be_missing');
    const id=String(row.item_uid||`${exam}${year}-${key}-${row.number||'unknown'}`);
    const score=typeof row.p_value==='number'?row.p_value:null;
    return {id,exam:String(row.exam_system||exam),year:Number(row.year_roc||year),subject:String(row.subject_zh||names[key]||key),subjectKey:key,
      number:row.number,question,options:opts,answerKey,section:String(row.section||''),
      groupId:row.group_id||null,groupPassage:row.group_passage||null,multiple:!!row.multi_select,
      officialScorePercent:score,difficulty:calcDifficulty(score),difficultyMethod:score===null?'unassigned':'official-score-percent-estimate',
      topicIds:[],aiClassified:false,sourceVerified:false,reviewed:false,readable,hasAnswerOptions,issues:[...new Set(issues)],
      source:'rbnyng/ceec',sourceFile:path,officialIndex:officialIndex[exam]};
  }
  function parsePaper(text,path,expectedCount) {
    if(!re.test(path)) throw Error('來源路徑不正確');
    const raw=text.split(/\r?\n/).filter(line=>line.trim());
    if(raw.length!==expectedCount) throw Error(`分卷資料缺漏：預期 ${expectedCount} 題，取得 ${raw.length} 題`);
    const rows=raw.map((line,i)=>{
      let obj;try{obj=JSON.parse(line);}catch{throw Error(`第 ${i+1} 行不是有效題目資料`);}
      const item=transform(obj,path);
      if(!item.id || !Number.isInteger(Number(item.year))) throw Error('題目識別欄位不完整');
      return item;
    });
    if(new Set(rows.map(x=>x.id)).size!==rows.length) throw Error('發現重複題目編號');
    return {schema:'exam-atlas-open-archive-v1',sourceFile:path,remote:true,questions:rows};
  }
  async function getText(path,{fetchImpl=fetch,timeoutMs=15000}={}) {
    // Same public repository through two hosts; do not silently substitute another dataset.
    const main=url(path);
    const cdn='https://cdn.jsdelivr.net/gh/rbnyng/ceec@main/'+path.split('/').map(encodeURIComponent).join('/');
    let last;
    for(const endpoint of [main,cdn]){
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),timeoutMs);
      try{
        const response=await fetchImpl(endpoint,{signal:controller.signal,mode:'cors'});
        if(!response.ok)throw Error('HTTP '+response.status);
        return await response.text();
      }catch(e){last=e;}finally{clearTimeout(timer);}
    }
    throw Error('兩個公開資料來源皆無法連線：'+(last?.message||'未知錯誤'));
  }
  async function loadManifest(opts){return manifestToCatalog(JSON.parse(await getText(manifestPath,opts)));}
  async function loadPaper(p,opts){if(!p?.remote)throw Error('不是可讀取的遠端分卷');return parsePaper(await getText(p.sourceFile,opts),p.sourceFile,p.count);}
  return {url,calcDifficulty,manifestToCatalog,transform,parsePaper,getText,loadManifest,loadPaper};
});
