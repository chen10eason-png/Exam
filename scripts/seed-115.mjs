/** One-time verified CEEC 115-year index bootstrap; URLs seen on official pages 2026-11-02.
 * No exam text is duplicated; full sync action will replace this bootstrap.
 */
import {writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const output={};
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const asset=(dir,name)=>`https://www.ceec.edu.tw/files/file_pool/1/${dir}/${encodeURIComponent(name).replaceAll('%2D','-').replaceAll('%2E','.').replaceAll('%28','%28').replaceAll('%29','%29')}`;
function add(exam,subject,paper,paperDir,answer,answerDir){
 const values=[];
 if(paper)values.push({label:'官方試題 PDF',url:asset(paperDir,paper)});
 if(answer)values.push({label:'選擇題答案 PDF',url:asset(answerDir,answer)});
 output[`${exam}:115:${subject}`]=values;
}
add('學測','國綜','01-115學測國綜試卷.pdf','0q054337448417166461','01-115學測國語文綜合能力測驗答案.pdf','0q040596675162309932');
add('學測','國寫','07-115學測國寫試卷.pdf','0q054338512775247597');
add('學測','英文','02-115學測英文試卷.pdf','0q054532302653501476','02-115學測英文答案.pdf','0q040594609847120321');
add('學測','數學A','03-115學測數學a試卷.pdf','0q054344158947111283','03-115學測數學a答案.pdf','0q040592802409726233');
add('學測','數學B','04-115學測數學b試卷.pdf','0q054533256912682493','04-115學測數學b答案.pdf','0q040592403413040721');
add('學測','社會','05-115學測社會試卷.pdf','0q054534130270752519','05-115學測社會答案.pdf','0q040582211712162219');
add('學測','自然','06-115學測自然試卷.pdf','0q054346117821958325','06-115學測自然答案.pdf','0q040579122726476606');
add('分科','數學甲','01-115分科測驗數學甲考科試卷.pdf','0q219352733537345169','01-115分科測驗數學甲選擇(填)題答案.pdf','0q219353124359062141');
add('分科','數學乙','08-115分科測驗數學乙考科試卷.pdf','0q219349271460336585','08-115分科測驗數學乙選擇(填)題答案.pdf','0q219349873827932684');
add('分科','歷史','02-115分科測驗歷史考科試卷.pdf','0q219347434676712514','02-115分科測驗歷史選擇題答案.pdf','0q219347855499439586');
add('分科','地理','03-115分科測驗地理考科試卷.pdf','0q219345898417166461','03-115分科測驗地理選擇題答案.pdf','0q219346379239893543');
add('分科','公民與社會','04-115分科測驗公民與社會考科試卷.pdf','0q219341941613542490','04-115分科測驗公民與社會選擇題答案.pdf','0q219342712435269473');
add('分科','物理','05-115分科測驗物理考科試卷.pdf','0q219337759038817846','05-115分科測驗物理選擇題答案.pdf','0q219338760851544819');
add('分科','化學','06-115分科測驗化學考科試卷.pdf','0q219335660333728749','06-115分科測驗化學選擇題答案.pdf','0q219340673640279375');
add('分科','生物','07-115分科測驗生物考科試卷.pdf','0q219333119090436237','07-115分科測驗生物選擇題答案.pdf','0q219339959482009359');
writeFileSync(resolve(root,'data/official-links.js'),`// 2026-11-02 已逐項核對大考中心官方試卷索引的115年度連結；全歷屆由同步工作流擴充。\nwindow.ATLAS_OFFICIAL_PDFS=${JSON.stringify(output,null,2)};\n`);
console.log(`Seeded ${Object.keys(output).length} papers, ${Object.values(output).flat().length} direct official links`);
