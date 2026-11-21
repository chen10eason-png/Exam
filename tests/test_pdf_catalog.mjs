import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const data=JSON.parse(readFileSync(resolve('data/pdf-catalog.json'),'utf8'));
assert.equal(data.schema,'exam-atlas-mirror-pdf-catalog-v1');
assert.equal(data.paperCount,Object.keys(data.entries).length);
assert.ok(data.paperCount>=300);
for(const [id,roles] of Object.entries(data.entries)){
 assert.match(id,/^(學測|分科|指考):\d{2,3}:[^:]+$/);
 assert.ok(roles.paper?.url?.endsWith('.pdf'));
 for(const [kind,link] of Object.entries(roles)){
  assert.ok(['paper','answer','rubric'].includes(kind));
  const u=new URL(link.url);assert.equal(u.hostname,'raw.githubusercontent.com');
  assert.ok(u.pathname.includes('/4d87bdc12fb68dd2e719009d80017510aa789cce/archive/'));
 }
}
console.log('PDF catalog structure passed: '+data.paperCount+' papers');
