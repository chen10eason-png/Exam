import unittest
from playwright.sync_api import sync_playwright
from tests.test_real_ui import RealUITest

class AllYearPDFUI(unittest.TestCase):
 def test_early_and_new_years_have_correct_subjects_and_three_slots(self):
  with sync_playwright() as p:
   browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
   page=browser.new_page(viewport={'width':390,'height':844})
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.set_content(RealUITest().html(True),wait_until='load')
   page.evaluate("document.querySelector('[data-page=\"catalog\"]').click()")
   page.locator('#catalogYear').select_option('114')
   page.wait_for_function("document.querySelector('[data-pdf-paper=\"學測:114:國綜\"] [data-type=\"rubric\"][href]') !== null",timeout=8000)
   self.assertEqual(page.locator('[data-pdf-paper="學測:114:國綜"] a.paper-pdf-link').count(),3)
   page.locator('#catalogYear').select_option('110')
   self.assertGreater(page.locator('#catalogSubject option[value="國寫"]').count(),0)
   self.assertEqual(page.locator('#catalogSubject option[value="數學A"]').count(),0)
   page.locator('#catalogYear').select_option('106')
   self.assertEqual(page.locator('#catalogSubject option[value="國寫"]').count(),0)
   page.locator('#catalogExam').select_option('分科')
   page.locator('#catalogYear').select_option('114')
   self.assertGreater(page.locator('#catalogSubject option[value="數學乙"]').count(),0)
   page.wait_for_function("document.querySelector('[data-pdf-paper=\"分科:114:數學甲\"] [data-type=\"rubric\"][href]') !== null",timeout=8000)
   self.assertEqual(page.locator('[data-pdf-paper="分科:114:數學甲"] a.paper-pdf-link').count(),3)
   page.locator('#catalogYear').select_option('113')
   self.assertEqual(page.locator('#catalogSubject option[value="數學乙"]').count(),0)
   page.locator('#catalogYear').select_option('111')
   self.assertEqual(page.locator('#catalogResults .catalog-card').count(),7)
   self.assertFalse(errors,errors)
   browser.close()

if __name__=='__main__':unittest.main()
