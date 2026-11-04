import json,re,unittest
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
PART='data/items/學測/115/chinese_reading.jsonl'
DATA=[
 dict(item_uid='學測115-chinese_reading-001',exam_system='學測',year_roc=115,subject_zh='國綜',number=1,stem='請閱讀下列詞語，選出讀音相同者。',options={'A':'甲','B':'乙','C':'丙','D':'丁'},keys='C',p_value=80,item_flags=[]),
 dict(item_uid='學測115-chinese_reading-002',exam_system='學測',year_roc=115,subject_zh='國綜',number=2,stem=None,options={},keys='A',p_value=35,item_flags=['not_extracted_bank_or_blank'])]
class RealUITest(unittest.TestCase):
 def html(self, online=True):
  raw=(ROOT/'index.html').read_text()
  raw=raw.replace('<link rel="stylesheet" href="./styles.css">','<style>'+ (ROOT/'styles.css').read_text().split('\n',1)[1]+'</style>')
  mock={'./data/archive/catalog.json':(ROOT/'data/archive/catalog.json').read_text()}
  if online:
   mock['data/items/partition_manifest.json']=json.dumps({'total_rows':2,'files':{PART:2}},ensure_ascii=False)
   mock[PART]='\n'.join(json.dumps(x,ensure_ascii=False) for x in DATA)+'\n'
  script='''window.TEST_FETCH=%s;
 window.fetch=async function(u){let str=String(u),k=str.includes('raw.githubusercontent.com/rbnyng/ceec/main/')?decodeURI(str.split('/main/')[1]):str;
  if(window.TEST_FETCH[k])return new Response(window.TEST_FETCH[k],{status:200,headers:{'Content-Type':'text/plain'}});
  return new Response('not found',{status:404});};'''%json.dumps(mock,ensure_ascii=False)
  raw=raw.replace('<div id="app">','<script>'+script+'</script><div id="app">')
  for src in re.findall(r'<script src="([^"]+)"></script>',raw):
   raw=raw.replace(f'<script src="{src}"></script>','<script>'+ (ROOT/src.lstrip('./')).read_text()+'</script>')
  return raw
 def test_real_questions_load_and_grade(self):
  with sync_playwright() as p:
   browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
   page=browser.new_page(viewport={'width':390,'height':844})
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.set_content(self.html(),wait_until='load')
   page.wait_for_function("document.querySelector('#realResultCount').textContent.includes('可試答 1')",timeout=12000)
   self.assertTrue(page.locator('#page-real').is_visible())
   self.assertIn('讀音相同者',page.locator('#realResults').inner_text())
   self.assertIn('需修復',page.locator('#realResults').inner_text())
   self.assertTrue(page.locator('#realQuizStart').is_enabled())
   page.locator('#realQuizStart').click()
   self.assertIn('讀音相同者',page.locator('#realQuizQuestion').inner_text())
   page.locator('#realQuizQuestion input[value="C"]').check()
   page.locator('#realNext').click()
   page.wait_for_function("!document.querySelector('#realOutcome').hidden",timeout=5000)
   self.assertIn('答對 1 / 1 題',page.locator('#realOutcome').inner_text())
   self.assertFalse(errors,errors)
   browser.close()
 def test_outage_is_honest(self):
  with sync_playwright() as p:
   browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
   page=browser.new_page(viewport={'width':390,'height':844})
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.set_content(self.html(False),wait_until='load')
   page.wait_for_function("document.querySelector('#realStatus').textContent.includes('沒有可讀的真題目錄')",timeout=12000)
   self.assertTrue(page.locator('#realLoad').is_disabled())
   self.assertFalse(errors,errors)
   browser.close()
if __name__=='__main__':unittest.main()
