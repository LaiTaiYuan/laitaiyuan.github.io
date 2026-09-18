---
version: alpha
name: "Leonard Lai 賴泰元的創作基地"
description: "以獅子創作者與漫畫工具街串連軟體工程、AI 應用、音樂、經歷及資源分享。"
colors:
  primary: "#405ada"
  ink: "#141414"
  paper: "#fff9eb"
  yellow: "#ffbe23"
  coral: "#ff8b44"
  green: "#72b948"
typography:
  display:
    fontFamily: "Noto Sans TC, Microsoft JhengHei, system-ui, sans-serif"
  body:
    fontFamily: "Noto Sans TC, Microsoft JhengHei, system-ui, sans-serif"
  data:
    fontFamily: "SFMono-Regular, Consolas, monospace"
rounded:
  card: "16px"
spacing:
  page-max: "1260px"
components:
  button:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.ink}"
  page:
    backgroundColor: "{colors.paper}"
  project-accent:
    backgroundColor: "{colors.coral}"
  record:
    backgroundColor: "{colors.ink}"
  award-badge:
    backgroundColor: "{colors.green}"
---

# Leonard 個人網站設計

## Overview

Audience 是潛在合作夥伴、想認識 Leonard 的讀者、聽眾與尋找實用工具的創作者。以台灣繁體中文受眾為主，介面使用 `zh-Hant`，技術名稱與藝名保留英文，日期以 Asia/Taipei 顯示。手機與桌面均以 document 捲動閱讀。

這是個人品牌／公開內容站，不是管理後台。核心場景是創作者的工作桌與工具街：皇家藍、黃白標題、黑色描邊。代表 Leonard 的角色依本人要求為獅子，搭配眼鏡、耳機、程式與音樂工作桌。本人提供的典禮照片放在關於我；公司 eGroupAI 是目前工作背景，不是網站主品牌。內容依 `docs/content-sources.md` 的可核對來源呈現。

Signature 是獅子的創作工作桌；周邊以安靜的作品說明、時間線與唱片封面建立秩序。避免無來源的成效数字、技能百分比與制式 KPI 卡牆。音樂作品如唱片架並排；專案突出用途及本人貢獻，不混淆團隊與個人獎項。

個人敘事主軸是「聽故事、寫故事，一起創造故事」。首頁邀請先認識作品，再分享自己的故事；聯繫入口明示 LinkedIn。台灣價值以自由民主、尊重多元、以人為本、在地信任與資料自主自然融入文字。AIEC 經驗依本人確認呈現準備、協調、調校、測試、分析與報告檢視，不寫成個人認證或未確認的成績。

採 Model B：Runtime token 的唯一來源是 `src/toolbox.css` 的 `--tb-*` CSS variables，`src/portfolio.css` 直接引用；本文件映射已接受值。圖片來源見 `docs/toolbox-art.md` 與 `docs/content-sources.md`。

## Colors

皇家藍 `--tb-blue`、金黃 `--tb-yellow`、橘色 `--tb-coral` 與綠色 `--tb-green` 提供漫畫氣氛；黑色 `--tb-ink` 與暖白 `--tb-paper` 支持閱讀。`colors.primary/ink/paper/yellow/coral/green` 分別映射上述 CSS variables；新頁不定義第二份色碼。藍／黑區塊使用白字、黃色 focus；淺色區塊使用黑字與黑色 focus。狀態以文字與圖示共同表示。

## Typography

標題採 `--tb-display` Noto Sans TC 900，正文 `--tb-body` 400–700；Microsoft JhengHei 與系統无襯線字為後援。標題為 30–65px，正文 13–15px，輔助資訊 10–12px；中文正文行高 1.8。版本、日期與英文旁註採 `--tb-mono`。首頁 L. 字標以 Georgia italic 為獨立品牌圖形。保留完整繁體中文字形，英文藝名不任意翻譯。

## Layout

首頁：獅子工作桌與個人定位 → 精選實作 → 本人照片、目前工作與專長 → 經歷與證照 → 音樂唱片架 → 工具街入口 → 報導與聯繫。工具頁：招牌與街景 → 用途分類與工具卡 → 版本更新 → 分享理念。两頁可相互導覽。

關於我區塊增加台灣價值與 AIEC 實務雙欄，手機依閱讀順序堆疊。既有色彩與描邊沿用；AIEC 的三個步驟對應實際參與流程。首頁故事標語採 30–52px，讓繁中句子在窄螢幕保留完整詞組。

頁寬 1260px，上限內保留 96px 外側總留白；1100px 以下首頁改 64px、760px 以下 40px。首頁主要雙欄在 760px 以下堆疊，唱片四欄改兩欄。導覽在手機換成第二列，直接顯示連結，不藏進選單。圖片明確寬高並保留比例；照片用 CSS object-fit，保留來源原圖。Spotify 播放器按需載入，固定 352px 高並保留外連作為後備。

## Elevation & Depth

採黑色描邊與實色偏移陰影，避免玻璃材質與通用 KPI 卡牆。重點是原創街景與工具本身。

## Shapes

2–3px 黑線、16px 卡片圓角與 7px 偏移實色陰影構成漫畫感。按鈕 9px 圓角、5px 陰影；hover 微幅平移，active 下壓。作品圖示是本站示意圖，不充當第三方商標。

## Components

- 分類以原生 button 和 `aria-pressed` 表示，與 `category` 查詢參數同步並支援瀏覽器返回。
- 兩頁在建置時預先輸出完整 HTML；分類初始伺服器快照為 all，hydrate 後依 URL 讀取，避免瀏覽器與預渲染不一致。
- 首頁 button 用於開啟官方 Spotify 播放器，導覽與播放平台使用 anchor。沒有表單、帳戶、破壞性操作、應用彈窗或 Toast；不引入無需求的 UI 流程。
- 唱片封面是可點擊的聆聽入口；合作藝人保留署名。影片個人頻道與 YouTube Music 主題頻道使用不同清楚標籤。
- 入門資訊採原生 details/summary；外部連結以文字提示另開分頁。
- 圖片與站內導覽透過 `import.meta.env.BASE_URL` 支援網域設定。
- 公開正式版資料超過三天未確認或同步失敗時，顯示待確認；中文摘要必須對應當前版本。
- 街景動態只使用 transform/opacity；減少動態偏好下取消動畫並立即顯示內容。
- 保留可見 focus、跳至內容連結、鍵盤操作與全域 scrollbar tokens。裝飾插畫不進入無障礙樹。
- 首頁獅子插畫作為個人識別有簡潔替代文字；純裝飾 SVG 隱藏於無障礙樹。全域 scrollbar 同時提供標準属性、WebKit fallback、hover/active 與 forced-colors 規則。

## Do's and Don'ts

- 保留 Leonard 的繁中個人語氣與已確認內容。
- 未提供的作品成果、經歷或使用心得不可編造。
- 版面與圖片必須在手機上可閱讀、可操作，避免水平溢出。
- 公開網站不引用工作日誌、內部報告或其他 repo。
