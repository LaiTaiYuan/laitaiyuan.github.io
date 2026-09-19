# Leonard Lai 賴泰元｜個人網站

Leonard 的個人網站，託管於自己的 GitHub 帳號。

- 網站：https://laitaiyuan.github.io/
- 工具小舖：https://laitaiyuan.github.io/tools/
- 原始碼：https://github.com/LaiTaiYuan/laitaiyuan.github.io

首頁呈現軟體工程、AI 應用、音樂創作、實作經歷與 AWS 認證；`/tools/` 保留完整工具小舖。網站使用獅子角色與原有漫畫工具街一致的視覺語言。此 repo 獨立部署，與工作日誌的 Vercel 專案沒有連動。

## 開發

```sh
npm ci
npm run dev
```

```sh
npm run lint
npm test
npm run build
npm run preview
```

此 repo 只包含公開網站所需的原始碼、資料與圖片，不依賴其他網站或組織 repo。採 React、TypeScript 與 Vite，建置產物位於 `dist/`。

## 個人內容與 SEO

- `src/Home.tsx`：首頁內容與互動；`src/portfolio.css`：沿用工具小舖 tokens 的首頁版面與動態。
- `src/motion.ts`：兩頁共用的動態 hooks（捲動揭示、指標視差、捲動進度後備、導覽定位、3D 傾斜）。
- `scripts/build-lion-scene.py`、`scripts/build-images.py`：由原始插畫與照片產生首頁獅子場景圖層與 WebP／AVIF 響應式圖片，見 `docs/lion-art.md`。
- `src/data/profile.ts`：姓名、平台連結與音樂作品。
- `docs/content-sources.md`：公開事實來源、角色歸屬、本人提供的照片與插畫出處。
- `src/entry-server.tsx` 與 `scripts/prerender.mjs`：建置時產生兩頁完整 HTML 與 JSON-LD，瀏覽器再 hydrate；停用 JavaScript 仍可閱讀及使用連結。
- `index.html`、`tools/index.html`：各自的 title、description、canonical、Open Graph 與社群分享資訊。
- `public/robots.txt`、`public/sitemap.xml`、`public/og-image.png`：爬蟲入口、網站地圖與分享圖片。
- `scripts/check-site.mjs`：建置後檢查可索引性、身分與內容、結構化資料和公開檔案範圍。
- `DESIGN.md`：視覺規則、元件行為與來源映射；tokens 以 `src/toolbox.css` 為唯一實際來源。

SEO 提供搜尋引擎所需的基礎內容與標記，不代表已被收錄或保證排名。Search Console 可由網站擁有人另行驗證及提交 sitemap。

搜尋身分以「賴泰元」為主：兩頁的 title、description、og:site_name 與 JSON-LD `WebSite.name` 都以賴泰元開頭，人物 JSON-LD 的 `name` 為賴泰元，Leonard Lai／LeonardLai／Lai Tai-Yuan 列於 `alternateName`；首頁 `<link rel="me">` 與 `sameAs` 指向本人 GitHub、LinkedIn、YouTube 與 Spotify，工具頁以「賴泰元 Leonard Lai 的個人首頁」文字連回首頁並附 BreadcrumbList。`scripts/check-site.mjs` 會確認上述名稱訊號存在。人物 JSON-LD 以固定 `#person` 連結官方帳號、報導、AWS 資格及有署名的音樂作品。AIEC 送測以實務能力呈現；個人價值、參與角色與資訊來源同時可在 HTML 閱讀。依 [Google 的 AI 搜尋指引](https://developers.google.com/search/docs/appearance/ai-features)，維持可爬取、可索引、有文字內容且與結構化資料一致的網站；不把特殊 AI 檔案或標記當成收錄保證。

`profile.updatedAt` 與首頁 sitemap 的 `lastmod` 只在個人內容實際更新時調整，不隨每日工具同步排程刷新。所有權驗證與索引成效需在 Search Console／Bing Webmaster Tools 另行確認；目前未加入任何第三方追蹤程式。新站要盡快出現在「賴泰元」的搜尋結果，最有效的是在 [Search Console](https://search.google.com/search-console) 以 HTML 標記驗證 `https://laitaiyuan.github.io/`（把 `google-site-verification` meta 加進 `index.html` 的 `<head>`）、提交 `sitemap.xml`，並對首頁與 `/tools/` 使用「網址檢查 → 要求建立索引」；同時在 GitHub 個人檔案、LinkedIn 與 YouTube 頻道說明放上網址，讓爬蟲從已收錄的頁面連過來。

## 部署

GitHub Pages 的 Source 使用 **GitHub Actions**。Push 至 `main` 後，`.github/workflows/deploy-pages.yml` 會執行檢查、更新工具版本、建置並發布。也可在 Actions 手動執行。

每日台灣時間 09:17 會重新確認工具正式版並發布；GitHub 排程可能延遲。公開 repo 長期沒有活動時，GitHub 可能停用排程，屆時可在 Actions 重新啟用。CI 採 `--strict`，來源失敗時保留前一次成功的網站，不發布不完整更新。

目前使用免費的 `laitaiyuan.github.io`。未來可在 Settings → Pages 設定個人網域及 DNS；不必搬動原始碼。同時更新 `src/data/profile.ts` 的站點網址、兩個 HTML 的 canonical／分享網址、robots 與 sitemap，再重新部署。`PAGES_BASE_PATH` 由 Pages 設定取得，個人站預設為 `/`。

## 工具內容

- `src/data/toolbox.json`：工具介紹、分類、授權與入門資源。
- `src/data/toolboxReleases.json`：已確認的公開正式版快照。
- `src/data/toolboxReleaseNotes.json`：對應版本的繁中摘要。
- `npm run sync:tools`：從 GitHub API 更新版本；本機可選擇提供 `GITHUB_TOKEN`，不會送到瀏覽器。
- `scripts/build-toolbox-scene.py`：重新產生街景動畫圖層，需要 Pillow 與 NumPy。
- `docs/toolbox-art.md`：原創插畫來源與產製方式。

不把工具的授權混為一談：Remotion 與 GitNexus 屬原始碼公開，各自依官方授權；Open Slide 與 MapLibre GL JS 的授權在頁面上分別標示。
