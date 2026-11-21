const assert=require('node:assert/strict');
const pdf=require('../pdf-archive.js');
const source={'學測:115:國綜':[
 {label:'官方試題 PDF',url:'https://www.ceec.edu.tw/files/x.pdf'},
 {label:'選擇題答案 PDF',url:'https://www.ceec.edu.tw/files/a.pdf'},
 {label:'非選擇題評分原則 PDF',url:'https://www.ceec.edu.tw/files/r.pdf'}]};
const check=pdf.officialLinks('學測',115,'國綜',source);
assert.ok(check.paper.url.endsWith('x.pdf'));assert.ok(check.answer.url.endsWith('a.pdf'));assert.ok(check.rubric.url.endsWith('r.pdf'));
assert.equal(pdf.classifyLabel('選擇(填)題答案.pdf'),'answer');
assert.equal(pdf.classifyLabel('非選擇題評分原則.pdf'),'rubric');
assert.equal(pdf.classifyLabel('答題卷.pdf'),null);
const files=[
 {path:'archive/學測/83/國文/試題內容.pdf',type:'file',name:'試題內容.pdf'},
 {path:'archive/學測/83/國文/選擇題答案.pdf',type:'file',name:'選擇題答案.pdf'},
 {path:'archive/學測/83/數學/非選擇題評分原則.pdf',type:'file',name:'非選擇題評分原則.pdf'}
];
const b=pdf.groupFiles(files,'學測',83,'國文');assert.ok(b.paper.url.startsWith('https://raw.githubusercontent.com/rbnyng/ceec/4d87bdc'));assert.ok(b.answer);assert.equal(b.rubric,null);
assert.equal((pdf.html(b).match(/href=/g)||[]).length,2);
assert.ok(pdf.html(b).includes('未提供此檔案'));
const fake=async u=>({ok:true,json:async()=>files});
pdf.mirrorLinks('學測',83,'國文',{fetchImpl:fake}).then(links=>{
 assert.ok(links.paper&&links.answer);console.log('PDF source classification, 3-slot rendering and mirror-link checks passed');
},e=>{console.error(e);process.exitCode=1});
