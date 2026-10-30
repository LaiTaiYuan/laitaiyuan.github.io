import { brandLogo } from "./brandMark";
import { mileSongs } from "./lastMile";
import { profile, tracks } from "./profile";

// 「LAI 群島」: a small archipelago on the homepage. Seen from above, three of
// the islands are the LAI brand mark (same geometry as brandMark.ts) and a
// fourth, smaller one is left for the visitor's story. Each island is one part
// of Leonard's work, and every landmark on it links to the page or section that
// tells that story. Wording reuses what the page and docs/content-sources.md
// already say; nothing here adds a result, number or experience.

const base = import.meta.env.BASE_URL;
const links = profile.links;

export type IslandId = "l" | "a" | "i" | "you";

export type IslandSpot = {
  name: string;
  text: string;
  link: { label: string; href: string; external?: boolean };
  // Where the landmark stands, in the logo's coordinates (lai-logo.svg).
  at: readonly [number, number];
};

export type Island = {
  id: IslandId;
  letter: string;
  name: string;
  // What the name's last character also sounds like, shown small after the
  // name as Leonard wrote it: 賴島(導).
  pun?: string;
  line: string;
  // What the lion says while the camera is over this island.
  lion: string;
  spots: readonly IslandSpot[];
};

// The visitor's island sits under the A, where the letters leave a gap.
export const youIsland = { center: [118, 199] as const, radius: 13 };

export const islands: readonly Island[] = [
  {
    id: "l",
    letter: "L",
    name: "工程島",
    line: "Java 後端打地基，一路蓋到雲端。",
    lion: "Spring Boot 啟動中，先泡杯咖啡 ☕",
    spots: [
      {
        name: "資料庫地基",
        text: "資料庫設計，建立產品背後的系統基礎。",
        link: { label: "看專長", href: "#about" },
        at: [33, 156],
      },
      {
        name: "Java 咖啡館",
        text: "Java、Spring Boot 與 RESTful API；島跟島之間，也靠 API 橋來回。",
        link: { label: "逛 GitHub", href: links.github, external: true },
        at: [33, 106],
      },
      {
        name: "AWS 雲端塔",
        text: "AWS Certified Solutions Architect – Associate，2024.04 取得，有效至 2027.04。",
        link: { label: "在 Credly 驗證", href: links.credly, external: true },
        at: [33, 54],
      },
      {
        name: "Full Stack 疊疊樂",
        text: "從資料庫一路疊到一起創造，看你能疊到第幾層。",
        link: { label: "去玩疊疊樂", href: "#play" },
        at: [61, 157],
      },
    ],
  },
  {
    id: "a",
    letter: "A",
    name: "AI 島",
    line: "AI 放大能力，故事留下溫度。",
    lion: "LLM 很有自信，但答錯了 😅",
    spots: [
      {
        name: "AI 核心之星",
        text: "LAI 標誌中間那顆琥珀色四芒星，代表 AI 的核心。",
        link: { label: "看標誌故事", href: "#mark" },
        at: brandLogo.starCenter,
      },
      {
        name: "好理家在",
        text: "以 AI 協作推進系統開發與營運，專案獲 2025 IT Matters「AI Selected 社會影響力獎」。",
        link: { label: "看作品", href: "#work" },
        at: [98, 151],
      },
      {
        name: "醫療 AI",
        text: "為台大癌醫乳房外科團隊提供 AI 應用的專業技術指導，團隊獲「AI 賦能健康進行式」銅獎。",
        link: { label: "閱讀醫院報導", href: links.hospital, external: true },
        at: [138, 151],
      },
      {
        name: "AIEC 送測站",
        text: "LLM 模型送測：準備與協調 → 調校與測試 → 分析與檢視。",
        link: { label: "看送測經驗", href: "#evaluation-title" },
        at: [118, 70],
      },
    ],
  },
  {
    id: "i",
    letter: "I",
    // The whole island is 賴島(導): 賴島 sounds just like 賴導, Director Lai,
    // and as a child Leonard wanted to be a film director
    // (docs/content-sources.md). He asked for the name and a funny way to let
    // it slip, 2026-10-30.
    name: "賴島",
    pun: "導",
    line: "I 就是我：聽故事、寫故事的地方。島名唸起來是「賴導」，不是巧合。",
    // A slip of the Zhuyin keyboard: 島 and 導 are typed the same way.
    lion: "歡迎來到賴導……選錯字了，是賴島啦 🎬",
    spots: [
      {
        name: "獅子工作桌",
        text: "戴眼鏡、戴耳機的獅子，在這裡寫程式也寫歌，桌邊的橘白貓窩著陪他，肚子上寫著「沛」的小白兔坐在桌前。好奇心，持續開工！",
        link: { label: "回到工作桌", href: "#top" },
        at: [189, 60],
      },
      {
        name: "唱片行",
        text: `以 LeonardLai 發表的 ${tracks.length} 首歌，最新一首是〈${tracks[0].title}〉。`,
        link: { label: "去聽歌", href: "#music" },
        at: [189, 101],
      },
      {
        name: "工具小舖",
        text: "做影片、玩簡報、探索程式碼與地圖，用過的好工具都放在這裡。",
        link: { label: "逛逛工具小舖", href: `${base}tools/` },
        at: [189, 141],
      },
      {
        name: "最後一哩路",
        text: `一輩子要完成的夢想：把身邊的人都寫成歌，已完成 ${mileSongs} 首。這條五線譜公路一路開向地平線。`,
        link: { label: "走這一哩路", href: `${base}last-mile/` },
        at: [189, 33],
      },
      {
        name: "導演椅",
        text: "小時候的夢想之一是當導演。長大先當了島主，唸起來一樣，算圓夢一半。椅背寫著「賴導」，人卻不在：他正在書桌前寫程式、寫歌，整座島都是片場。",
        link: { label: "看 LAI 標誌開拍", href: "#mark" },
        // On the west half, clear of the record shop's close-up; its own
        // close-up comes from the sea to the east (directorSet's `yaw`).
        at: [186, 126],
      },
    ],
  },
  {
    id: "you",
    letter: "你",
    name: "你的島",
    line: "還沒寫上名字的島，留給你的故事。",
    lion: "這座島還空著，等你的故事 👋",
    spots: [
      {
        name: "你的故事",
        text: "一段正在經歷的日常、一個想解決的問題，或還在醞釀的點子，都歡迎和我分享。",
        link: { label: "分享你的故事", href: "#contact" },
        at: youIsland.center,
      },
    ],
  },
];

// The three routes the islands' animals keep running (Leonard asked for
// animals, not people, 2026-10-24): the homepage's 聽故事、寫故事、一起創造故事
// in motion. Colours follow the story section's chapters (yellow, coral,
// green).
export type IslandRoute = {
  id: "listen" | "write" | "create";
  verb: string;
  animal: string;
  text: string;
};

export const islandRoutes: readonly IslandRoute[] = [
  {
    id: "listen",
    verb: "聽",
    animal: "台灣藍鵲",
    text: "從你的島，把故事叼上岸。",
  },
  {
    id: "write",
    verb: "寫",
    animal: "小獅子",
    text: "把故事寫成程式，走過 AI 之星就放大。",
  },
  {
    id: "create",
    verb: "創",
    animal: "海龜",
    text: "把做好的作品，馱回你的島。",
  },
];

export const islandSpotCount = islands.reduce(
  (sum, island) => sum + island.spots.length,
  0,
);
