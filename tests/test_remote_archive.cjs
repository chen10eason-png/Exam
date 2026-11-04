const assert=require('node:assert/strict');
const lib=require('../remote-archive.js');
const path='data/items/學測/115/chinese_reading.jsonl';
const manifest={total_rows:2,files:{[path]:2}};
const c=lib.manifestToCatalog(manifest);
assert.equal(c.expectedPapersFromRemoteManifest,1);
assert.equal(c.expectedRecordsFromRemoteManifest,2);
assert.equal(c.papers[0].year,115);
assert.equal(c.papers[0].subject,'國綜');
const items=[
 {item_uid:'學測115-chinese_reading-001',exam_system:'學測',year_roc:115,subject_zh:'國綜',number:1,stem:'題目內容A',options:{A:'甲',B:'乙',C:'丙',D:'丁'},keys:'C',p_value:89,item_flags:[]},
 {item_uid:'學測115-chinese_reading-002',exam_system:'學測',year_roc:115,subject_zh:'國綜',number:2,stem:null,options:{},keys:'D',p_value:20,item_flags:['not_extracted_bank_or_blank']}
];
const paper=lib.parsePaper(items.map(x=>JSON.stringify(x)).join('\n')+'\n',path,2);
assert.equal(paper.questions.length,2);
assert.equal(paper.questions[0].answerKey,'C');
assert.equal(paper.questions[0].difficulty,1);
assert.equal(paper.questions[1].difficulty,6);
assert.equal(paper.questions[1].readable,false);
assert.equal(paper.questions[1].reviewed,false);
assert.ok(paper.questions[1].issues.includes('missing_question_text'));
assert.throws(()=>lib.parsePaper(JSON.stringify(items[0]),path,2),/缺漏/);
assert.throws(()=>lib.manifestToCatalog({total_rows:3,files:{[path]:2}}),/不一致/);
assert.throws(()=>lib.url('data/items/../../secret'),/未允許/);
const cached=lib.getText(path,{fetchImpl: async (url)=>({ok:true,text:async()=>items.map(x=>JSON.stringify(x)).join('\n')})});
cached.then(x=>assert.ok(x.includes('國綜'))).then(()=>console.log('Remote manifest, validation, adapter tests passed'),e=>{console.error(e);process.exitCode=1});
