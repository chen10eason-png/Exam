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
  let resp=await fetch('./data/archive/catalog.json',{cache:'no-store'});
  if(!resp.ok)throw Error('HTTP '+resp.status);
  catalog=await resp.json();
  summary.textContent=catalog.importedPapers?
   `來源資料已匯入 ${catalog.importedPapers} 份、${catalog.importedRecords} 題；其中 ${catalog.readableRecords} 題有可讀題幹。AI 單元分類與逐題原卷核對尚未完成。`:
   '尚未執行大量歷屆真題匯入，這裡目前沒有可查詢的逐題資料。';
  const papers=catalog.papers||[];
  sel('#bulkExam',[...new Set(papers.map(x=>x.exam))].sort(),'所有考試');
  sel('#bulkYear',[...new Set(papers.map(x=>x.year))].sort((a,b)=>b-a),'所有學年度');
  sel('#bulkSubject',[...new Set(papers.map(x=>x.subject))].sort((a,b)=>a.localeCompare(b,'zh-Hant')),'所有考科');
  renderPapers();
 }catch(e){summary.textContent='無法讀取大規模題庫目錄：'+e.message;}
}
function renderPapers(){
 const root=$('#bulkPapers');if(!catalog)return;
 const exam=$('#bulkExam').value,year=$('#bulkYear').value,subject=$('#bulkSubject').value;
 let filtered=(catalog.papers||[]).filter(p=>(!exam||p.exam===exam)&&(!year||String(p.year)===year)&&(!subject||p.subject===subject));
 $('#bulkListCount').textContent=`${filtered.length} 份試卷`;
 if(filtered.length>80){filtered=filtered.slice(0,80);$('#bulkListCount').textContent+='（僅顯示前 80 份，請縮小條件）';}
 root.innerHTML=filtered.length?filtered.map(p=>`<button class="bulk-paper" data-file="${esc(p.file)}"><strong>${esc(p.year)} ${esc(p.exam)} ${esc(p.subject)}</strong><small>${p.count} 題 · 可讀 ${p.readable} 題 · 需核對</small></button>`).join(''):'<p class="mini-hint">此條件下尚未取得逐題資料。</p>';
 root.querySelectorAll('button[data-file]').forEach(b=>b.addEventListener('click',()=>loadPaper(b.dataset.file)));
}
async function loadPaper(file){
 if(!catalog?.papers.some(p=>p.file===file))return;
 const detail=$('#bulkQuestions');detail.textContent='讀取題目中…';
 try{
  const r=await fetch('./'+file,{cache:'default'});
  if(!r.ok)throw Error('HTTP '+r.status);
  const payload=await r.json();
  if(payload.schema!=='exam-atlas-open-archive-v1'||!Array.isArray(payload.questions))throw Error('格式不符');
  paper=payload;
  selected=catalog.papers.find(p=>p.file===file);
  $('#bulkChosen').textContent=`${selected.year} 年 ${selected.exam} ${selected.subject} · ${paper.questions.length} 道題`;
  $('#bulkKeyword').value='';
  $('#bulkReadability').value='';$('#bulkTopic').value='';$('#bulkDifficulty').value='';
  renderQuestions();
 }catch(e){detail.textContent='讀取失敗：'+e.message;}
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
