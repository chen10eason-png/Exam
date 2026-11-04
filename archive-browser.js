/* Large legacy archive browser, lazy-loaded per official paper.
   Never presents third-party machine-extracted records as manually verified. */
(()=>{'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sel=(selector,items,allLabel)=>{const node=$(selector);node.innerHTML='';node.append(new Option(allLabel,''));for(const x of items)node.append(new Option(String(x),String(x)));};
let catalog=null,paper=null,selected=null;
const units=window.ATLAS_CURRICULUM||[];
const unitById=new Map(units.map(t=>[t.id,t]));
async function loadCatalog(){
 const summary=$('#bulkSummary');
 try{
  const localResponse=await fetch('./data/archive/catalog.json',{cache:'no-store'});
  if(!localResponse.ok)throw Error('本地目錄 HTTP '+localResponse.status);
  const local=await localResponse.json();
  catalog=local;
  const localPapers=Array.isArray(local.papers)?local.papers:[];
  try{
   if(!window.ATLAS_REMOTE_ARCHIVE)throw Error('遠端來源載入器不存在');
   const remote=await window.ATLAS_REMOTE_ARCHIVE.loadManifest();
   const stored=new Map(localPapers.map(p=>[p.sourceFile,p]));
   remote.papers=remote.papers.map(p=>stored.get(p.sourceFile)||p);
   remote.importedPapers=localPapers.length;
   remote.importedRecords=local.importedRecords||0;
   remote.readableRecords=local.readableRecords||0;
   remote.aiClassifiedRecords=local.aiClassifiedRecords||0;
   remote.verifiedRecords=local.verifiedRecords||0;
   remote.missingPapers=Math.max(0,remote.papers.length-localPapers.length);
   catalog=remote;
   summary.textContent=`公開來源共列 ${remote.expectedPapersFromRemoteManifest.toLocaleString()} 份分卷、${remote.expectedRecordsFromRemoteManifest.toLocaleString()} 筆逐題紀錄。本站已自行保存 ${remote.importedPapers} 份、${remote.importedRecords} 筆；其餘會在你選取試卷時從公開來源即時讀取。來源中的題目尚未全部完成原卷核對或 AI 分類。`;
  }catch(err){
   summary.textContent=localPapers.length?
    `可使用已儲存 ${localPapers.length} 份、${local.importedRecords||0} 筆資料；公開歷屆來源目前無法連線（${err.message}）。`:
    `還沒有已儲存的真題，公開歷屆來源也未成功連線：${err.message}。請檢查網路，稍後重新載入。`;
  }
  const papers=catalog.papers||[];
  sel('#bulkExam',[...new Set(papers.map(x=>x.exam))].sort(),'所有考試');
  sel('#bulkYear',[...new Set(papers.map(x=>x.year))].sort((a,b)=>b-a),'所有學年度');
  sel('#bulkSubject',[...new Set(papers.map(x=>x.subject))].sort((a,b)=>a.localeCompare(b,'zh-Hant')),'所有考科');
  renderPapers();
 }catch(err){summary.textContent='無法讀取歷屆試題資料：'+err.message;}
}
function renderPapers(){
 const root=$('#bulkPapers');if(!catalog)return;
 const exam=$('#bulkExam').value,year=$('#bulkYear').value,subject=$('#bulkSubject').value;
 let filtered=(catalog.papers||[]).filter(p=>(!exam||p.exam===exam)&&(!year||String(p.year)===year)&&(!subject||p.subject===subject));
 $('#bulkListCount').textContent=`共 ${filtered.length} 份試卷`;
 if(filtered.length>80){filtered=filtered.slice(0,80);$('#bulkListCount').textContent+='（先顯示 80 份；可選年度或科目縮小範圍）';}
 root.innerHTML=filtered.length?filtered.map((p,i)=>`<button class="bulk-paper" data-path="${esc(p.sourceFile)}"><strong>${esc(p.year)} ${esc(p.exam)} ${esc(p.subject)}</strong><small>${p.count} 筆題目 · ${p.file?'本網站已保存':'選取時讀取公開資料'} · 尚待逐題核對</small></button>`).join(''):'<p class="mini-hint">沒有符合篩選條件的試卷。</p>';
 root.querySelectorAll('button[data-path]').forEach(b=>b.addEventListener('click',()=>loadPaper(b.dataset.path)));
}
async function loadPaper(path){
 const p=catalog?.papers.find(p=>p.sourceFile===path);if(!p)return;
 const detail=$('#bulkQuestions');detail.textContent='讀取原題中，這份試卷可能需要網路連線…';
 try{
  let payload;
  if(p.file){
   const response=await fetch('./'+p.file);
   if(!response.ok)throw Error('本地試卷 HTTP '+response.status);
   payload=await response.json();
  }else{
   payload=await window.ATLAS_REMOTE_ARCHIVE.loadPaper(p);
  }
  if(payload.schema!=='exam-atlas-open-archive-v1'||!Array.isArray(payload.questions)||payload.questions.length!==p.count)throw Error('題目數量或格式不符');
  paper=payload;selected=p;
  $('#bulkChosen').textContent=`${p.year} 年 ${p.exam} ${p.subject} · ${paper.questions.length} 筆（${p.file?'本地分卷':'公開來源即時讀取'}）`;
  $('#bulkKeyword').value='';$('#bulkReadability').value='';$('#bulkTopic').value='';$('#bulkDifficulty').value='';
  renderQuestions();
 }catch(err){detail.textContent='這份試卷讀取失敗或資料不足：'+err.message+'。可從上方官方歷屆索引開啟原卷。';}
}
function renderQuestions(){
 const root=$('#bulkQuestions');if(!paper)return;
 const keyword=$('#bulkKeyword').value.trim().toLowerCase();
 const readability=$('#bulkReadability').value,topic=$('#bulkTopic').value,diff=$('#bulkDifficulty').value;
 const arr=paper.questions.filter(q=>(!keyword||[q.question,q.section,q.number].join(' ').toLowerCase().includes(keyword))&&(!readability||(readability==='readable'&&q.readable)||(readability==='unreadable'&&!q.readable))&&(!topic||(q.topicIds||[]).includes(topic))&&(!diff||Number(q.ai?.difficulty||q.difficulty)===Number(diff)));
 $('#bulkResultCount').textContent=`符合 ${arr.length} 題；已顯示 ${Math.min(80,arr.length)} 題`;
 root.innerHTML=arr.slice(0,80).map(q=>{
  const opts=Object.entries(q.options||{}).map(([k,v])=>`<li><b>${esc(k)}.</b> ${esc(v)}</li>`).join('');
  const grade=q.ai?.difficulty?`AI估計難度 ${q.ai.difficulty}/6`:(q.difficulty?`得分率推估難度 ${q.difficulty}/6`:'難度待分級');
  const topics=(q.topicIds||[]).map(id=>unitById.get(id)?.title).filter(Boolean).join('／')||'AI單元待分類';
  return `<article class="bulk-question"><div class="bulk-meta"><b>第 ${esc(q.number)} 題</b><span>${esc(grade)}</span><span>${q.readable?'已擷取文字':'缺題幹'}</span><span>${esc(topics)}</span></div><p class="bulk-stem">${esc(q.question||'原始題幹未成功擷取，需回官方原卷確認。')}</p>${opts?`<ol class="bulk-options">${opts}</ol>`:''}<details><summary>答案、來源與資料品質</summary><p>擷取答案：<b>${esc(q.answerKey||'未取得')}</b>　｜　得分率：${q.officialScorePercent==null?'無統計':esc(q.officialScorePercent)+'%'}</p><p>資料疑點：${q.issues.length?esc(q.issues.join('、')):'未標出疑點，但尚未原卷核對'}</p><p><a href="${esc(q.officialIndex)}" target="_blank" rel="noopener noreferrer">官方試題索引</a></p></details></article>`;
 }).join('')||'<p class="mini-hint">找不到符合條件的題目。</p>';
}
function init(){
 if(!$('#bulkArchive'))return;
 ['#bulkExam','#bulkYear','#bulkSubject'].forEach(s=>$(s).addEventListener('change',renderPapers));
 sel('#bulkTopic',units.map(t=>t.id),'所有單元（含未分類）');for(const opt of $('#bulkTopic').options){if(opt.value){const t=unitById.get(opt.value);opt.textContent=`${t.subject}・${t.book}・${t.title}`;}}
 ['#bulkKeyword','#bulkReadability','#bulkTopic','#bulkDifficulty'].forEach(s=>$(s).addEventListener(s==='#bulkKeyword'?'input':'change',renderQuestions));
 loadCatalog();
}
document.addEventListener('DOMContentLoaded',init);
})();
