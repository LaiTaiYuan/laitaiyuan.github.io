// 賴泰元的品牌標誌 LAI：與 public/brand/lai-logo.svg 相同的幾何。
// L 的腳斜切，角度跟 A 的左斜邊平行；A 是左右雙色的實心金字塔，中間原本的
// 三角形挖空，換成一顆琥珀色四芒星，代表「AI 的核心」；I 是一根深藍直筆。
// 標誌本身改動時，請以 public/brand/ 的原檔為準更新這裡。
export const brandLogo = {
  viewBox: [16, 26, 190, 148] as [number, number, number, number],
  l: "20,30 46,30 46,144 75.8,144 68,170 20,170",
  aLeft: "118,30 76,170 106,170 118,140",
  aRight: "118,30 118,140 130,170 160,170",
  i: { x: 176, y: 30, width: 26, height: 140 },
  star: "M118 87 Q118 104 135 104 Q118 104 118 121 Q118 104 101 104 Q118 104 118 87 Z",
  starCenter: [118, 104] as [number, number],
  // 拆解說明的小圖示：各部件置中的方形取景框
  boxes: {
    l: [-33.3, 18.8, 162.4, 162.4],
    a: [36.8, 18.8, 162.4, 162.4],
    i: [107.8, 18.8, 162.4, 162.4],
    star: [94, 80, 48, 48],
  } as Record<"l" | "a" | "i" | "star", [number, number, number, number]>,
};
