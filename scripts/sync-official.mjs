/**
 * GitHub Actions 上定期從 CEEC「一般試題」索引收集官方 PDF 連結。
 * 只保存 metadata 與 PDF URL，不複製試卷，也不做未驗證的題目 OCR。
 * 可用 node scripts/sync-official.mjs --fixture 進行本地解析器自測。
 */
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const BASE='https://www.ceec.edu.tw/xmfile';
const RECORDS=[{id:'0J052424829869345634',pages:19,category:'學測'},{id:'0J052427633128416650',pages:25,category:'分科'}];
const SUBJECTS=['國綜','國寫','國文','英文','數學A','數學B','數學甲','數學乙','數學','公民與社會','社會','自然','物理','化學','生物','歷史','地理'];
function htmlDecode(s){return s.replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)));}
function toText(s){return htmlDecode(s.replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<style\b[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim());}
function isCeecPdf(url){try{let u=new URL(url,BASE);return u.protocol==='https:'&&u.hostname==='www.ceec.edu.tw'&&/\.pdf(?:$|\?)/i.test(u.href)?u.href:null;}catch{return null;}}
function extract(html){const res=[];for(const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
 const raw=match[1],txt=toText(raw).replace(/\s+/g,'');
 const title=txt.match(/(\d{2,3})學年度(學科能力測驗|分科測驗|指定科目考試)[－—–-]?([\s\S]{1,30})/);
 if(!title)continue;
 const year=Number(title[1]);const exam=title[2]==='學科能力測驗'?'學測':title[2]==='指定科目考試'?'指考':'分科';
 const subject=SUBJECTS.find(s=>title[3].startsWith(s));if(!subject)continue;
 const links=[];for(const a of raw.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
  const href=a[1].match(/href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);if(!href)continue;
  const u=isCeecPdf(htmlDecode(href[1]||href[2]||href[3]));if(!u)continue;
  const label=toText(a[2]);if(!/試題內容|答題卷|答案|評分原則/.test(label))continue;
  if(!links.some(x=>x.url===u))links.push({label:label==='試題內容'?'官方試題 PDF':label+' PDF',url:u});
 }
 if(links.length)res.push({year,exam,subject,links});
}return res;}
async function fetchPage(base,page){const u=`${BASE}?page=${page}&xsmsid=${base.id}`;const r=await fetch(u,{headers:{'User-Agent':'ExamAtlas-SourceIndex/0.1 (educational-link-index; weekly)','Accept':'text/html'}});if(!r.ok)throw Error(`${u} -> ${r.status}`);return r.text();}
async function main(){if(process.argv.includes('--fixture')){const html='<table><tr><td>115學年度學科能力測驗－數學A</td><td><a href="/files/test.pdf">試題內容</a> <a href="/files/answer.pdf">選擇題答案</a></td></tr><tr><td>110學年度指定科目考試－物理</td><td><a href="/files/physics.pdf">試題內容</a></td></tr></table>';const out=extract(html);if(out.length!==2||out[0].subject!=='數學A'||out[1].exam!=='指考')throw Error('Parser fixture failed');console.log('Parser fixture passed',out.length);return;}
 const out={},found=[];for(const base of RECORDS){const first=await fetchPage(base,1);const countMatch=toText(first).match(/共\s*(\d+)\s*頁/);const pages=countMatch?Number(countMatch[1]):base.pages;if(pages<1||pages>100)throw Error('官方頁數異常：'+pages);console.log(`${base.category}: scanning ${pages} pages`);for(let page=1;page<=pages;page++){
  try{const entries=extract(page===1?first:await fetchPage(base,page));found.push(...entries);for(const r of entries){const key=`${r.exam}:${r.year}:${r.subject}`;const prev=out[key]||[];for(const l of r.links)if(!prev.some(x=>x.url===l.url))prev.push(l);out[key]=prev;}}
  catch(e){throw Error(`Failed to read ${base.category} page ${page}: ${e.message}`);}
  if(page<pages)await new Promise(r=>setTimeout(r,450));
 }}
 const years=new Set(found.map(x=>x.year));if(Object.keys(out).length<400||!('學測:115:數學A'in out)||!('分科:115:數學甲'in out)||years.size<25||!('學測:83:國文'in out))throw Error(`Safety gate: insufficient parsed entries (${found.length}), leaving previous snapshot unchanged`);
 const output='// 自動擷取大考中心官方公開 PDF 連結；只保存URL與文件類型，沒有複製試卷內容。\nwindow.ATLAS_OFFICIAL_PDFS='+JSON.stringify(Object.fromEntries(Object.entries(out).sort(([a],[b])=>a.localeCompare(b,'zh-Hant'))),null,2)+';\n';
 writeFileSync(resolve(ROOT,'data/official-links.js'),output,'utf8');console.log(`Synced ${Object.keys(out).length} official exam subject/year entries, ${found.length} parsed records`);
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
