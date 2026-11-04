# 考點航線 Exam Atlas v0.7｜真題優先版

**主頁預設開啟「歷屆真題練習」，而非 55 題原創示範題。** 可從公開逐題鏡像讀取考試／年份／考科，跨年度組卷、線上作答與計分。

請先閱讀 [UPGRADE-說明.md](./UPGRADE-%E8%AA%AA%E6%98%8E.md) 進行完整上傳與 Actions 匯入。此版本**尚未內建或完成核驗全部歷屆題目**；15,446 為第三方清單筆數，不是本站已核對真題數。

---

# 考點航線 Exam Atlas v0.5 — 全量來源即時瀏覽 × 分卷匯入 × 缺漏稽核

高中「段考＋學測＋分科＋指考」練習網站，純前端 PWA，適合 GitHub Pages 與 iPhone/iPad。網站本身不需要付費會員、後端、Supabase 或 API 金鑰。

## 這個 ZIP **實際**含有哪些資料（2026-11-02）

- 55 題原創示範題，可立即組卷、作答、計分和錯題複習；**不是大考歷屆真題**。
- 115 學年度「學測 7 個考科＋分科 8 個考科」，合計 **15 份官方試卷，29 個官方試題或答案 PDF 連結**，已從大考中心來源頁逐項查詢。網路開啟仍取決於 CEEC 站台可用性。
- **115 學測數學 A 原卷 5 題概念分類示範**（第 1、2、3、4、6 題）：對應單元、多標籤與估計難度 1～6。這些只屬候選標籤，並非已校對的完整線上真題。
- **58 個課綱通用參考單元、10 個學科範圍**，支援單元多選、必修/選修、冊次、跨單元、六級難度和題數條件。各出版社「第幾課」尚未建立精準對照，不能當成出版商正式目錄。
- 大考中心歷年官方索引：學測 83～115 年、指考 91～110 年、分科 111～115 年；截至 115 年官方網站分別列有 189 筆、249 筆「考科－年度」資料，並非都已在此 ZIP 拆題。
- 題目匯入、跨單元 `topicIds`、錯題複習、收藏、間隔複習、學習分析、備份及本機儲存。未核對的 PDF 擷取資料 **不會**加入可作答題數。

## 部署方式

1. 建立 GitHub Repo（例如 `exam-atlas`），把 ZIP **內容**上傳 Repo 根目錄（含 `.nojekyll`、`.github/workflows/`）。
2. **Settings → Pages → Build and deployment → Deploy from a branch → main → /(root)**。
3. 網站：`https://<github帳號>.github.io/<repo>/`。iPhone Safari 分享 → 加入主畫面。
4. 到 **Actions**：允許工作流執行與寫入內容（Repo → Settings → Actions → General → Workflow permissions → Read and write permissions；有些組織政策不允許）。
5. 先手動執行「**每週檢查大考中心官方 PDF 連結**」，會嘗試抓取大考中心全部 19＋25 頁索引，更新 `data/official-links.js`，讓所有年度都有逐份 PDF 直連。**此網路同步並未在本機成功對官方站台實測**；如果版面變動，會安全失敗、不刪除既有資料。
6. 再手動執行「**分批擷取官方考題並進行 AI 分類（待複核）**」：可留空 `key` 以處理尚未擷取的試卷，或填 `學測:115:數學A`。它會嘗試下載少量官方 PDF、以 PyMuPDF 擷取題號與文字，再用 GitHub Models 為題目建議多個單元、1～6 難度、信心分數、疑點。
7. AI 候選結果會被提交至 `data/candidates/*.json`，公開摘要位於 `data/candidate-index.js`，網站的「歷屆試卷 → 真題分類進度」會顯示候選標籤。**不會自動標示已複核、不會虛構答案**。

## 使用 AI 及免費限制

- `scripts/ai-classify.mjs` **真的呼叫 GitHub Models**，不是假裝 AI 的關鍵字分類；使用 Repo 內建 `GITHUB_TOKEN`、Actions `models: read` 權限。Token 不進入前端、不會暴露在網站。
- 支援多重 `topicIds`、`difficulty`、`confidence`、`reviewReason`，每次最多 100 題、8 題一組呼叫模型。
- GitHub Models 的模型清單、使用資格、免費額度及速度限制可能改變；預設 `openai/gpt-4o-mini` 若不可用或額度不足，分類步驟會顯示失敗，候選題與來源不會冒充 AI 完成。可以設定 Actions 變數 `ATLAS_MODEL`（或在 workflow 改 `ATLAS_MODEL` env）選擇可用模型。
- **沒有付費 API 或背景模型保證「立即全部完成」**。對十幾年的真題，分類與核對是一項大量、分批工作。

## PDF → AI → 可作答的必要品質流程

1. `node scripts/sync-official.mjs`：官方整頁索引、每年每科、試題 PDF 與答案 URL。
2. `python scripts/build-candidates.py --max-papers 3`：PDF 分離題號、保留原頁碼與文字摘要、記錄疑似公式／圖表／題組問題。整份卷無法辨識題號時不假裝成功。
3. `node scripts/ai-classify.mjs --file data/candidates/學測_115_數學A.json --limit 24`：AI 判斷科目、單元、多標籤及難度；**只是候選**。
4. 檢查每題 PDF 原始圖表、文字、答案、題號、題型，確定正確後，轉入網站題庫可作答的 JSON 並將 `reviewed` 設為 `true`。目前**尚未做可保證正確的 PDF 圖形／跨頁題組自動轉檔或答案驗證器**，所以 AI 不可自行放行。
5. 新題可由網站「題庫管理」匯入；多標籤以 `topicIds:["t05","t09"]` 保存。已複核的單選／多選題才會參與組卷。

### 為什麼不是直接把 PDF 全部當成真題？

PDF 中常有矩陣、上下標、圖片、圖表、跨頁共同題幹、選填題與非選題。單純擷取文字可能出現缺字、公式亂碼或分題錯誤，導致題目或答案不可信。網站寧可保留「待複核」，也不會虛構完整度。

## 本地測試

```bash
node tests/validate.mjs
node scripts/sync-official.mjs --fixture
python -m pip install pymupdf==1.26.5
python -m unittest discover -s tests -p 'test_*.py' -v
python scripts/make-public-index.py
```

## 官方來源

- 學測：https://www.ceec.edu.tw/xmfile?xsmsid=0J052424829869345634
- 分科／110年前指考：https://www.ceec.edu.tw/xmfile?xsmsid=0J052427633128416650
- 著作權留意：依法令舉行試題可能適用著作權法第 9 條第 1 項第 5 款，但某些隨題引用的照片、文學作品與文章仍可能有獨立權利；請保留原始出處並逐類確認使用權。

## 隱私與公開性

本機作答紀錄存在 localStorage，不主動上傳到雲端。但 `data/candidates` 是公開 Repo 資料，部署在 GitHub Pages 上不等於私密資料庫；不應存使用者姓名或個人紀錄。`noindex` 是對搜尋引擎的指示，不是存取管制。

## v0.3 全收錄追蹤（嚴格驗收）

**最終驗收不是「PDF 都有連結」，而是「可取得的每份正式試卷、每道題都通過來源、答案、分類核對」。** 已新增 `全歷屆逐份收錄與缺漏追蹤` 工作流：每天於 GitHub Actions 逐批處理未擷取考卷、排隊 AI 分類所有候選考卷，並在 `data/coverage.json` 列出每份考卷的狀態與已知漏號。

本機或 Actions 可執行：

```bash
node scripts/sync-official.mjs
python scripts/build-candidates.py --max-papers 20
python scripts/classify-queue.py --questions 128
python scripts/audit-coverage.py
python scripts/make-public-index.py
```

如果 GitHub Actions 超額、官方網站擋連線、PDF 解析失敗，`coverage.json` 將如實保留缺口，不能顯示 100%。**在完成逐題核對前，不能把 AI 候選標成已收錄的正式可作答題目。** `--max-papers 20` 為每輪上限，不是總共只處理 20 份；多次執行會跳過已擷取檔案並往下一批繼續。官方索引全歷屆同步需有 GitHub Actions 網路可用，尚未在本機對所有年份驗證。

`data/coverage.json` 中的題數是目前已識別候選數量，而非官方總題數；要確認無漏題，還需要逐份核對 `officialQuestionCount`（包括非選、跨頁題組），檢查 `missingQuestionNumbers` 並逐題核對原卷圖片、答案、單元及難度。目前**不應宣稱 100% 全量完成**。

## v0.4：不只索引，串接已公開的萬題級機器可讀資料庫

這版新增另一個**可實際大量匯入的上游來源**：[`rbnyng/ceec`](https://github.com/rbnyng/ceec) 的 `data/items/partition_manifest.json` + 分考卷 JSONL（該專案資料會變動）。2026-11-03 查核該上游清單時，其 manifest 宣稱 15,446 筆題目紀錄、README 說明已解析 410 份一般試卷與 14,943 個題目；兩個數字不同，應以**每次實際下載後的驗證結果**為準。對讀不到題幹、答案、公式、圖片的舊試卷，誠實列出缺漏，不可宣稱已可作答。

### 如何一口氣啟動全量匯入（無須手動逐檔上傳）

1. 把 ZIP 內容放到自己的 GitHub 專案，允許 Actions `Read and write permissions`。
2. Actions → **批次匯入上萬道公開歷屆真題資料** → Run workflow，選擇 `0`（代表「本次嘗試上游 manifest 的全部考卷」，**不是只處理0份**）。
3. 系統抓取 manifest 的所有分卷 JSONL、檢查每卷的實際題數、保留原題與可得答案、標出讀取缺漏並提交 `data/archive/papers/*.json`；彙總寫入 `data/archive/catalog.json`。遇到網路錯誤會留待下一輪重試，不會偽造完成率。
4. Actions → **AI分類大規模歷屆真題（分批）**。每次依可用 GitHub Models 額度處理未分類題目，寫入 `topicIds`、AI 難度與信心；這是**分類建議，不是已核對答案或逐題完備證明**。
5. 網站的「歷屆試卷 → 逐題大型歷史題庫」可以按考試、年度、科目、題內文字、AI單元、1～6級難度查詢；每份考卷按需載入，避免 iPhone 一次下載萬題檔。

### 覆蓋及精度限制（重要）

- 在本地執行環境**無法網路取得那 15,446 筆原檔**，故 ZIP 隨附的 `data/archive` 初始化狀態是 **0 份已匯入**。程式已用本地假資料做全路徑匯入與行數檢查，但全量網路動作須部署後執行。
- 這份第三方資料並不等於完整官方原題。部分較早年度含 `stem=null`，數學公式、題組與圖表也可能失真；即使已有答案欄位也需原卷比對。缺內容保留但**不進入正式智慧組卷**。
- 第三方備份可能落後最新的 115 年分科：繼續以本專案原本大考中心官方來源同步流程補齊所有年度；而且每份試卷是否齊全都應做缺口比對。
- 來源資料的**授權／著作權**需要再核對。正式公開大規模題幹時尤其應審查試題引用的文章、圖片與圖表等第三方內容，並依來源條件提供必要署名或改為連結原卷。
- 1～6級「得分率推估難度」若有上游收錄的官方題目得分率，就依 >=85%、>=70%、>=55%、>=40%、>=25%、低於25% 做六級；**和 AI 評估難度是兩種不同資料**，都不是大考中心公布的官方六級難度。多選題得分率可能含部分給分，須留意解讀。

本版實際提交的**程式**有自動全量匯入、分批 AI 分類和逐份檢索；但**已完成全部題目且完全分類可測驗**的驗收目標仍未達成，請以網站的公開統計而非功能名稱判斷。


## v0.5 真正做了哪些新增動作（2026-11-03）

- `remote-archive.js` 新增上游 `partition_manifest.json` 的資料欄位、題數與路徑嚴格檢查，可在瀏覽器即時列出全部分卷；選取試卷時按需讀取 JSONL，每份核對行數、題目 ID 唯一性後顯示題幹。這是**遠端即時檢索，不是已下載到本站的完整離線題庫**。
- `archive-browser.js` 能合併本地已匯入分卷及遠端清單，清楚區分 `本站已保存` 和 `選取時讀取公開資料`。若遠端連線失敗不會冒充已有資料。
- `scripts/audit-open-archive.py` 逐份比對實際 JSON 與 manifest 宣告的行數、唯一 ID、缺題幹、答案匹配、AI 分類、人工核對；只有真的達標才回報 `completeReviewedCorpus`。
- `import-public-corpus.py` 匯入時也保存 `data/archive/source-manifest.json`，讓之後的稽核使用同一版本來源清單。
- 新增來源轉換、負面資料、遠端來源瀏覽的本地測試。由於測試環境限制，瀏覽器使用模擬網路資料驗證，**不等於官方整站線上測試**。

### 自動化啟動前的必要條件

先將此 Repo 部署在能使用 GitHub Actions 並有 `contents:write`、`models:read` 權限的位置。此工具環境無法直接訪問 `raw.githubusercontent.com` 並下載上萬題資料，也不能代替使用者建立全新的 GitHub Repo；故目前尚不能宣稱已完成全部題目與分類。

### 真題難度使用方式

上游 `p_value` 是當年參試者的題目得分率（多選含部分給分），換算 1～6級時要清楚標註「得分率分級」，不能冒充「AI 判斷難度」。AI 難度欄位 `q.ai.difficulty` 必須只有完成真實模型推論才顯示。
