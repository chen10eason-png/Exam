import unittest
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]

class StandaloneIndex(unittest.TestCase):
 def test_all_years_correct_three_pdf_slots(self):
  with sync_playwright() as p:
   browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
   page=browser.new_page(viewport={'width':420,'height':860},device_scale_factor=1)
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   html=(ROOT/'pdfs.html').read_text().replace('<script>',"<script>window.fetch=async (url)=>new Response('not available',{status:404});")
   page.set_content(html,wait_until='load')
   self.assertEqual(page.locator('#year option').count(),33)
   self.assertEqual(page.locator('#papers .card').count(),7)
   page.locator('#subject').select_option('國綜')
   self.assertEqual(page.locator('#papers .paper-pdf-link[href]').count(),3)
   page.locator('#year').select_option('114')
   self.assertEqual(page.locator('#papers .paper-pdf-link[href]').count(),3)
   page.locator('#year').select_option('110')
   self.assertGreater(page.locator('#subject option[value="國寫"]').count(),0)
   page.locator('#year').select_option('83')
   self.assertEqual(page.locator('#subject option[value="國寫"]').count(),0)
   page.locator('#exam').select_option('分科')
   self.assertEqual(page.locator('#year option').count(),5)
   page.locator('#year').select_option('113')
   self.assertEqual(page.locator('#subject option[value="數學乙"]').count(),0)
   page.locator('#year').select_option('114')
   self.assertEqual(page.locator('#subject option[value="數學乙"]').count(),1)
   page.locator('#subject').select_option('數學甲')
   self.assertEqual(page.locator('#papers .paper-pdf-link[href]').count(),3)
   page.screenshot(path='/mnt/data/Exam-PDF-114-mobile-preview.png',full_page=True)
   self.assertFalse(errors,errors)
   browser.close()
if __name__=='__main__':unittest.main()
