/** Generate a complete file-existence-based 3-PDF catalog from the public CEEC mirror.
 * Uses real Git trees rather than constructing links for files that may not exist.
 * Official CEEC direct links are collected separately by sync-official.mjs.
 */
import {writeFileSync,readFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const REV='4d87bdc12fb68dd2e719009d80017510aa789cce';
const API='https://api.github.com/repos/rbnyng/ceec/';
const exams=new Set(['學測','分科','指考']);
const subjects=new Set(['國綜','國寫','國文','英文','數學','數學A','數學B','數學甲','數學乙','社會','自然','歷史','地理','公民與社會','物理','化學','生物']);
const type=name=>/^試題內容\.pdf$/.test(name)?'paper':/^選擇(?:\(填\))?題答案\.pdf$/.test(name)?'answer':/^非選擇題(?:評分原則|評分標準|參考答案)\.pdf$/.test(name)?'rubric':null;
const raw=path=>'https://raw.githubusercontent.com/rbnyng/ceec/'+REV+'/'+path.split('/').map(encodeURIComponent).join('/');
export function generate(tree){
 const out={};
 for(const f of tree){
  if(f.type!=='blob'||(Number.isFinite(f.size)&&f.size<1024))continue;
  const m=/^(學測|分科|指考)\/(\d{2,3})\/([^/]+)\/([^/]+\.pdf)$/.exec(f.path);
  if(!m)continue;
  const [,exam,year,subject,name]=m,role=type(name);
  if(!exams.has(exam)||!subjects.has(subject)||!role)continue;
  const id=`${exam}:${Number(year)}:${subject}`,card=out[id]||(out[id]={});
  if(card[role])throw Error('duplicated PDF role: '+id+' '+role);
  card[role]={url:raw('archive/'+f.path),origin:'公開備份',filename:name};
 }
 const entries=Object.entries(out).sort(([a],[b])=>a.localeCompare(b,'zh-Hant'));
 return {schema:'exam-atlas-mirror-pdf-catalog-v1',source:'rbnyng/ceec',revision:REV,paperCount:entries.length,entries:Object.fromEntries(entries)};
}
async function json(path){const res=await fetch(API+path,{headers:{Accept:'application/vnd.github+json','User-Agent':'ExamAtlas-PDF-Index/1.0'}});if(!res.ok)throw Error(`GitHub API ${res.status} ${path}`);return res.json();}
async function main(){
 const fixture=process.argv.indexOf('--fixture');
 if(fixture!==-1){const tree=JSON.parse(readFileSync(process.argv[fixture+1],'utf8'));const out=generate(tree);if(out.paperCount<1)throw Error('fixture empty');console.log('Fixture:',out.paperCount);return;}
 const commit=await json('git/commits/'+REV);
 const root=await json('git/trees/'+commit.tree.sha);
 const archive=root.tree.find(x=>x.path==='archive'&&x.type==='tree');if(!archive)throw Error('Mirror archive directory not found');
 const data=await json('git/trees/'+archive.sha+'?recursive=1');
 if(data.truncated)throw Error('GitHub tree response truncated; refusing incomplete catalog');
 const result=generate(data.tree);
 if(result.paperCount<300)throw Error('Unexpectedly few historical exam papers: '+result.paperCount);
 const dest=resolve(ROOT,'data/pdf-catalog.json');mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,JSON.stringify(result,null,2)+'\n');
 console.log(`Generated ${result.paperCount} real year/subject PDF sets; ${Object.values(result.entries).filter(x=>x.answer).length} answer PDFs; ${Object.values(result.entries).filter(x=>x.rubric).length} grading PDFs.`);
}
main().catch(e=>{console.error(e);process.exitCode=1});
