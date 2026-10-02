import type { Daypart } from "../motion";

// What the homepage lion says in its speech bubble (see useLionHead in
// src/lionHead.ts). Jokes in the lion's own voice: Taiwanese everyday life,
// engineering humour and pointers to the rest of the page. They never claim a
// result, number or experience that docs/content-sources.md does not list.
// Keep each line short enough for one line of the bubble on a phone, and use
// emoji every system already draws (no 🧋, 🫡 or 😵‍💫).

// The bubble's resting line, also what renders without JavaScript.
export const lionMotto = "好奇心，持續開工！";

// A line is said at once; a bit is said beat by beat, so a joke's setup and
// punchline get their own bubbles.
export type LionLine = string | readonly string[];
type Lines = readonly LionLine[];

// Leonard's own joke (2026-10-02). Told on the second poke, and now and then
// after that.
const beeJoke = [
  "蜜蜂小時候叫甚麼？",
  "小蜜蜂！",
  "那老蜜蜂叫甚麼？",
  "高齡蜂……",
] as const;

export const lionQuips: {
  hello: Lines;
  daypart: Record<Daypart, Lines>;
  pass: Lines;
  dizzy: Lines;
  poke: Lines;
  milestones: Readonly<Record<number, LionLine>>;
} = {
  // The pointer reaches the lion for the first time in a while.
  hello: [
    "哩賀！呷飽未？",
    "叮咚～歡迎光臨！",
    "欸，你來了喔！",
    "嗨～我是 Leonard 的獅子分身",
    "歡迎來玩，鞋子不用脫",
  ],
  // Mixed into the greetings at that time of day in Taipei.
  daypart: {
    morning: [
      "早安！早起的獅子有 bug 抓 🐛",
      "早餐吃了沒？蛋餅配奶茶",
      "早安，咖啡先給我 ☕",
    ],
    day: [
      "上班加油，摸魚適量 🐟",
      "下午來杯手搖？半糖少冰",
      "午餐吃飽，下午才有力 debug",
    ],
    evening: ["下班了嗎？我還在等 build", "晚餐吃便當還是麵？🍱"],
    night: [
      "夜貓子？我是夜獅子 🌙",
      "熬夜寫 code，肝要顧啊",
      "這麼晚還在逛，睡不著喔？",
    ],
  },
  // The pointer sweeps past the lion's face while it watches.
  pass: [
    "你去哪，我就看哪 👀",
    "看什麼看？沒看過獅子寫 code 喔",
    "這個角度的我，比較帥齁",
    "慢一點啦，我脖子會落枕",
    "你的滑鼠比 deadline 還會跑",
    "戴著耳機，也看得到你喔 🎧",
    "我的頭是 WebGL 在轉的 🤓",
    "往下滑，還有網點故事喔 👇",
    "下面有疊疊樂，疊到獅子王找我 👑",
    "我的歌在下面，記得戴耳機聽",
    "工具小舖逛一下，免錢的啦",
    "有故事想分享？最下面找我聊",
  ],
  // The pointer shakes left and right in front of the lion.
  dizzy: [
    "別晃了啦，頭好暈 😵",
    "你在考驗我的頸椎喔？",
    "轉到快變貓頭鷹了 🦉",
    "我又不是手搖飲，別再搖了！",
    "暈～需要一杯珍奶壓壓驚",
  ],
  // A click, tap or key press on the lion.
  poke: [
    "欸！不要戳啦 😳",
    "再戳，我就要獅子吼了喔 🦁",
    "別戳，燈泡會掉啦 💡",
    "好啦好啦，你贏了",
    "等一下，我先 commit",
    "戳我也戳不出 bug 啦 🐛",
    "這不是 bug，是隱藏功能",
    "在我電腦上是好的啊 🤷",
    "星期五不 deploy，這是信仰 🙏",
    "機房記得放綠色乖乖 🟢",
    "Spring Boot 啟動中，先泡杯咖啡 ☕",
    "「小改一下」通常不小",
    "bug 跟蟑螂一樣，從不單獨出現",
    "寫 Java 寫到講話都要 try-catch",
    "LLM 很有自信，但答錯了 😅",
    "靈感來了！……喔不，是跳電",
    "下班吃鹽酥雞，要不要揪？",
    "颱風假的話，我在家寫歌 🎵",
    "工程師說的「馬上好」，是明天",
    "天氣熱到 CPU 都在流汗 🥵",
    "半糖少冰，人生剛剛好",
    beeJoke,
  ],
  // Replace the poke line on these counts.
  milestones: {
    2: beeJoke,
    5: "你是不是很閒 🤨",
    10: "集滿十點！可兌換：一句謝謝 🙏",
    20: "好啦，獅子王讓你當 👑",
    30: "你戳的次數，比我 commit 還多",
  },
};
