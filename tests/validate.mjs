import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const context=vm.createContext({window:{}});
for(const path of ['data/curriculum.js','data/questions.js','data/official-links.js','data/classification-examples.js','data/candidate-index.js'])vm.runInContext(readFileSync(resolve(root,path),'utf8'),context);
const topics=context.window.ATLAS_CURRICULUM,qs=context.window.ATLAS_SAMPLES;
const ids=new Set(),errors=[];
const examples=context.window.ATLAS_CLASSIFICATION_EXAMPLES;
for(const x of examples){for(const id of x.topicIds)if(!topics.some(t=>t.id===id))errors.push('Example references unknown curriculum: '+id);if(!context.window.ATLAS_OFFICIAL_PDFS[`${x.exam}:${x.year}:${x.paperSubject}`])errors.push('Example lacks official PDF source');if(!(x.difficulty>=1&&x.difficulty<=6))errors.push('Example difficulty invalid');}
if(!Array.isArray(context.window.ATLAS_CANDIDATE_INDEX))errors.push('Missing public index');
if(topics.length<30||qs.length<30)errors.push('Sample dataset too small');
for(const q of qs){if(ids.has(q.id))errors.push('Duplicate ID: '+q.id);ids.add(q.id);let t=topics.find(t=>t.id===q.topicId);if(!t||t.subject!==q.subject)errors.push('Missing curriculum tag for '+q.id);if(q.options.length<2||!q.answer.length||q.answer.some(a=>a<0||a>=q.options.length))errors.push('Answer invalid '+q.id);if(!Number.isInteger(q.difficulty)||q.difficulty<1||q.difficulty>6)errors.push('Difficulty invalid '+q.id);if(q.exam!=='原創練習')errors.push('Sample exam is not original '+q.id);}
console.log(`Curriculum: ${topics.length} units; original: ${qs.length} questions; ${ids.size} unique IDs; classified previews: ${examples.length}; official paper links: ${Object.keys(context.window.ATLAS_OFFICIAL_PDFS).length}`);
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log('Validation passed');
