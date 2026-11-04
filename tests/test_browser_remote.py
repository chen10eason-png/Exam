import json
import re
import unittest
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
PATH='data/items/學測/115/chinese_reading.jsonl'
rows=[{'item_uid':'學測115-chinese_reading-001','exam_system':'學測','year_roc':115,'subject_zh':'國綜','number':1,'stem':'下列字詞何者正確？','options':{'A':'甲','B':'乙','C':'丙','D':'丁'},'keys':'C','p_value':80,'item_flags':[]},
      {'item_uid':'學測115-chinese_reading-002','exam_system':'學測','year_roc':115,'subject_zh':'國綜','number':2,'stem':None,'options':{},'keys':'A','p_value':30,'item_flags':['not_extracted_bank_or_blank']}]
class BrowserTest(unittest.TestCase):
 def test_load_remote_archive_with_mock_fetch(self):
  html=(ROOT/'index.html').read_text()
  html=html.replace('<link rel="stylesheet" href="./styles.css">','<style>'+ (ROOT/'styles.css').read_text().split('\n',1)[1]+'</style>')
  local=json.loads((ROOT/'data/archive/catalog.json').read_text())
  mock={ 'data/items/partition_manifest.json':json.dumps({'total_rows':2,'files':{PATH:2}},ensure_ascii=False),
         PATH:'\n'.join(json.dumps(x,ensure_ascii=False) for x in rows),
         './data/archive/catalog.json':json.dumps(local,ensure_ascii=False)}
  script="window.fetch=async function(u){const k=String(u).startsWith('https://raw.githubusercontent.com/rbnyng/ceec/main/')?decodeURI(String(u).split('/main/')[1]):String(u);return new Response(window.TEST_FETCH[k]||'',{status:window.TEST_FETCH[k]?200:404});};"
  html=html.replace('<div id="app">','<script>window.TEST_FETCH='+json.dumps(mock,ensure_ascii=False)+';'+script+'</script><div id="app">')
  for m in list(re.finditer(r'<script src="([^"]+)"></script>',html)):
   src=m.group(1).lstrip('./')
   html=html.replace(m.group(0),'<script>'+ (ROOT/src).read_text()+'</script>')
  with sync_playwright() as p:
   browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
   page=browser.new_page(viewport={'width':1200,'height':800})
   errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
   page.set_content(html,wait_until='load')
   page.locator('[data-page="catalog"]').click()
   page.wait_for_function("document.querySelector('#bulkSummary').textContent.includes('2 筆逐題紀錄')",timeout=9000)
   self.assertIn('1 份',page.locator('#bulkListCount').inner_text())
   page.locator('.bulk-paper').first.click()
   page.wait_for_function("document.querySelector('#bulkResultCount').textContent.includes('2 題')",timeout=9000)
   self.assertIn('下列字詞何者正確',page.locator('#bulkQuestions').inner_text())
   self.assertIn('缺題幹',page.locator('#bulkQuestions').inner_text())
   page.locator('#bulkReadability').select_option('readable')
   self.assertIn('符合 1 題',page.locator('#bulkResultCount').inner_text())
   self.assertFalse(errors,errors)
   browser.close()
if __name__=='__main__':unittest.main()
