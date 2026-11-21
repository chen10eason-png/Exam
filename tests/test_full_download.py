"""Integration test: all-corpus download, browser IndexedDB storage and offline resume."""
import json
import threading
import unittest
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
REV='4d87bdc12fb68dd2e719009d80017510aa789cce'
ITEMS={
 'data/items/學測/115/chinese_reading.jsonl':[
  dict(item_uid='學測115-chinese_reading-001',exam_system='學測',year_roc=115,subject_zh='國綜',number=1,stem='請問下列哪一個選項是正確的選擇？',options={'A':'原地','B':'錯字','C':'標準答案','D':'以上皆非'},keys='C',item_flags=[],p_value=77)],
 'data/items/學測/114/chinese_reading.jsonl':[
  dict(item_uid='學測114-chinese_reading-001',exam_system='學測',year_roc=114,subject_zh='國綜',number=1,stem='下列關於詞語用法哪一項正確？',options={'A':'甲','B':'乙','C':'丙','D':'丁'},keys='A',item_flags=[],p_value=45)]
}
manifest=json.dumps({'total_rows':2,'files':{p:1 for p in ITEMS}},ensure_ascii=False)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
class TestFullDownload(unittest.TestCase):
 @unittest.skip("Chromium test container blocks navigation to real HTTP origins; IndexedDB tested in Node")
 def test_download_then_offline(self):
  with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':390,'height':844},service_workers='block')
    from urllib.parse import urlparse,unquote
    import mimetypes
    def local(route):
     relative=unquote(urlparse(route.request.url).path).lstrip('/') or 'index.html'
     target=(ROOT/relative).resolve()
     if not target.is_relative_to(ROOT) or not target.is_file():route.fulfill(status=404,body='404');return
     route.fulfill(status=200,body=target.read_bytes(),content_type=mimetypes.guess_type(str(target))[0] or 'text/plain')
    context.route('https://atlas.example/**',local)
    online={'value':True}
    def route_fn(route):
     url=route.request.url
     if not online['value']:
      route.fulfill(status=404,body='offline');return
     if 'partition_manifest.json' in url:
      route.fulfill(status=200,body=manifest,headers={'Access-Control-Allow-Origin':'*'});return
     for filename,rows in ITEMS.items():
      if filename.split('/')[-1] in url and f'/{filename.split("/")[2]}/' in url:
       body='\n'.join(json.dumps(q,ensure_ascii=False) for q in rows)+'\n'
       route.fulfill(status=200,body=body,headers={'Access-Control-Allow-Origin':'*'});return
     route.fulfill(status=404,body='no source')
    context.route('https://raw.githubusercontent.com/**',route_fn)
    context.route('https://cdn.jsdelivr.net/**',route_fn)
    context.route('https://api.github.com/**',route_fn)
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('https://atlas.example/index.html',wait_until='domcontentloaded')
    page.wait_for_function("document.querySelector('#realResultCount')?.textContent.includes('可試答 1')",timeout=15000)
    page.locator('#realImportAll').click()
    page.wait_for_function("document.querySelector('#realImportProgress').textContent.includes('全部分卷已儲存')",timeout=20000)
    self.assertIn('已儲存 2 筆',page.locator('#realImportProgress').inner_text())
    online['value']=False
    page.reload(wait_until='domcontentloaded')
    page.wait_for_function("document.querySelector('#realResultCount')?.textContent.includes('可試答 1')",timeout=15000)
    self.assertIn('已取得 1/1',page.locator('#realStatus').inner_text())
    self.assertFalse(errors,errors)
    browser.close()
 
if __name__=='__main__':unittest.main()
