// What the LAI islands say back when you play with them (src/Islands.tsx and
// src/islandWorld.ts): a click on a landmark or an animal, an animal picked
// up, and the easter eggs hidden around the islands (Leonard asked for more
// to play with, jokes and eggs, 2026-10-24). The lion tells them in its
// bubble, in the same voice as src/data/lionQuips.ts: Taiwanese everyday
// life and engineering humour. They never claim a result, number or
// experience that docs/content-sources.md does not list; the animal facts are
// common knowledge (the leopard cat is protected, the blue magpie and the
// black bear are Taiwan's own). Use emoji every system already draws.

export type PlayId =
  | "l0"
  | "l1"
  | "l2"
  | "l3"
  | "a0"
  | "a1"
  | "a2"
  | "a3"
  | "i0"
  | "i1"
  | "i2"
  | "i3"
  | "you0"
  | "cat"
  | "bear"
  | "leopard"
  | "robot"
  | "host"
  | "cub"
  | "turtle"
  | "magpie"
  | "dolphin"
  | "cloud"
  | "view"
  | "konami";

// poke: clicked or tapped; lift: picked up; land: put down on an island;
// wet: dropped in the sea; mad: poked once too often. Without lines of its
// own, an act uses the poke lines.
export type PlayAct = "poke" | "lift" | "land" | "wet" | "mad";

type Lines = readonly string[];

export const playLines: Record<
  PlayId,
  { name: string; poke: Lines } & Partial<Record<PlayAct, Lines>>
> = {
  l0: {
    name: "資料庫地基",
    poke: [
      "SELECT * FROM 故事 WHERE 結局 = '圓滿';",
      "地基打得穩，半夜才睡得著 😴",
      "DROP TABLE？不行不行，先備份 🙏",
      "沒加索引的查詢，跟塞車一樣久 🚗",
    ],
  },
  l1: {
    name: "Java 咖啡館",
    poke: [
      "Java 要先煮咖啡，才會開始 compile ☕",
      "店長特調：拿鐵配一個 NullPointerException",
      "半糖少冰？這裡是咖啡館，不是手搖店啦",
      "咖啡因 is all you need ☕",
    ],
  },
  l2: {
    name: "AWS 雲端塔",
    poke: [
      "下雨了！雲端在跑 batch job 🌧️",
      "雲端就是別人的電腦，但很穩 ☁️",
      "帳單寄來之前，雲都很美",
      "燈塔也要多開幾個 AZ，比較安心",
    ],
  },
  l3: {
    name: "Full Stack 疊疊樂",
    poke: [
      "別戳！這是 production 環境 😱",
      "再疊一層，就是 Full Full Stack 了",
      "下面有疊疊樂遊戲，去挑戰最高紀錄 👇",
    ],
  },
  a0: {
    name: "AI 核心之星",
    poke: [
      "Prompt 寫得好，AI 下班早",
      "Temperature 調高一點，星星轉得比較有創意 ✨",
      "Token 用完了，明天再聊",
      "AI 放大能力，還是要有人把關",
    ],
  },
  a1: {
    name: "好理家在",
    poke: [
      "家，是最溫暖的 localhost 🏠",
      "冰箱有剩菜，記得回家吃飯 🍱",
      "這間房子的 uptime，100%",
    ],
  },
  a2: {
    name: "醫療 AI",
    poke: [
      "嗶嗶！今日提醒：多喝水、早點睡 💧",
      "AI 幫忙分擔，醫生還是醫生",
      "掛號請排隊，機器人也一樣 🤖",
    ],
  },
  a3: {
    name: "AIEC 送測站",
    poke: [
      "測試通過 ✅……在我的電腦上",
      "送測前很有信心，送測後很有經驗",
      "三盞燈全綠，今天準時下班 🟢",
    ],
  },
  i0: {
    name: "獅子工作桌",
    poke: [
      "噓，我在寫歌，靈感快來了 🎧",
      "被戳到靈感了！💡",
      "這行寫完就休息……第 87 次",
      "桌面很亂？這叫有系統的亂",
    ],
  },
  i1: {
    name: "唱片行",
    poke: [
      "石虎 DJ 刷碟中，wikka wikka 🎵",
      "這首聽完，換你點歌",
      "黑膠的沙沙聲，是溫度",
    ],
  },
  i2: {
    name: "工具小舖",
    poke: [
      "工具買了，就等於學會了吧？🔧",
      "這把扳手，專修 bug",
      "好用的工具，都擺在這裡了",
    ],
  },
  i3: {
    name: "最後一哩路",
    poke: [
      "一首歌一個人，慢慢寫，不趕路 🎵",
      "MILE 0：每段路都從零開始",
      "下一首寫給誰？說不定是你",
    ],
  },
  you0: {
    name: "你的故事",
    poke: [
      "你的故事，我很想聽 👂",
      "寫下第一行，這座島就不空白了",
      "最下面有聯絡方式，等你來聊 👇",
    ],
  },
  cat: {
    name: "橘白貓",
    poke: [
      "喵～（翻譯：再摸一下）",
      "呼嚕呼嚕……充電中 🔋",
      "鍵盤是我的，窩也是我的",
      "貓咪慢慢眨眼，是在說喜歡你 😊",
    ],
    lift: [
      "放我下來！我是液體，不是玩具 😾",
      "抱起來就越拉越長，貓就是這樣",
    ],
    land: ["四腳著地，滿分 10 分 🐾", "落地完美，回窩繼續睡"],
    wet: ["喵嗚！最討厭水了 💦", "濕答答的，要吹乾才能睡"],
    mad: ["哈！摸夠了啦 😾", "尾巴甩成這樣，是在生氣喔"],
  },
  bear: {
    name: "黑熊店長",
    poke: [
      "胸前的 V，是 Victory 的 V ✌️",
      "店長特調：熊熊醒來拿鐵 ☕",
      "台灣黑熊，台灣特有亞種 🐻",
    ],
    lift: ["放我下來，咖啡要灑出來了啦 ☕"],
  },
  leopard: {
    name: "石虎",
    poke: [
      "我是石虎，不是橘貓喔 🐾",
      "耳朵後面的白斑，是石虎的記號",
      "跟著節拍點頭，停不下來 🎵",
    ],
    lift: ["我是保育類，要輕輕放喔 🐾"],
  },
  robot: {
    name: "醫療 AI 機器人",
    poke: ["嗶嗶，您好！今天心情如何？🤖", "揮手是我唯一的才藝"],
    lift: ["警告：機器人離地，請放回原位 🤖"],
  },
  host: {
    name: "迎賓小獅子",
    poke: ["嗨！歡迎來到你的島 👋", "我在等你的故事喔"],
    lift: ["抱抱！島主大人好"],
  },
  cub: {
    name: "小獅子",
    poke: ["我在搬 code，別擋路 🦁", "這包 code 很重，要走 API 橋"],
    lift: ["放我下來，code 還沒送到！"],
  },
  turtle: {
    name: "海龜",
    poke: ["慢慢來，比較快 🐢", "作品打包好了，正在送貨"],
    lift: ["被抱起來，四隻腳還在划水"],
    land: ["我是海龜，不是陸龜啦 🐢"],
  },
  magpie: {
    name: "台灣藍鵲",
    poke: ["嘎嘎！故事送到，請簽收 📬", "藍鵲是台灣特有種，很會護巢喔"],
    lift: ["放開我，還有故事要送！"],
  },
  dolphin: {
    name: "台灣白海豚",
    poke: ["台灣白海豚，其實是粉紅色的喔", "跳起來那一下，要眼明手快"],
  },
  cloud: {
    name: "雲",
    poke: ["雲端也會下雨，記得帶傘 ☂️", "這朵雲沒在運算，只是想哭一下"],
  },
  view: {
    name: "群島",
    poke: ["轉回正面，才讀得到 LAI 喔"],
  },
  konami: {
    name: "工程師祕技",
    poke: ["祕技再按一次，大家再嗨一次 🎉"],
  },
};

export type EggId =
  | "cat-pet"
  | "cat-liquid"
  | "cat-water"
  | "cat-night"
  | "star-dizzy"
  | "tower-fall"
  | "cloud-rain"
  | "turtle-land"
  | "cub-air"
  | "dolphin"
  | "back-view"
  | "konami";

// The easter eggs: the counter in the corner of the stage shows how many
// this browser has found, and gives a hint for the next one.
export const islandEggs: readonly {
  id: EggId;
  name: string;
  // Said by the lion the first time the egg is found.
  line: string;
  hint: string;
}[] = [
  {
    id: "cat-pet",
    name: "摸摸橘白貓",
    line: "橘白貓對你慢慢眨眼，這是貓咪說喜歡你的方式 😊",
    hint: "獅子桌邊的貓窩，有人在等你摸摸",
  },
  {
    id: "cat-liquid",
    name: "貓是液體",
    line: "抱起來越拉越長，貓果然是液體 🐱",
    hint: "把貓咪抱起來，看看會變多長",
  },
  {
    id: "cat-water",
    name: "落水貓",
    line: "喵嗚！貓咪最討厭水了，抖一抖就回窩 💦",
    hint: "貓咪最怕的東西，海裡就有",
  },
  {
    id: "cat-night",
    name: "夜貓子",
    line: "夜貓子出沒！眼睛亮得跟車燈一樣 🌙",
    hint: "天黑之後去摸摸貓，牠的眼睛會發光",
  },
  {
    id: "star-dizzy",
    name: "AI 轉暈了",
    line: "AI 轉暈了，開始一本正經地胡說八道 💫",
    hint: "AI 核心之星連戳五下，會發生什麼事？",
  },
  {
    id: "tower-fall",
    name: "疊疊樂倒了",
    line: "倒了……沒關係，重新疊就好 🧱",
    hint: "疊疊樂最怕被連續戳",
  },
  {
    id: "cloud-rain",
    name: "雲端下雨",
    line: "雲端下雨了，先 git push 再收衣服 ☂️",
    hint: "把鏡頭往下拖到看見地平線，點一朵雲看看",
  },
  {
    id: "turtle-land",
    name: "海龜上岸",
    line: "我是海龜，不是陸龜啦！四隻腳只會划水 🐢",
    hint: "把海龜抱到島上試試看",
  },
  {
    id: "cub-air",
    name: "空中散步",
    line: "被抱起來腳還在走，責任感很重的小獅子 🦁",
    hint: "搬 code 的小獅子，抱起來腳還會走嗎？",
  },
  {
    id: "dolphin",
    name: "抓到白海豚",
    line: "抓到了！再翻一圈給你看 🐬",
    hint: "外海跳起來的粉紅色身影，點得到嗎？",
  },
  {
    id: "back-view",
    name: "從背面看",
    line: "從背面看，LAI 變成 IAL 了 🤔",
    hint: "把群島拖到背面，名字還是 LAI 嗎？",
  },
  {
    id: "konami",
    name: "工程師祕技",
    line: "↑↑↓↓←→←→BA！全島開趴 🎉",
    hint: "工程師都知道的那組祕技：↑↑↓↓←→←→……",
  },
];

export const allEggsLine = `${islandEggs.length} 個彩蛋全找到了！群島大師就是你 👑`;
