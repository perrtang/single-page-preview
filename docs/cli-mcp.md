# CLI 與 MCP 指南

CLI 和 MCP 共用網頁介面的本機解析引擎。安裝套件與 Chromium 後可離線操作。本機 GitHub 版可直接使用這兩種介面。

## CLI

在 repo 目錄執行下列指令。輸入可為 ZIP、獨立 HTML，或內含 HTML 與素材的資料夾。已有同名 ZIP 時，請指定新的輸出檔名。

```sh
node cli.mjs inspect examples/demo.html
node cli.mjs convert examples/demo.html --output demo-preview.zip
node cli.mjs convert saved.html --assets saved_files --output saved-preview.zip
```

- `inspect` 輸出入口 HTML、各寬度修正前後的水平溢出、缺少素材、Logo 和輪播資訊。
- `convert` 另寫入指定的 ZIP，輸出要放在已存在的資料夾。
- `--archive FILE.mhtml` 可用同一頁的 Chrome 網頁封存補圖。
- `--fetch-assets` 才會向公開 HTTPS 網址取得缺少的圖片與字型。
- 成功報告是標準輸出的 JSON。進度與錯誤寫到標準錯誤。以 `node cli.mjs --help` 查完整參數。

## MCP

在支援本機 `stdio` 的客戶端，將伺服器設定成一個本機程序。以下為常見的 JSON 格式。替換 Node、repo 與工作資料夾路徑，並依客戶端格式調整鍵名。

```json
{
  "mcpServers": {
    "single-page-preview": {
      "command": "node",
      "args": [
        "/absolute/path/to/single-page-preview/mcp.mjs",
        "--workspace",
        "/absolute/path/to/your/web-archives"
      ]
    }
  }
}
```

| 工具 | 用途 | 參數 |
| --- | --- | --- |
| `inspect_page` | 解析單一網頁並回傳檢查報告 | `input`，選填 `assets`、`archive`、`fetchAssets` |
| `convert_page` | 解析單一網頁並將結果寫成 ZIP | 同上，另需 `output` |

相對路徑以 `--workspace` 為起點，輸入、素材和輸出都限於該資料夾。每次執行會回傳報告，匯出時另附本機 ZIP 路徑。工具回傳檔名、診斷與輸出位置；使用雲端 AI 客戶端時，這些回傳資訊可能經客戶端傳送給模型。可選一個專用的本機資料夾供 AI 測試。
