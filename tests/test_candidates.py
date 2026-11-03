"""Offline integration test: PDF -> unreviewed candidates; no official network needed."""
import fitz,importlib.util,unittest
from pathlib import Path
script=Path(__file__).resolve().parents[1]/'scripts/build-candidates.py'
spec=importlib.util.spec_from_file_location('candidate_importer',script)
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
class Pipeline(unittest.TestCase):
    def test_pdf_question_numbers_and_review_gate(self):
        pdf=fitz.open();p=pdf.new_page()
        p.insert_text((35,65),'1. Sample about probability and expected value.\n(1) 1 (2) 2 (3) 3 (4) 4\n2. Find the slope of a straight line.\n(1) 1 (2) 2 (3) 3 (4) 4',fontsize=11)
        q=mod.split_pdf(pdf.tobytes())
        self.assertEqual([x['questionNo'] for x in q],[1,2])
        self.assertTrue(all(x['reviewed'] is False and x['difficulty'] is None for x in q))
    def test_official_host_security(self):
        self.assertTrue(mod.safe_ceec_pdf('https://www.ceec.edu.tw/x/test.pdf'))
        self.assertFalse(mod.safe_ceec_pdf('http://www.ceec.edu.tw/x/test.pdf'))
        self.assertFalse(mod.safe_ceec_pdf('https://www.ceec.edu.tw.evil.com/x/test.pdf'))
    def test_seed_has_115_exams(self):
        ix=mod.parse_index()
        self.assertEqual(sum(k.startswith('學測:115:') for k in ix),7)
        self.assertEqual(sum(k.startswith('分科:115:') for k in ix),8)
        self.assertTrue(all(v and v[0]['label']=='官方試題 PDF' for v in ix.values()))
if __name__=='__main__':unittest.main()
