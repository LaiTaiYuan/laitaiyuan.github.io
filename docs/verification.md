# 上線前驗證

日期：2026-09-18。

- ESLint、TypeScript、Vite 正式建置與 HTML 預渲染通過。
- 工具版本同步的 5 項測試通過，包含來源限流、非穩定版、錯誤發布網址與保留既有快照。
- 首頁及工具頁具備完整可閱讀 HTML、獨立 canonical、JSON-LD、description、OG／社群資訊；robots 和 sitemap 指向個人網址。
- 1200 × 630 分享圖片、所有首頁圖片與外連目標已檢查。本人照片與獅子插畫皆顯示正確。
- 以 Chromium 實際驗證 320、390、768、1440px 排版，首頁與工具頁無水平溢出。
- 工具分類支援帶參數開啟、切換、全部工具、瀏覽器返回及未知分類後備；頁面互相導覽正常。
- 鍵盤跳至內容、減少動態偏好、按需啟用 Spotify 播放器，以及停用 JavaScript 後兩頁內容閱讀已驗證。
- 未發現本站 JavaScript 執行或 hydration 錯誤。第三方平台是否能播放仍依平台所在地與登入條件。
- DESIGN.md 官方 lint 零錯誤、零警告；frontend-design-premium strict audit 零違規。
- 建置產物檢查排除工作日誌／內部資料目錄。本次沒有修改或推送原本工作日誌 repo。

公開內容的事實與歸屬見 [content-sources.md](content-sources.md)。搜尋引擎收錄與排名不在上述部署檢查的保證範圍。
