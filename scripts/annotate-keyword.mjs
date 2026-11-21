/** Provisional keyword suggestions on all locally imported historical exam items.
 * NOT model-based AI, NOT verification; explicit method flags and confidence.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const ctx=vm.createContext({window:{}});
vm.runInContext(readFileSync(resolve(ROOT,'data/curriculum.js'),'utf8'),ctx);
const courses=JSON.parse(JSON.stringify(ctx.window.ATLAS_CURRICULUM));
const classifier=require('../topic-hints.js');
const filename=resolve(ROOT,'data/archive/catalog.json');
const catalog=JSON.parse(readFileSync(filename,'utf8'));
let proposed=0,checked=0;
for(const p of catalog.papers||[]){
 if(!p.file)continue;
 const pathname=resolve(ROOT,p.file);
 if(!pathname.startsWith(resolve(ROOT,'data/archive/papers')+'/'))throw Error('invalid paper path');
 const doc=JSON.parse(readFileSync(pathname,'utf8'));
 for(const q of doc.questions||[]){
   checked++;
   if(q.aiClassified&&q.topicIds?.length)continue;
   const hint=classifier.suggest(q,courses);
   q.topicIds=hint.topicIds;q.topicHint=hint;
   if(hint.topicIds.length)proposed++;
 }
 writeFileSync(pathname,JSON.stringify(doc)+'\n');
 p.keywordSuggested=doc.questions.filter(q=>q.topicHint?.topicIds?.length).length;
}
catalog.keywordSuggestedRecords=(catalog.papers||[]).reduce((sum,p)=>sum+(p.keywordSuggested||0),0);
writeFileSync(filename,JSON.stringify(catalog)+'\n');
console.log(`Provisional keyword suggestions for ${proposed} of ${checked} imported records; none marked AI-verified.`);
