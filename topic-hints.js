/* Rule-based 108-curriculum topic suggestions, NOT AI or human-reviewed labels.
 * Tags are multi-label, conservative, and only set for unambiguous term matches.
 * AI classification from GitHub Models may replace these provisional suggestions.
 */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.ATLAS_TOPIC_HINTS=api;
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:null),function(){
'use strict';
const canonical=s=>{
 s=String(s||'');if(s.startsWith('數學'))return '數學';if(['國文','國綜','國寫'].includes(s))return '國文';if(s==='公民與社會')return '公民';if(s==='地科')return '地球科學';return s;
};
const MIX={自然:new Set(['物理','化學','生物','地球科學']),社會:new Set(['歷史','地理','公民'])};
function suggest(q,courses,{maxTags=3}={}){
 const subject=canonical(q?.subject||q?.subject_zh||'');
 const text=[q.question||q.stem||'',q.groupPassage||q.group_passage||''].join(' ').toLowerCase();
 if(!text.trim()||!Array.isArray(courses)||!courses.length)return {topicIds:[],confidence:0,method:'keyword-suggested',reason:'missing-text-or-curriculum'};
 const eligible=MIX[subject]||new Set([subject]);
 const candidates=[];
 for(const c of courses){
   if(!eligible.has(c.subject))continue;
   const keys=(c.keywords||[]).filter(k=>String(k).trim().length>=2);
   let score=0,matched=[];
   for(const k of keys){
     const term=String(k).toLowerCase();
     // Generic English connectives/common words are poor predictors without contextual embeddings.
     if(c.subject==='英文'&&/^(who|which|past|present|however|essay|context|writing|reading)$/i.test(term))continue;
     if(text.includes(term)){score+=term.length>=4?3:2;matched.push(k);}
   }
   if(c.title && text.includes(c.title.toLowerCase()))score+=5;
   if(score>=2)candidates.push({id:c.id,score,matched});
 }
 candidates.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
 const top=candidates.slice(0,maxTags);
 return {topicIds:top.map(x=>x.id),confidence:top.length?Math.min(.6,.22+.045*top[0].score):0,method:'keyword-suggested',matched:top[0]?.matched||[],reason:top.length?'requires-human-or-AI-review':'no-confident-keyword-match'};
}
return {canonical,suggest};
});
