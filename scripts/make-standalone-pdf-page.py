from pathlib import Path
root=Path(__file__).resolve().parents[1]
official=(root/'data/official-links.js').read_text()
archive=(root/'pdf-archive.js').read_text()
html='''<!doctype html>
<html lang="zh-Hant"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>歷屆學測・分科 PDF｜Exam Atlas</title>
<style>
:root{font-family:-apple-system,BlinkMacSystemFont,"Noto Sans TC","Microsoft JhengHei",sans-serif;color:#1b293e;background:#f5f7fa}
*{box-sizing:border-box}body{margin:0;line-height:1.5}.wrap{max-width:1100px;margin:0 auto;padding:24px 18px 68px}
a{color:#1b62bb}.heading{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}.heading a{font-size:13px;text-decoration:none}
h1{font-size:clamp(24px,4vw,32px);letter-spacing:-.02em;margin:0}.muted{color:#697891}.summary{font-size:14px;color:#516074}
.filter{display:grid;grid-template-columns:repeat(3,minmax(0,1fr)) auto;gap:13px;align-items:end;padding:22px;background:white;border:1px solid #e1e6f0;border-radius:17px;margin:20px 0}
.filter label{font-size:13px;font-weight:700;display:grid;gap:7px;color:#4c5b71}.filter select{width:100%;border:1px solid #ccd6e5;border-radius:9px;padding:12px 10px;background:white;color:#1b293e;font-size:15px}.filter button{border:1px solid #b9ccea;background:#edf4ff;color:#184889;font-weight:700;padding:12px 14px;border-radius:9px;cursor:pointer}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}.card{background:white;border:1px solid #e0e6ef;border-radius:17px;padding:20px;box-shadow:0 5px 16px #1d2c4410}.card header{display:flex;align-items:baseline;justify-content:space-between;gap:10px}.card h2{font-size:19px;margin:0}.card .year{font-size:12px;color:#768394}
.paper-pdf-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:14px}.paper-pdf-link{display:flex;flex-direction:column;justify-content:center;gap:7px;padding:12px 10px;min-height:88px;text-decoration:none;border:1px solid #c7d8ea;background:#f0f7ff;border-radius:12px;color:#194d83;overflow-wrap:anywhere}.paper-pdf-link span{font-weight:750;font-size:14px}.paper-pdf-link small{font-size:11px;line-height:1.5;color:#476b92}.paper-pdf-link.absent{background:#f8f9fc;border-color:#ebedf2;color:#8893a1;cursor:default}.paper-pdf-link.absent small{color:#8d98a8}
.card-footer{margin:15px 0 0;font-size:12px;color:#637185}.card-footer a{font-size:12px}.hint{font-size:13px;line-height:1.7;background:#eff3fb;border-radius:12px;padding:13px 17px;margin:17px 0 22px;color:#4b5b77}.empty{padding:25px;background:white;border:1px solid #ddd;border-radius:10px}
@media(max-width:810px){.grid{grid-template-columns:1fr}.filter{grid-template-columns:repeat(2,minmax(0,1fr))}.filter button{grid-column:span 2}}
@media(max-width:520px){.wrap{padding:17px 12px 60px}.filter{grid-template-columns:repeat(2,minmax(0,1fr));padding:16px;gap:10px}.filter label:last-of-type{grid-column:span 2}.paper-pdf-grid{grid-template-columns:1fr}.paper-pdf-link{min-height:58px;padding:11px 13px}.card{padding:16px}}
</style></head><body>
<main class="wrap"><div class="heading"><h1>歷屆學測・分科 PDF</h1><a href="./index.html">返回 Exam Atlas 首頁</a></div>
<p class="summary">學測 83～115 學年度、分科 111～115 學年度。依照當年的實際科目，提供三種 PDF 入口。</p>
<section class="filter" aria-label="選擇考試年度考科"><label>考試<select id="exam"><option>學測</option><option>分科</option></select></label><label>學年度<select id="year"></select></label><label>考科<select id="subject"></select></label><button id="retry" type="button">重新核對連結</button></section>
<div class="hint" id="hint">優先顯示大考中心官方 PDF；未逐一建立官方直連的年份，從實際公開備份檔案索引查詢。沒有該類 PDF 或來源暫時失敗，都不會產生假的下載網址。</div>
<div id="summary" class="summary" aria-live="polite"></div><div class="grid" id="papers"></div>
</main>
<script>'''+official+'\n'+archive+'''\n(function(){'use strict';
 const names={學測:'https://www.ceec.edu.tw/xmfile?xsmsid=0J052424829869345634',分科:'https://www.ceec.edu.tw/xmfile?xsmsid=0J052427633128416650'};
 const get=id=>document.getElementById(id);
 function subjects(exam,year){return exam==='學測'?(year>=111?['國綜','國寫','英文','數學A','數學B','社會','自然']:year>=107?['國文','國寫','英文','數學','社會','自然']:['國文','英文','數學','社會','自然']):['數學甲',...(year>=114?['數學乙']:[]),'物理','化學','生物','歷史','地理','公民與社會'];}
 function fillYears(){const exam=get('exam').value,before=get('year').value,min=exam==='學測'?83:111;get('year').replaceChildren(...Array.from({length:116-min},(_,n)=>new Option(`${115-n} 學年度`,String(115-n))));if([...get('year').options].some(o=>o.value===before))get('year').value=before;fillSubjects();}
 function fillSubjects(){const exam=get('exam').value,year=Number(get('year').value),before=get('subject').value;
  get('subject').replaceChildren(new Option('全部考科','全部'),...subjects(exam,year).map(x=>new Option(x,x)));
  if([...get('subject').options].some(o=>o.value===before))get('subject').value=before;render();}
 let serial=0;
 async function render(){const n=++serial,exam=get('exam').value,year=Number(get('year').value),sub=get('subject').value;
  const chosen=sub==='全部'?subjects(exam,year):[sub];
  get('summary').textContent=`${exam} ${year} 學年度｜共 ${chosen.length} 個考科｜每科三個 PDF 位置`;
  get('papers').innerHTML=chosen.map(s=>`<article class="card" data-paper="${exam}:${year}:${s}"><header><h2>${s}</h2><span class="year">${year} ${exam}</span></header><div class="slots">${ATLAS_PDF_ARCHIVE.html(ATLAS_PDF_ARCHIVE.officialLinks(exam,year,s),{loading:true})}</div><p class="card-footer"><a target="_blank" rel="noopener noreferrer" href="${names[exam]}">大考中心官方歷屆原卷索引</a></p></article>`).join('');
  await Promise.all(chosen.map(async s=>{const data=await ATLAS_PDF_ARCHIVE.resolve(exam,year,s);if(n!==serial)return;const node=[...get('papers').children].find(e=>e.dataset.paper===`${exam}:${year}:${s}`);if(node)node.querySelector('.slots').innerHTML=ATLAS_PDF_ARCHIVE.html(data);}));
 }
 get('exam').addEventListener('change',fillYears);get('year').addEventListener('change',fillSubjects);get('subject').addEventListener('change',render);
 get('retry').addEventListener('click',async()=>{get('hint').textContent='重新檢查公開備份的 PDF 檔案目錄中…';try{await ATLAS_PDF_ARCHIVE.getCatalog(fetch,{forceRefresh:true});get('hint').textContent='PDF 檔案清單已重新取得；官方直連優先。';}catch(e){get('hint').textContent='來源更新失敗：'+e.message+'。可點每張卡片下方的大考中心官方索引。';}await render();});
 fillYears();
})();
</script></body></html>'''
(root/'pdfs.html').write_text(html,encoding='utf8')
print('wrote pdfs.html',len(html),'bytes')
