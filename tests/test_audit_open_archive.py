"""End-to-end local import and strict audit using tiny fixtures."""
import tempfile,unittest,subprocess,sys,os,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
FIX=ROOT/'tests/fixtures'
class AuditTests(unittest.TestCase):
 def test_import_and_audit(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);target=root/'data/archive'
   r=subprocess.run([sys.executable,str(ROOT/'scripts/import-public-corpus.py'),'--fixture-dir',str(FIX),'--out',str(target)],capture_output=True,text=True)
   self.assertEqual(r.returncode,0,r.stderr)
   import importlib.util
   s=importlib.util.spec_from_file_location('qa',ROOT/'scripts/audit-open-archive.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
   result=m.audit(root)
   self.assertEqual(result['expectedRecords'],2)
   self.assertTrue(result['completeInventory'])
   self.assertFalse(result['completeReviewedCorpus'])
   self.assertEqual(result['quality']['needsOriginalReview'],2)
if __name__=='__main__':unittest.main()
