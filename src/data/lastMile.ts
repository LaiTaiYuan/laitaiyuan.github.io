// 「我的人生最後一哩路」(/last-mile/): Leonard's dream, in his words
// (2026-10-02), to turn the people, things and moments around him into songs,
// and his hope that these stories and memories become classics that keep
// being sung. Each stop is someone on that road; `songs` counts the songs
// already written for them. A stop with no songs yet stands on the road as a
// rest, and turns into notes as soon as its count goes up, so finishing a song
// only needs this number changed. `story` is a line about what the song is
// for: wishes and intentions only, never a memory or a fact he has not shared,
// so he can rewrite any of them in his own words.
export type MileStop = {
  who: string;
  songs: number;
  story: string;
  note?: string;
};

export const mileStops: MileStop[] = [
  {
    who: "老婆",
    songs: 3,
    story: "把我們一起走過的日常，寫成只屬於我們的旋律。",
  },
  {
    who: "小孩",
    songs: 4,
    story: "看著你們長大的每一天，我都想用歌記下來。",
    note: "其中一首是小孩們的 RAP 團體歌",
  },
  {
    who: "eGroup 團隊・James",
    songs: 1,
    story: "工作路上並肩的夥伴，也值得一首歌。",
  },
  {
    who: "爺爺奶奶",
    songs: 0,
    story: "把爺爺奶奶的故事寫成歌，讓下一代也能接著唱。",
  },
  {
    who: "阿公阿嬤",
    songs: 0,
    story: "阿公阿嬤的聲音與叮嚀，想好好收進旋律裡。",
  },
  {
    who: "爸爸媽媽",
    songs: 0,
    story: "把說不出口的謝謝，唱給爸爸媽媽聽。",
  },
  {
    who: "媽媽那邊的姨丈、阿姨們",
    songs: 0,
    story: "媽媽那邊的大家庭，每個人都有一段值得唱的故事。",
  },
  {
    who: "媽媽那邊同一輩的表兄弟姊妹",
    songs: 0,
    story: "同一輩的我們，想用一首歌把大家唱在一起。",
  },
  {
    who: "爸爸那邊的姑姑、大伯們",
    songs: 0,
    story: "爸爸那邊的長輩們，也都在我的故事裡。",
  },
  {
    who: "eGroup 團隊",
    songs: 0,
    story: "從寫給一個人的歌，寫成整個團隊一起唱的歌。",
  },
  {
    who: "高中同學",
    songs: 0,
    story: "青春的那幾年，想用一首歌找回來。",
  },
  {
    who: "大學同學",
    songs: 0,
    story: "大學的我們，值得一首能一起合唱的歌。",
  },
];

// Under the film's title, in Leonard's words (2026-10-02): the last mile is
// the dream of a lifetime, not the end of one.
export const mileSubtitle = "一輩子要完成的夢想";

// Spoken while the camera flies in; the last line is Leonard's own wish.
export const mileProlog = [
  "有些人，陪我走了很長的路；",
  "有些事，在心裡放了很久。",
  "我想把他們都寫成歌——",
  "讓回憶有旋律，讓故事被傳唱。",
];
export const mileWish = "我希望我做出來的故事與回憶，能成為經典，持續詠唱。";

export const mileSongs = mileStops.reduce((sum, stop) => sum + stop.songs, 0);
export const mileRests = mileStops.filter((stop) => stop.songs === 0).length;
