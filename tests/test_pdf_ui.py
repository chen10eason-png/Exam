import unittest
from playwright.sync_api import sync_playwright
from tests.test_real_ui import RealUITest

class PDFLinksUI(unittest.TestCase):
 def test_three_real_pdf_slots_and_legacy_missing(self):
  with sync_playwright() as p:
   browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
   page=browser.new_page(viewport={'width':1280,'height':900})
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.set_content(RealUITest().html(True),wait_until='load')
   page.locator('[data-page="catalog"]').click()
   page.wait_for_function("document.querySelector('[data-pdf-paper=\"學測:115:國綜\"] [data-type=\"rubric\"]')!==null",timeout=12000)
   entry=page.locator('[data-pdf-paper="學測:115:國綜"]')
   self.assertEqual(entry.locator('.paper-pdf-link[href]').count(),3)
   self.assertTrue('0q054334089673796864' in entry.locator('[data-type=rubric]').get_attribute('href'))
   page.evaluate('''() => {
     const old=window.fetch;
     window.fetch=async (url,options) => {
       const s=String(url);
       if(s.includes('/contents/archive/%E5%AD%B8%E6%B8%AC/83/%E5%9C%8B%E6%96%87')){
         const arr=[
           {type:'file',name:'試題內容.pdf',path:'archive/學測/83/國文/試題內容.pdf'},
           {type:'file',name:'選擇題答案.pdf',path:'archive/學測/83/國文/選擇題答案.pdf'}
         ];
         return new Response(JSON.stringify(arr),{status:200,headers:{'Content-Type':'application/json'}});
       }
       return old(url,options);
     };
   }''')
   page.locator('#catalogYear').select_option('83')
   page.wait_for_function("document.querySelector('[data-pdf-paper=\"學測:83:國文\"] .paper-pdf-link[href]')!==null",timeout=12000)
   old=page.locator('[data-pdf-paper="學測:83:國文"]')
   self.assertEqual(old.locator('.paper-pdf-link[href]').count(),2)
   self.assertIn('試題內容.pdf',old.locator('[data-type=paper]').get_attribute('href').replace('%E8%A9%A6%E9%A1%8C%E5%85%A7%E5%AE%B9','試題內容'))
   self.assertIn('未提供',old.inner_text())
   self.assertEqual(old.locator('a[href*="www.ceec.edu.tw/xmfile"]').count(),1)
   self.assertFalse(errors,errors)
   browser.close()

if __name__=='__main__':unittest.main()
