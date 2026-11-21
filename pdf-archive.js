/** Direct PDF link registry for 83–115 GSAT and 111–115 AST.
 * Official CEEC PDF URLs take priority. Historical mirror links are built ONLY
 * from actual file entries in the pinned public Git tree, not guessed paths.
 * If the tree is unreachable, show a source error rather than pretend absence.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ATLAS_PDF_ARCHIVE=api;
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:null),function(){
'use strict';
const OWNER='rbnyng', REPO='ceec';
const REV='4d87bdc12fb68dd2e719009d80017510aa789cce';
const ROOT_TREE='87ffb3d58ab112f079fe01aa5d90d7fa71e2ee37';
const BASE=`https://raw.githubusercontent.com/${OWNER}/${REPO}/${REV}/`;
const API=`https://api.github.com/repos/${OWNER}/${REPO}`;
const VALID_EXAMS=new Set(['學測','分科','指考']);
const SOURCE={學測:'https://www.ceec.edu.tw/xmfile?xsmsid=0J052424829869345634',分科:'https://www.ceec.edu.tw/xmfile?xsmsid=0J052427633128416650',指考:'https://www.ceec.edu.tw/xmfile?xsmsid=0J052427633128416650'};
const FIELDS=[['paper','試題 PDF'],['answer','答案 PDF'],['rubric','非選擇題評分原則 PDF']];
const CACHE_KEY='exam-atlas-pdf-source-tree-v3-'+REV;
const CACHE_DAYS=7;
const resolvedCache=new Map();
let indexPromise=null;
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key=(exam,year,subject)=>`${exam}:${Number(year)}:${subject}`;
const encodePath=parts=>parts.map(encodeURIComponent).join('/');
function classifyLabel(s){
 const x=String(s||'').replace(/\s+/g,'');
 if(/非選擇題.*(?:評分|參考答案)|評分原則|評分標準/.test(x))return 'rubric';
 if(/(?:選擇|選填|標準|參考).*答案/.test(x) && !/非選擇題/.test(x))return 'answer';
 if(/試題內容|官方試題|試卷|試題PDF/.test(x)&&!/答題卷|參考試卷/.test(x))return 'paper';
 return null;
}
function validPdfUrl(value,official=false){
 try{const u=new URL(value);return u.protocol==='https:'&&/\.pdf(?:$|\?)/i.test(u.href)&&(!official||u.hostname==='www.ceec.edu.tw')?u.href:null;}catch{return null;}
}
function officialLinks(exam,year,subject,source){
 const all=source||((typeof window!=='undefined'&&window.ATLAS_OFFICIAL_PDFS)||{});
 const links=all[key(exam,year,subject)]||[];
 const out={paper:null,answer:null,rubric:null};
 for(const item of links){
  const role=classifyLabel(item?.label),url=validPdfUrl(item?.url,true);
  if(role&&url&&!out[role])out[role]={url,origin:'大考中心',filename:String(item.label||'')};
 }
 return out;
}
function groupFiles(files,exam,year,subject){
 if(!VALID_EXAMS.has(exam)||!Number.isInteger(Number(year))||!/^[^/:]{1,30}$/.test(subject))throw Error('考科資料不正確');
 const out={paper:null,answer:null,rubric:null};
 const prefix=['archive',exam,String(year),subject];
 for(const f of files){
  if(!f||f.type!=='file'||!/\.pdf$/i.test(f.name||'')||(Number.isFinite(f.size)&&f.size<1024))continue;
  const role=classifyLabel(f.name);
  if(!role||out[role]||f.path!==[...prefix,f.name].join('/'))continue;
  out[role]={url:BASE+encodePath([...prefix,f.name]),origin:'公開備份',filename:f.name};
 }
 return out;
}
function generateCatalog(tree){
 if(!Array.isArray(tree))throw Error('公開備份檔案樹格式不正確');
 const entries={};
 for(const f of tree){
  if(!f||f.type!=='blob'||(Number.isFinite(f.size)&&f.size<1024))continue;
  const m=/^(?:archive\/)?(學測|分科|指考)\/(\d{2,3})\/([^/]+)\/([^/]+\.pdf)$/i.exec(f.path||'');
  if(!m)continue;
  const [,exam,y,subject,name]=m,year=Number(y),role=classifyLabel(name);
  if(!role||year<83||year>115)continue;
  const id=key(exam,year,subject),entry=entries[id]||(entries[id]={});
  if(!entry[role])entry[role]={url:BASE+encodePath(['archive',exam,String(year),subject,name]),origin:'公開備份',filename:name};
 }
 return {schema:'exam-atlas-mirror-pdf-catalog-v1',source:'rbnyng/ceec',revision:REV,paperCount:Object.keys(entries).length,entries};
}
function isValidCatalog(x){return x?.schema==='exam-atlas-mirror-pdf-catalog-v1'&&x.revision===REV&&x.paperCount>200&&x.entries&&typeof x.entries==='object';}
function cachedCatalog(){
 try{if(typeof localStorage==='undefined')return null;const x=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');return x?.at>Date.now()-CACHE_DAYS*86400000&&isValidCatalog(x.catalog)?x.catalog:null;}catch{return null;}
}
function persistCatalog(catalog){
 try{if(typeof localStorage!=='undefined')localStorage.setItem(CACHE_KEY,JSON.stringify({at:Date.now(),catalog}));}catch{}
}
async function fetchJson(url,fetchImpl,{timeoutMs=18000}={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{const response=await fetchImpl(url,{mode:'cors',signal:controller.signal,headers:{Accept:'application/vnd.github+json'}});
  if(!response.ok)throw Error('來源 HTTP '+response.status);
  return await response.json();
 }finally{clearTimeout(timer);}
}
/** One request for the WHOLE archive tree, instead of 7 GitHub API calls per year. */
async function fetchWholeTree(fetchImpl){
 const rootTree=await fetchJson(`${API}/git/trees/${ROOT_TREE}`,fetchImpl,{timeoutMs:18000});
 const archive=rootTree.tree?.find(item=>item.path==='archive'&&item.type==='tree');
 if(!archive?.sha)throw Error('公開備份缺少 archive 目錄');
 const body=await fetchJson(`${API}/git/trees/${archive.sha}?recursive=1`,fetchImpl,{timeoutMs:25000});
 if(body.truncated)throw Error('公開備份清單遭截斷');
 const catalog=generateCatalog(body.tree);
 if(catalog.paperCount<200)throw Error('公開備份回傳不完整（只有 '+catalog.paperCount+' 份）');
 return catalog;
}
async function getCatalog(fetchImpl=(typeof fetch==='function'?fetch:undefined),opts={}){
 if(!fetchImpl)throw Error('無法載入 PDF 清單');
 if(!opts.forceRefresh&&indexPromise)return indexPromise;
 const task=(async()=>{
  if(!opts.forceRefresh){
   const existing=cachedCatalog();if(existing)return existing;
   try{const response=await fetchImpl('./data/pdf-catalog.json',{cache:'no-store'});
    if(response.ok){const saved=await response.json();if(isValidCatalog(saved)){persistCatalog(saved);return saved;}}
   }catch{}
  }
  const catalog=await fetchWholeTree(fetchImpl);persistCatalog(catalog);return catalog;
 })();
 if(opts.forceRefresh)return task;
 indexPromise=task.catch(err=>{indexPromise=null;throw err;});
 return indexPromise;
}
async function mirrorLinks(exam,year,subject,{fetchImpl=(typeof fetch==='function'?fetch:undefined),timeoutMs=15000}={}){
 const path=encodePath(['archive',exam,String(year),subject]);
 const listing=await fetchJson(`${API}/contents/${path}?ref=${REV}`,fetchImpl,{timeoutMs});
 if(!Array.isArray(listing))throw Error('來源檔案清單格式錯誤');
 return groupFiles(listing,exam,year,subject);
}
async function resolve(exam,year,subject,opts={}){
 const id=key(exam,year,subject);
 if(!VALID_EXAMS.has(exam)||!Number.isInteger(Number(year))||!subject)return {paper:null,answer:null,rubric:null,error:'考試年度／科目不正確'};
 if(!opts.fetchImpl&&resolvedCache.has(id))return resolvedCache.get(id);
 const official=officialLinks(exam,year,subject,opts.officialSource);
 let mirror={},error=null;
 if(FIELDS.some(([role])=>!official[role])){
  try{
   const catalog=opts.catalog||await getCatalog(opts.fetchImpl);
   mirror=catalog.entries[id]||{};
   // Older copies occasionally have a paper omitted from the generated catalog.
   if(!Object.keys(mirror).length&&opts.allowPerPaperFallback!==false){
    try{mirror=await mirrorLinks(exam,year,subject,opts);}catch(e){error=e.message;}
   }
  }catch(e){
   try{mirror=await mirrorLinks(exam,year,subject,opts);}catch(e2){error=`${e.message}；${e2.message}`;}
  }
 }
 const result={paper:official.paper||mirror.paper||null,answer:official.answer||mirror.answer||null,rubric:official.rubric||mirror.rubric||null,error};
 if(!opts.fetchImpl&&(!error||FIELDS.every(([role])=>result[role])))resolvedCache.set(id,result);
 return result;
}
function html(slots,{loading=false}={}){
 return `<div class="paper-pdf-grid">${FIELDS.map(([role,label])=>{
  const value=slots?.[role],url=value&&validPdfUrl(value.url);
  if(url)return `<a class="paper-pdf-link" data-type="${role}" href="${esc(url)}" target="_blank" rel="noopener noreferrer"><span>${label}</span><small>${esc(value.origin)} · 開啟 PDF ↗</small></a>`;
  const status=loading?'查詢檔案中…':slots?.error?'連結查詢失敗（不是未提供）':'未找到此 PDF／未提供此檔案';
  return `<span class="paper-pdf-link absent" data-type="${role}" aria-disabled="true"><span>${label}</span><small>${esc(status)}</small></span>`;
 }).join('')}</div>`;
}
function sourceUrl(exam){return SOURCE[exam]||SOURCE['學測'];}
async function enhanceCards(exam,year,subjects,container){
 const cards=Array.from(container.querySelectorAll('[data-pdf-paper]'));
 await Promise.all(cards.map(async card=>{
  const subject=card.getAttribute('data-subject'),wanted=key(exam,year,subject);
  if(!subjects.includes(subject)||card.getAttribute('data-pdf-paper')!==wanted)return;
  const target=card.querySelector('.pdf-three-slots');if(!target)return;
  // Show verified official links immediately; fill missing slots from the archive asynchronously.
  target.innerHTML=html(officialLinks(exam,year,subject),{loading:true});
  const data=await resolve(exam,year,subject);
  if(card.isConnected&&card.getAttribute('data-pdf-paper')===wanted)target.innerHTML=html(data);
 }));
}
return {REV,ROOT_TREE,key,sourceUrl,classifyLabel,officialLinks,groupFiles,generateCatalog,fetchWholeTree,mirrorLinks,resolve,html,enhanceCards,getCatalog};
});
