/* Live past-paper practice. Source: rbnyng/ceec JSONL index, NOT an official CEEC service.
   Explicitly separates extracted candidates, structurally playable items, and verified items.
   No auto-extracted item is described as officially checked. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object' && module.exports)module.exports=api;
  if(root){root.ATLAS_REAL_PRACTICE=api;if(root.document)root.document.addEventListener('DOMContentLoaded',()=>api.init(root));}
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:null),function(){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const badFlag=/missing|not_extracted|unparsed|incomplete|corrupt|mismatch|disagree|bad_ocr|suspect|unresolved|truncated/i;
const forbiddenGlyph=/[\uE000-\uF8FF\uFFFD]/;
const keyFor=q=>String(q?.answerKey||'').replace(/\s/g,'').toUpperCase();
function playable(q){
  if(!q||typeof q.question!=='string'||q.question.trim().length<7||forbiddenGlyph.test(q.question))return false;
  if(q.groupId && !(q.groupPassage&&String(q.groupPassage).trim()))return false;
  if(Array.isArray(q.issues) && q.issues.some(x=>badFlag.test(String(x))))return false;
  const opts=q.options||{},letters=Object.keys(opts).sort();
  if(letters.length<2||letters.length>8||letters.some((k,i)=>k!==String.fromCharCode(65+i)))return false;
  if(letters.some(k=>typeof opts[k]!=='string'||opts[k].trim().length<1||forbiddenGlyph.test(opts[k])))return false;
  const key=keyFor(q);return /^[A-H]{1,8}$/.test(key)&&new Set(key).size===key.length&&[...key].every(k=>letters.includes(k));
}
function classify(q){return q?.reviewed||q?.sourceVerified?'已人工核對':playable(q)?'可試答・待原卷核對':'僅供查閱・需修復';}
function extractCatalog(remote,local){
 const localPapers=Array.isArray(local?.papers)?local.papers:[];
 const localMap=new Map(localPapers.map(p=>[p.sourceFile,p]));
 if(remote?.papers?.length){return {...remote,papers:remote.papers.map(p=>localMap.get(p.sourceFile)||p),importedPapers:localPapers.length,importedRecords:Number(local?.importedRecords||0)};}
 return local||{papers:[],expectedRecordsFromRemoteManifest:0,expectedPapersFromRemoteManifest:0};
}
function availableYears(papers,exam){return [...new Set(papers.filter(p=>!exam||p.exam===exam).map(p=>Number(p.year)))].filter(Number.isInteger).sort((a,b)=>b-a);}
function availableSubjects(papers,exam,year){return [...new Set(papers.filter(p=>(!exam||p.exam===exam)&&(!year||p.year===Number(year))).map(p=>p.subject))].sort((a,b)=>a.localeCompare(b,'zh-Hant'));}
function filtered(qs,{keyword='',quality='all',difficulty='',topic='',wrongOnly=false,wrongIds=[]}={}){
 const query=String(keyword).trim().toLowerCase();const wrong=new Set(wrongIds);
 return qs.filter(q=>(!query||[q.question,q.number,q.groupPassage].join(' ').toLowerCase().includes(query))
   &&(quality==='all'||quality==='playable'&&playable(q)||quality==='blocked'&&!playable(q))
   &&(!difficulty||Number(q.ai?.difficulty||q.difficulty)===Number(difficulty))
   &&(!topic||(q.topicIds||[]).includes(topic))&&(!wrongOnly||wrong.has(q.id)));
}
function shuffle(items){let a=items.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function grade(q,selection){const actual=[...new Set(Array.isArray(selection)?selection:[])].sort().join('');return actual===keyFor(q).split('').sort().join('');}
const DEFAULT_EXAM='學測',DEFAULT_SUBJECT='國綜';
function init(w){
 const d=w.document,remote=w.ATLAS_REMOTE_ARCHIVE;
 if(!d.getElementById('page-real'))return;
 const $=id=>d.getElementById(id);
 let catalog=null,paper=null,current=null,list=[],quiz=null,view='questions';
 const memoryKey='exam-atlas-real-history-v1';
 function history(){try{const x=JSON.parse(w.localStorage.getItem(memoryKey)||'{}');return x&&typeof x==='object'&&typeof x.wrong==='object'?x:{wrong:{},attempts:0};}catch{return {wrong:{},attempts:0};}}
 let hist=history();
 function saveHistory(){try{w.localStorage.setItem(memoryKey,JSON.stringify(hist));}catch{}}
 const message=(m,cls='')=>{$('realStatus').className='real-status '+cls;$('realStatus').textContent=m;};
 function optionValues(el,items,selected){el.replaceChildren();for(const a of items)el.add(new Option(String(a),String(a)));if(items.map(String).includes(String(selected)))el.value=String(selected);}
 function visiblePapers(){const y=Number($('realYear').value),mode=$('realYearMode').value;return (catalog?.papers||[]).filter(p=>p.exam===$('realExam').value&&p.subject===$('realSubject').value&&p.year<=y&&(mode==='all'||mode==='recent'&&p.year>=y-4||p.year===y)).sort((a,b)=>b.year-a.year);}
 function setupControls(){
  const papers=catalog?.papers||[];
  const exams=['學測','分科','指考','學測補','指考補'].filter(x=>papers.some(p=>p.exam===x));
  optionValues($('realExam'),exams,exams.includes(DEFAULT_EXAM)?DEFAULT_EXAM:exams[0]);
  onExam();
  $('realCount').textContent=`${Number(catalog?.expectedRecordsFromRemoteManifest||catalog?.importedRecords||0).toLocaleString()} 筆來源紀錄・${papers.length} 份分卷（非已驗證題數）`;
  $('realSourceNote').textContent=catalog?.remote?'目前可依試卷從外部公開資料源讀取；需網路連線，所有擷取內容均須核對原卷。':`已保存 ${catalog?.importedRecords||0} 筆；外部來源未成功更新。`;
 }
 function onExam(){const exam=$('realExam').value,prev=$('realYear').value;const ys=availableYears(catalog?.papers||[],exam);optionValues($('realYear'),ys,ys.includes(Number(prev))?prev:(exam==='學測'&&ys.includes(115)?115:ys[0]));onYear();}
 function onYear(){const opts=availableSubjects(catalog?.papers||[],$('realExam').value,$('realYear').value);const current=$('realSubject').value;optionValues($('realSubject'),opts,opts.includes(current)?current:(opts.includes(DEFAULT_SUBJECT)?DEFAULT_SUBJECT:opts[0]));$('realPaperInfo').textContent=visiblePapers().length?`${visiblePapers().length} 份分卷，合計 ${visiblePapers().reduce((n,p)=>n+p.count,0).toLocaleString()} 筆來源紀錄`:'目前此選擇沒有資料';}
 async function openCatalog(){
  message('正在讀取歷屆分卷索引…');let local=null,net=null,error=null;
  try{const res=await w.fetch('./data/archive/catalog.json',{cache:'no-store'});if(res.ok)local=await res.json();}catch{}
  try{if(!remote)throw Error('缺少 remote-archive.js');net=await remote.loadManifest();}catch(e){error=e;}
  catalog=extractCatalog(net,local);if(net)catalog.remote=true;
  if(!catalog.papers?.length){message('沒有可讀的真題目錄。請確認網路連線與遠端題庫來源：'+(error?.message||'尚未匯入題目'),'error');$('realLoad').disabled=true;return;}
  setupControls();$('realLoad').disabled=false;message(net?'題庫索引已載入，正在載入預設試卷…':`遠端連線失敗，使用已儲存試卷：${error?.message||''}`,'success');await loadPaper();
 }
 async function loadPaper(){
  const requested=visiblePapers();if(!requested.length){message('請選擇有試卷的科目或年份','error');return;}
  message(`正在讀取 ${requested.length} 份歷屆試卷…`);$('realLoad').disabled=true;
  try{
    const output=[],failed=[];
    for(let start=0;start<requested.length;start+=4){
      await Promise.all(requested.slice(start,start+4).map(async p=>{
        try{
          let result;
          if(p.file){const res=await w.fetch('./'+p.file);if(!res.ok)throw Error('本地資料 HTTP '+res.status);result=await res.json();}
          else {if(!remote)throw Error('遠端讀取器缺失');result=await remote.loadPaper(p);}
          if(!Array.isArray(result.questions)||result.questions.length!==p.count)throw Error('題數與清單不符');
          output.push({year:p.year,questions:result.questions});
        }catch(err){failed.push(`${p.year} ${p.subject}: ${err.message}`);}
      }));
      if(requested.length>4)message(`已處理 ${Math.min(start+4,requested.length)}/${requested.length} 份分卷…`);
    }
    if(!output.length)throw Error('所有分卷均讀取失敗。'+failed.slice(0,2).join('；'));
    output.sort((a,b)=>b.year-a.year);
    const questions=output.flatMap(x=>x.questions);
    if(new Set(questions.map(q=>q.id)).size!==questions.length)throw Error('來源出現重複題目 ID');
    paper={questions};current={...requested[0],yearLabel:output.length>1?`${output.at(-1).year}～${output[0].year}`:String(output[0].year)};
    quiz=null;view='questions';$('realSelectedTitle').textContent=`${current.yearLabel} ${current.exam}・${current.subject}`;
    $('realSearch').value='';$('realQuality').value='all';$('realDifficulty').value='';$('realTopic').value='';$('realWrongOnly').checked=false;
    const allTopics=[...new Set(questions.flatMap(q=>q.topicIds||[]))].sort();
    $('realTopic').replaceChildren(new Option('所有單元（含未分類）',''));
    const cur=w.ATLAS_CURRICULUM||[];
    for(const topicId of allTopics){const c=cur.find(x=>x.id===topicId);$('realTopic').add(new Option(c?`${c.subject} ${c.book}・${c.title}`:topicId,topicId));}
    $('realFilters').hidden=false;$('realActions').hidden=false;$('realSession').hidden=true;$('realOutcome').hidden=true;$('realResults').hidden=false;
    updateResults();
    message(`已取得 ${output.length}/${requested.length} 份試卷、${questions.length} 筆題目。${failed.length?'讀取失敗：'+failed.slice(0,3).join('；'):'可選擇題數開始測驗。'}`,failed.length?'error':'success');
  }catch(e){paper=null;$('realResults').textContent='載入失敗：'+e.message;message('試卷讀取失敗：'+e.message+'。可按重試，或檢查外部資料來源。','error');}
  finally{$('realLoad').disabled=false;}
 }
 function getFiltered(){if(!paper)return [];return filtered(paper.questions,{keyword:$('realSearch').value,quality:$('realQuality').value,difficulty:$('realDifficulty').value,topic:$('realTopic').value,wrongOnly:$('realWrongOnly').checked,wrongIds:Object.keys(hist.wrong).filter(id=>hist.wrong[id])});}
 function link(){return esc(current?.exam==='學測'?'https://www.ceec.edu.tw/xmfile?xsmsid=0J052424829869345634':'https://www.ceec.edu.tw/xmfile?xsmsid=0J052427633128416650');}
 function card(q,{showAnswer=false}={}){
  const opts=Object.entries(q.options||{}).map(([k,v])=>`<li><strong>${esc(k)}.</strong> ${esc(v)}</li>`).join('');
  const caution=q.issues?.length?`擷取疑點：${esc(q.issues.join('、'))}`:'未標示疑點，不代表已人工核對';
  const labels=(q.topicIds||[]).join('、')||'尚未完成單元分類';
  return `<article class="real-item" data-qid="${esc(q.id)}"><div class="real-tags"><span>${esc(q.exam)} ${esc(q.year)}・第 ${esc(q.number||'?')} 題</span><span class="${playable(q)?'quality-ok':'quality-warn'}">${esc(classify(q))}</span><span>${q.ai?.difficulty?'AI難度':q.difficulty?'得分率推估難度':'難度待分級'} ${esc(q.ai?.difficulty||q.difficulty||'—')}/6</span></div>
   ${q.groupPassage?`<div class="real-passage">${esc(q.groupPassage)}</div>`:''}<p class="real-stem">${esc(q.question||'未擷取題幹：請查官方原卷')}</p><ol class="real-choices">${opts||'<li>未取得完整選項或屬非選擇題</li>'}</ol>
   <details ${showAnswer?'open':''}><summary>查看擷取答案、資料品質與來源</summary><p>答案：<strong>${esc(q.answerKey||'缺漏')}</strong>　｜　單元：${esc(labels)}　｜　得分率：${q.officialScorePercent==null?'未知':esc(q.officialScorePercent)+'%'}</p><p>${caution}</p><a target="_blank" rel="noopener noreferrer" href="${link()}">大考中心官方歷屆原卷索引 ↗</a></details></article>`;
 }
 function updateResults(){if(!paper)return;list=getFiltered();const fit=list.filter(playable);
  $('realResultCount').textContent=`這份試卷共 ${paper.questions.length} 筆｜符合篩選 ${list.length} 筆｜其中可試答 ${fit.length} 筆（均未保證原卷核對）`;
  $('realResults').innerHTML=list.slice(0,100).map(q=>card(q)).join('')||'<p class="mini-hint">沒有符合條件的題目。可清除單元與難度篩選再試。</p>';
  $('realListFoot').textContent=list.length>100?`目前顯示前 100 筆；請使用篩選或依年度選其他試卷。`:'';
  $('realQuizStart').disabled=!fit.length;
 }
 function startQuiz(){const n=Number($('realQuizCount').value),qs=shuffle(getFiltered().filter(playable));if(!qs.length){message('此範圍沒有結構完整、可試答的題目。請選其他試卷。','error');return;}
  quiz={questions:qs.slice(0,Math.min(n,qs.length)),index:0,answers:{},finished:false};$('realSession').hidden=false;$('realResults').hidden=true;$('realFilters').hidden=true;$('realActions').hidden=true;renderQuiz();$('realSession').scrollIntoView({block:'start',behavior:'smooth'});
 }
 function renderQuiz(){const s=quiz;if(!s)return;const q=s.questions[s.index],given=s.answers[q.id]||[],multi=keyFor(q).length>1;
  $('realQuizProgress').textContent=`第 ${s.index+1} / ${s.questions.length} 題 · ${current.yearLabel} ${current.exam} ${current.subject}（擷取資料，尚未逐題人工核對）`;
  $('realQuizQuestion').innerHTML=`<div class="real-tags"><span>第 ${esc(q.number)} 題</span><span>難度 ${esc(q.ai?.difficulty||q.difficulty||'—')}/6</span><span>${multi?'多選':'單選'}</span></div>${q.groupPassage?`<div class="real-passage">${esc(q.groupPassage)}</div>`:''}<p class="real-stem">${esc(q.question)}</p><div class="real-answer-choices">${Object.entries(q.options).map(([letter,body])=>`<label><input type="${multi?'checkbox':'radio'}" name="realAns" value="${letter}" ${given.includes(letter)?'checked':''}><b>${letter}.</b> ${esc(body)}</label>`).join('')}</div>`;
  $('realPrev').disabled=s.index===0;$('realNext').textContent=s.index===s.questions.length-1?'交卷計分':'下一題 →';
  $('realQuizQuestion').querySelectorAll('input[name=realAns]').forEach(input=>input.addEventListener('change',()=>{if(multi){let set=new Set(s.answers[q.id]||[]);if(input.checked)set.add(input.value);else set.delete(input.value);s.answers[q.id]=[...set].sort();}else{s.answers[q.id]=[input.value];}}));
 }
 function finish(){if(!quiz)return;const s=quiz;const unanswered=s.questions.filter(q=>!s.answers[q.id]?.length).length;if(unanswered && !w.confirm(`有 ${unanswered} 題未作答，仍要交卷嗎？`))return;
  const score=s.questions.filter(q=>grade(q,s.answers[q.id]||[])).length;hist.attempts+=s.questions.length;for(const q of s.questions)hist.wrong[q.id]=!grade(q,s.answers[q.id]||[]);saveHistory();
  $('realSession').hidden=true;$('realOutcome').hidden=false;$('realOutcome').innerHTML=`<div class="real-score"><h2>本次答對 ${score} / ${s.questions.length} 題</h2><p>得分 ${Math.round(100*score/s.questions.length)}%　・　來源為自動擷取資料，答案仍需對照原卷。</p><button id="realBackToList" class="btn primary">返回歷屆題目</button></div>${s.questions.map(q=>`<div class="real-result-item">${card(q,{showAnswer:true})}<p class="real-verdict">${grade(q,s.answers[q.id]||[])?'✓ 正確':'✕ 錯誤'}　你的答案：${esc((s.answers[q.id]||[]).join('、')||'未作答')}　／　來源答案：${esc(keyFor(q))}</p></div>`).join('')}`;
  $('realBackToList').addEventListener('click',back);$('realOutcome').scrollIntoView({behavior:'smooth',block:'start'});
 }
 function back(){quiz=null;$('realOutcome').hidden=true;$('realSession').hidden=true;$('realResults').hidden=false;$('realFilters').hidden=false;$('realActions').hidden=false;updateResults();}
 ['realExam','realYear','realSubject','realYearMode'].forEach(id=>$(id).addEventListener('change',id==='realExam'?onExam:onYear));
 ['realSearch','realQuality','realDifficulty','realTopic','realWrongOnly'].forEach(id=>$(id).addEventListener(id==='realSearch'?'input':'change',updateResults));
 $('realLoad').addEventListener('click',loadPaper);$('realRetry').addEventListener('click',openCatalog);$('realQuizStart').addEventListener('click',startQuiz);
 $('realPrev').addEventListener('click',()=>{if(quiz&&quiz.index>0){quiz.index--;renderQuiz();}});
 $('realNext').addEventListener('click',()=>{if(!quiz)return;if(quiz.index<quiz.questions.length-1){quiz.index++;renderQuiz();}else finish();});
 $('realCancel').addEventListener('click',back);$('realExitOutcome').addEventListener('click',back);
 openCatalog();
 }
return {playable,classify,extractCatalog,availableYears,availableSubjects,filtered,grade,init};
});
