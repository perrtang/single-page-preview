# 單頁展示轉換工具 · Single Page Preview

將 Chrome 另存的網頁轉成可調整、可離線分享的單頁展示。匯入 HTML 和素材後，可以檢查響應式版面、預覽手機到桌機的寬度，並調整工具辨識到的 Logo、導覽或輪播。

## 安裝與啟動

需要 Node.js 22 以上、npm，以及 Playwright 使用的 Chromium。

```sh
git clone https://github.com/perrtang/single-page-preview.git
cd single-page-preview
npm ci
npm run install-browser
npm start
```

開啟 [http://127.0.0.1:8882/](http://127.0.0.1:8882/)。工具在本機啟動，瀏覽器安裝完成後即可使用。Chromium 在 Linux 所需的系統套件請參考 [Playwright 瀏覽器安裝文件](https://playwright.dev/docs/browsers#install-system-dependencies)。

## 三步試用

1. 在匯入面板選 **HTML**，選擇 repo 裡的 [examples/demo.html](examples/demo.html)，再按 **解析網頁**。
2. 從 **展示與調整**切換手機、平板或桌機。試試點擊範例的手機導覽。
3. 按右上角的 **下載**，解壓縮後以瀏覽器開啟 `demo.html`，就能檢查離線效果。

## 功能

- **匯入與進度** · 支援 ZIP、HTML 加素材資料夾、完整資料夾。解析會顯示階段和百分比。
- **RWD 檢查** · 用 Chromium 檢查七種寬度，對可辨識的水平溢出嘗試修正，並列出修正前後差異及缺少的資源。
- **展示與調整** · 可預覽裝置尺寸，並視來源結構調整 Logo、導覽和輪播。
- **離線匯出** · 產出 HTML 與本機素材 ZIP。可辨識的頁內互動會隨匯出保留。

完整流程、各項設定及支援範圍請見[功能與操作指南](docs/guide.md)。

## CLI 與 MCP

完成上方安裝後，可在終端機解析網頁或產出離線 ZIP。

```sh
node cli.mjs inspect examples/demo.html
node cli.mjs convert examples/demo.html --output demo-preview.zip
```

支援本機 `stdio` 的 MCP 客戶端可啟動 `mcp.mjs`，呼叫 `inspect_page` 和 `convert_page`。設定範例、檔案範圍及回傳格式請見 [CLI 與 MCP 指南](docs/cli-mcp.md)。

## 執行方式與授權

工具在 `127.0.0.1` 執行，採單人本機工作流程。勾選素材補齊時會從公開 HTTPS 網址直接取得圖片或字型。關閉該選項，便可使用已準備好的本機檔案離線轉換。

程式與內附範例採 [MIT 授權](LICENSE)。匯入和匯出的第三方網頁、字型及圖片適用各自的授權。
