# Exam Atlas — 官方三欄 PDF × 歷屆真題練習 (v0.8)

本專案提供學測、分科、指考的逐年度、逐考科查詢：**試題 PDF／答案 PDF／非選擇題評分原則 PDF** 三個位置固定顯示。每個連結皆必須來自大考中心官方索引、或經 GitHub 公開備份的**實際檔案清單核對存在**後才會啟用。若某年的評分原則根本不存在，該格顯示「未提供」，不會亂連到其他年度或考科。

另提供 **歷屆真題練習**，能載入公開機器可讀試題、展示題幹選項、選題數、答題、計分與保留錯題。含圖表、上下標、題組等缺資料的題目會列作「需修復」，不會自動進入測驗。

## 先前網站「沒有題目」的已查明原因

`remote-archive.js` 原先讀取 `rbnyng/ceec/main`，但上游公開專案**並沒有 `main` 這個預設分支**。v0.8 已改成已經核對存在的上游 Git commit `4d87bdc12fb68dd2e719009d80017510aa789cce`。`scripts/import-public-corpus.py` 同步修正。當時上游的 manifest 包含 416 份分卷及 15,446 筆題目紀錄；這是來源的資料列數，**不是本站已驗證可練的題數**。另有使用者 Repo 缺少 `.github/workflows`，導致資料從未真正透過 Actions 批次匯入。

## 每年三種 PDF，來源如何判斷

1. 優先使用 `data/official-links.js` 中大考中心 `www.ceec.edu.tw` 的直接 PDF URL。初次附帶 115 年已核對連結。
2. 完整官方索引同步：`node scripts/sync-official.mjs` 掃描大考中心學測／分科指考兩個歷年入口的所有分頁，再產生 `data/official-links.js`。同步失敗會保留舊檔，不偽造連結。
3. 若官方連結尚未同步，可查詢 [`rbnyng/ceec`](https://github.com/rbnyng/ceec) 公開鏡像的 `archive/<考試>/<年份>/<考科>/` 實際檔案目錄，只顯示 GitHub API 確認存在的 PDF。鏡像來源會標示「公開備份」，不冒充大考中心官方 URL。
4. `node scripts/build-pdf-catalog.mjs` 會從該備份的 Git Tree 取得完整 PDF 檔案清單，產生 `data/pdf-catalog.json`。有這個檔案後，網站不必逐考科呼叫 GitHub API；第一次部署前可使用即時 API 備援。
5. 83 年學測、91 年指考等較早年度沒有「非選擇題評分原則.pdf」時，三欄中的第三欄顯示沒有提供，而非亂連。不要期待所有歷史試卷剛好有三份 PDF。

## 真題怎麼進入網站

- **直接查題**：`remote-archive.js` 從 pinned upstream commit 的 `data/items/partition_manifest.json` 和 JSONL 分卷按需下載，每份校對資料行數及題目 ID；`real-practice.js` 顯示可讀題目並提供線上作答及計分。
- **本站保存**：Actions 工作流「批次匯入上萬道公開歷屆真題資料」執行 `python scripts/import-public-corpus.py --max-files 0`，將可取得的 JSONL 轉為 `data/archive/papers/*.json`，寫入實際已匯入數和失敗名單。這個過程不會把所有行當成可正確作答的題。
- **AI 分類**：Actions 工作流「AI分類大規模歷屆真題（分批）」使用 GitHub Models 產生 `topicIds`、難度 1–6、信心分數和疑點。受限於 GitHub Models 使用額度與各種資料損壞，尚未完成全庫 AI 分類、出版社課次對照、逐題答案及數學公式／圖片核對。請以 `data/archive/catalog.json` 與稽核報告的真實數字為準。
- **原卷核對**：同一頁能直接點到原試卷 PDF 和答案 PDF。已整理文字不等同已與原 PDF 全面驗證；需要逐題查核才可標示正式完成。

## GitHub Pages 部署

將 ZIP **內的檔案**放到 `chen10eason-png/Exam` 的 `main` 根目錄，包含 `.github/workflows/` 與 `.nojekyll`。GitHub → Settings → Pages → Deploy from branch → main / (root)。確保 Actions 的 Workflow permissions 允許 Read and write，否則自動匯入無法將產物提交回 Repo。

建議 Actions 的執行順序：

1. **建立所有年度三欄 PDF 真實連結**（`pdf-catalog.yml`）
2. **每週檢查大考中心官方 PDF 連結**（`sync-official.yml`）
3. **批次匯入上萬道公開歷屆真題資料**（`import-public-corpus.yml`，max_files=0）
4. **AI分類大規模歷屆真題（分批）**（`classify-public-corpus.yml`）
5. **完整度及答案品質稽核**：`python scripts/audit-open-archive.py`

目前可讀上游固定版本不含 115 年分科的機器可讀逐題資料，但這些試卷的官方 PDF 索引已存在；不能把這些當作已完成的可作答題目。新版的 PDF 功能及真題存取是分開的。

## 版權、來源與驗證

- 官方：學測 https://www.ceec.edu.tw/xmfile?xsmsid=0J052424829869345634
- 官方：分科／指考 https://www.ceec.edu.tw/xmfile?xsmsid=0J052427633128416650
- 公開存檔及已擷取紀錄： https://github.com/rbnyng/ceec （固定 revision，避免未知上游變動）
- 題目中的文章、圖片、圖表可能含第三方著作權；保留來源，公開或大量重新散布前需另行核對使用權。
- 主頁和作答紀錄存於瀏覽器本機，不需登入；是 PWA，適合 iPhone/iPad。
- 此版本**不是**所有年度真題已全部分類、逐題校對完成的最終成品；不要把「已建立 PDF 連結」計成已完成題目。

## 離線開發驗證

```bash
node --check pdf-archive.js
node tests/test_pdf_archive.cjs
node tests/test_remote_archive.cjs
node tests/test_real_practice.cjs
node scripts/sync-official.mjs --fixture
node scripts/build-pdf-catalog.mjs --fixture tests/fixtures/archive-tree.json
node tests/validate.mjs
python -m unittest discover -s tests -p 'test_*.py' -v
```

線上 GitHub Actions 下載及 CEEC 全站 PDF 可用性，必須在成功部署後另外核對，不能以本地 mock 測試冒稱全部通過。


## 2026-11-05 — 完整來源分卷內建與本機匯入功能

- `data/archive/manifest-seed.js`：核對上游資料庫的 416 份分卷、15,446 筆逐題紀錄目錄，**不是** 15,446 題完成核對。無網路也能顯示年度、科目及來源筆數。
- `full-download.js`：瀏覽器可批次下載 416 份分卷並保存 IndexedDB；逐卷重試／續傳、停止、明確顯示成功筆數與失敗數。選取分卷時先使用本機資料。這是瀏覽器端的下載，並未自動把全部資料寫入 GitHub。
- `scripts/import-public-corpus.py` + `.github/workflows/import-public-corpus.yml`：上線後 Actions 自動同步來源逐題資料，儲存至 `data/archive/papers/`。
- `topic-hints.js` + `scripts/annotate-keyword.mjs`：保守的課綱詞彙建議，不可冒充已完成 AI 分類；後續另由 GitHub Models 執行 AI 分類並待複核。
- `data/official-links.js`：115 學年度分科八科 3 欄官方 PDF 連結（試題、選擇題答案、非選題評分原則）。

**關鍵限制：** 本版本壓縮檔內內建了全部分卷目錄而非全部逐題題幹，因為本工作環境無法批次下載網路資料。需要由網站「下載全部歷屆題目」或部署後 GitHub Actions 執行下載。部分上游題目因公式、圖形或選項缺失，不一定能參與作答；115 分科已提供官方 PDF，但尚未在上游 416 分卷逐題資料中。
