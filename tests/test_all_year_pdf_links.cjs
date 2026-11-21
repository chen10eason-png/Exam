const assert=require('node:assert/strict');
const fs=require('node:fs');
const pdf=require('../pdf-archive.js');
const ROOT='87ffb3d58ab112f079fe01aa5d90d7fa71e2ee37';
const FILES=[];
function paper(exam,year,subject,hasRubric=true){
 for(const [filename,needed] of [['試題內容.pdf',true],['選擇題答案.pdf',true],['非選擇題評分原則.pdf',hasRubric]]){
  if(needed)FILES.push({path:`${exam}/${year}/${subject}/${filename}`,type:'blob',size:6000});
 }
 FILES.push({path:`${exam}/${year}/${subject}/答題卷.pdf`,type:'blob',size:8000});
}
for(let year=83;year<=115;year++){
 const subjects=year>=111?['國綜','國寫','英文','數學A','數學B','社會','自然']:year>=107?['國文','國寫','英文','數學','社會','自然']:['國文','英文','數學','社會','自然'];
 subjects.forEach(subject=>paper('學測',year,subject,year>=107));
}
for(let year=111;year<=115;year++)['數學甲',...(year>=114?['數學乙']:[]),'物理','化學','生物','歷史','地理','公民與社會'].forEach(subject=>paper('分科',year,subject,true));
for(let y=101;y<=110;y++)['國文','英文','數學甲','數學乙','歷史','地理','物理','化學','生物','公民與社會'].forEach(s=>paper('指考',y,s,false));
// A deliberately malformed/placeholder blob must never become a PDF link.
FILES.push({path:'學測/83/國文/非選擇題評分標準.pdf',type:'blob',size:160});
const local=pdf.generateCatalog(FILES);
assert.ok(local.paperCount>=300,`paperCount ${local.paperCount}`);
assert.ok(local.entries['學測:107:國寫']?.paper);
assert.ok(local.entries['學測:83:國文']?.paper);
assert.equal(local.entries['學測:83:國文']?.rubric,undefined);
assert.ok(local.entries['分科:114:數學乙']?.answer);
assert.equal(local.entries['分科:113:數學乙'],undefined);
assert.equal(Object.keys(local.entries['學測:83:國文']).length,2);
assert.ok(Object.values(local.entries).every(s=>s.paper&&s.answer));
const allOfficial=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../data/official-links.js'),'utf8').match(/window.ATLAS_OFFICIAL_PDFS=({[\s\S]*});/)[1]);
for(const [exam,year,subject] of [['學測',115,'國綜'],['學測',114,'國綜'],['學測',114,'國寫'],['分科',115,'數學甲'],['分科',114,'數學甲']]){
 const entry=pdf.officialLinks(exam,year,subject,allOfficial);
 assert.ok(entry.paper,`missing official paper ${year} ${exam} ${subject}`);
 assert.ok(entry.rubric,`missing official rubric ${year} ${exam} ${subject}`);
 assert.ok(!entry.paper.url.includes('raw.githubusercontent.com'));
}
let fetched=[];
const fakeFetch=async url=>{
 fetched.push(String(url));
 if(String(url)==='./data/pdf-catalog.json')return {ok:false,status:404};
 if(String(url).includes('/git/trees/'+ROOT))return {ok:true,json:async()=>({tree:[{path:'archive',sha:'archiveroot',type:'tree'}]})};
 if(String(url).includes('/git/trees/archiveroot'))return {ok:true,json:async()=>({tree:FILES,truncated:false})};
 throw Error('unexpected network: '+url);
};
(async()=>{
 const snapshot=await pdf.getCatalog(fakeFetch,{forceRefresh:true});
 assert.equal(snapshot.paperCount,local.paperCount);
 assert.equal(fetched.length,2,'must read two git trees rather than per-paper GitHub API');
 const a=await pdf.resolve('學測',83,'國文',{fetchImpl:fakeFetch,catalog:snapshot,officialSource:allOfficial});
 assert.ok(a.paper&&a.answer&&!a.rubric);
 assert.ok(pdf.html(a).includes('未提供'));
 const b=await pdf.resolve('學測',115,'國綜',{fetchImpl:fakeFetch,catalog:snapshot,officialSource:allOfficial});
 assert.ok(b.paper&&b.answer&&b.rubric);
 assert.equal(b.paper.origin,'大考中心','must prefer official CEEC PDF');
 assert.equal((pdf.html(b).match(/class="paper-pdf-link"/g)||[]).length,3);
 const c=await pdf.resolve('分科',111,'物理',{fetchImpl:fakeFetch,catalog:snapshot,officialSource:allOfficial});
 assert.ok(c.paper&&c.answer&&c.rubric);
 console.log('PASS: 83–115 學測／111–115 分科 + correct PDF roles, missing documents, official priority, one-time archive tree index');
})().catch(err=>{console.error(err);process.exitCode=1});
