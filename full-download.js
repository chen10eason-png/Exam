/* One-click, resumable materialization of the complete CEEC extraction dataset.
   This does not turn extracted items into verified official transcriptions.
   Per-paper IndexedDB storage avoids localStorage size limits on mobile. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.ATLAS_FULL_DOWNLOAD=api;
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:null),function(){
 'use strict';
 const DB_PREFIX='exam-atlas-exam-corpus-';
 let dbPromise=null;
 const validPath=/^data\/items\/(學測|學測補|指考|指考補|分科)\/\d{2,3}\/[a-z][a-z0-9_]*\.jsonl$/;
 function dbName(rev){return DB_PREFIX+String(rev||'unknown').slice(0,14);}
 function open(rev){
   if(dbPromise)return dbPromise;
   if(typeof indexedDB==='undefined')return Promise.reject(Error('此瀏覽器不支援離線題庫儲存'));
   dbPromise=new Promise((resolve,reject)=>{
     const request=indexedDB.open(dbName(rev),1);
     request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('papers'))db.createObjectStore('papers',{keyPath:'sourceFile'});if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta');};
     request.onerror=()=>reject(request.error||Error('無法建立離線題庫'));
     request.onsuccess=()=>resolve(request.result);
   });return dbPromise;
 }
 async function get(rev,path){
   if(!validPath.test(path))throw Error('不合法的分卷路徑');const db=await open(rev);
   return new Promise((resolve,reject)=>{const tx=db.transaction('papers','readonly');const r=tx.objectStore('papers').get(path);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error||Error('讀取題庫失敗'));});
 }
 async function put(rev,data){
   if(!validPath.test(data?.sourceFile)||!Array.isArray(data?.questions))throw Error('題庫資料格式不正確');
   const db=await open(rev);return new Promise((resolve,reject)=>{
     const tx=db.transaction('papers','readwrite');tx.objectStore('papers').put(data);tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error||Error('寫入失敗'));tx.onabort=()=>reject(tx.error||Error('儲存空間不足或寫入失敗'));
   });
 }
 async function getMeta(rev,key){const db=await open(rev);return new Promise((resolve,reject)=>{const r=db.transaction('meta','readonly').objectStore('meta').get(key);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);});}
 async function putMeta(rev,key,value){const db=await open(rev);return new Promise((resolve,reject)=>{const t=db.transaction('meta','readwrite');t.objectStore('meta').put(value,key);t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);});}
 async function cacheCatalog(remote,catalog){if(catalog?.papers?.length)await putMeta(remote.REV,'catalog',catalog);}
 async function savedCatalog(remote){return getMeta(remote.REV,'catalog');}
 async function load(remote,paper){
   if(!remote||!paper?.sourceFile||!Number.isInteger(paper.count))throw Error('分卷資料不完整');
   const cached=await get(remote.REV,paper.sourceFile).catch(()=>null);
   if(cached?.questions?.length===paper.count)return cached;
   const result=await remote.loadPaper(paper);
   await put(remote.REV,result).catch(()=>{}); // Full offline persistence may fail (Safari storage quotas); online viewing still works.
   return result;
 }
 async function status(remote,catalog){
   if(!remote||!catalog?.papers?.length)return {storedPapers:0,storedItems:0,totalPapers:0,totalItems:0};
   let storedPapers=0,storedItems=0;const db=await open(remote.REV);
   const counts=new Map(catalog.papers.map(p=>[p.sourceFile,p.count]));
   await new Promise((resolve,reject)=>{
     const r=db.transaction('papers','readonly').objectStore('papers').openCursor();
     r.onsuccess=()=>{const c=r.result;if(!c){resolve();return;}const item=c.value;const expected=counts.get(item.sourceFile);if(expected&&item.questions?.length===expected){storedPapers++;storedItems+=expected;}c.continue();};r.onerror=()=>reject(r.error);
   });
   return {storedPapers,storedItems,totalPapers:catalog.papers.length,totalItems:catalog.expectedRecordsFromRemoteManifest||0};
 }
 async function downloadAll(remote,catalog,{concurrency=4,onProgress=()=>{},shouldStop=()=>false,retries=2}={}){
   if(!remote||!Array.isArray(catalog?.papers)||!catalog.papers.length)throw Error('沒有有效的歷屆分卷索引');
   await cacheCatalog(remote,catalog);
   const papers=catalog.papers;
   let next=0,done=0,downloaded=0,skipped=0,failed=0,records=0;
   const errors=[];
   const progress=()=>onProgress({done,total:papers.length,downloaded,skipped,failed,records,errors:errors.slice(-8),stopped:shouldStop()});
   const worker=async()=>{while(!shouldStop()){
     const i=next++;if(i>=papers.length)return;const p=papers[i];
     try{
       let existing=await get(remote.REV,p.sourceFile);
       if(existing?.questions?.length===p.count){skipped++;records+=p.count;}
       else {
         let lastError;
         for(let attempt=0;attempt<=retries;attempt++){
           if(shouldStop())break;
           try{const got=await remote.loadPaper({...p,remote:true},{timeoutMs:24000});await put(remote.REV,got);downloaded++;records+=p.count;lastError=null;break;}
           catch(err){lastError=err;if(attempt<retries)await new Promise(resolve=>setTimeout(resolve,(attempt+1)*850));}
         }
         if(lastError)throw lastError;
       }
     }catch(e){failed++;errors.push({sourceFile:p.sourceFile,reason:String(e?.message||e).slice(0,180)});}
     finally{done++;progress();}
   }};
   progress();await Promise.all(Array.from({length:Math.min(Math.max(1,concurrency),6)},()=>worker()));
   await putMeta(remote.REV,'lastImport',{time:new Date().toISOString(),done,total:papers.length,downloaded,skipped,failed,errors}).catch(()=>{});
   return {done,total:papers.length,downloaded,skipped,failed,records,errors,stopped:shouldStop()};
 }
 return {dbName,open,get,put,getMeta,putMeta,cacheCatalog,savedCatalog,load,status,downloadAll};
});
