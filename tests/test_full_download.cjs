/* Unit-level IndexedDB transaction mock: validates count checks, resume and storage. */
const assert=require('node:assert/strict');
const data=new Map(),meta=new Map();
const stores={papers:data,meta};
const db={objectStoreNames:{contains:(n)=>Boolean(stores[n])},createObjectStore(){},transaction(name){
 const tx={};tx.objectStore=()=>({
  get(k){const req={};queueMicrotask(()=>{req.result=stores[name].get(k);req.onsuccess?.();});return req;},
  put(value,key){queueMicrotask(()=>{stores[name].set(key??value.sourceFile,value);tx.oncomplete?.();});return {};},
  openCursor(){let entries=[...stores[name].entries()],i=0;const req={};const advance=()=>{queueMicrotask(()=>{req.result=i>=entries.length?null:{key:entries[i][0],value:entries[i++][1],continue:advance};req.onsuccess?.();});};advance();return req;}
 });return tx;
}};
global.indexedDB={open(){const req={result:db};queueMicrotask(()=>{req.onupgradeneeded?.();req.onsuccess?.();});return req;}};
global.window=global;
require('../data/archive/manifest-seed.js');
const dl=require('../full-download.js');
const adapter=require('../remote-archive.js');
(async()=>{
 const catalog=adapter.manifestToCatalog(window.ATLAS_SEED_MANIFEST);
 assert.equal(catalog.papers.length,416);
 assert.equal(catalog.expectedRecordsFromRemoteManifest,15446);
 const papers=catalog.papers.slice(0,4), total=papers.reduce((sum,p)=>sum+p.count,0);
 let calls=0,progress=0;
 const remote={REV:adapter.REV,async loadPaper(p){calls++;return {schema:'exam-atlas-open-archive-v1',sourceFile:p.sourceFile,questions:Array.from({length:p.count},(_,i)=>({id:p.sourceFile+'-'+i}))};}};
 const sub={papers,expectedRecordsFromRemoteManifest:total};
 const first=await dl.downloadAll(remote,sub,{onProgress:()=>progress++});
 assert.deepEqual([first.downloaded,first.skipped,first.failed,first.records],[4,0,0,total]);
 const again=await dl.downloadAll(remote,sub);
 assert.deepEqual([again.downloaded,again.skipped,again.failed,again.records],[0,4,0,total]);
 assert.equal(calls,4);
 assert.equal((await dl.status(remote,sub)).storedItems,total);
 assert.ok(progress>0);
 console.log('Offline index 416 papers / 15446 rows; IndexedDB download, resume, progress, cached load tests passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
