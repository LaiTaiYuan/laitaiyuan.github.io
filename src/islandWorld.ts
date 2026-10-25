import {
  AdditiveBlending,
  BackSide,
  Box3,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DataTexture,
  DirectionalLight,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Fog,
  Group,
  HemisphereLight,
  InstancedMesh,
  LinearFilter,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  NearestFilter,
  Object3D,
  PCFShadowMap,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Quaternion,
  Raycaster,
  RedFormat,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  Shape,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TubeGeometry,
  UniformsLib,
  UniformsUtils,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
} from "three";
import type { Material, Texture } from "three";
import {
  mergeGeometries,
  mergeVertices,
} from "three/addons/utils/BufferGeometryUtils.js";
import { brandLogo } from "./data/brandMark";
import { islands, youIsland } from "./data/islands";
import type { IslandId } from "./data/islands";
import type { EggId, PlayAct, PlayId } from "./data/islandPlay";
import {
  aiStar,
  ball,
  careBot,
  cloudTower,
  database,
  dolphin,
  familyHome,
  flora,
  javaCafe,
  lionCub,
  lionDesk,
  magpie,
  put,
  recordPlayer,
  rounded,
  seaTurtle,
  stackTower,
  staffRoad,
  storySign,
  testLab,
  tones,
  toolShop,
} from "./islandModels";
import type { Kit, Model, Pet, Tokens } from "./islandModels";
import type { Daypart } from "./motion";

// 「LAI 群島」 in WebGL (three.js, loaded only when the section comes near).
// The three letter islands are the brand mark raised out of a halftone sea,
// each a sand beach under an earth cliff and a grass plateau, with a small
// blank-page island under the A for the visitor. Toon shading with soft
// shadows and ink outlines tinted from each colour. The islands rise out of
// the sea when the section first shows, then the camera climbs from sea
// level to the bird's-eye view, so the name only reads once you are above
// it; picking an island flies the camera there. Animals keep the 聽 → 寫 →
// 創 loop running (magpies bring stories in from the visitor's island, lion
// cubs carry them over the API bridges and grow them at the AI star, turtles
// bring the finished work back), and the islands live their own lives:
// Leonard's lion typing at his desk with the orange-and-white cat in its bed
// and a white rabbit with 「沛」 on its tummy, a black bear at the Java café,
// a leopard cat at the record player, gulls round the cloud tower, pink
// dolphins jumping, fireflies at night. It is a
// toy too: drag to turn the islands round, pick the animals up and drop them
// (they find their way home), poke any landmark, and find the easter eggs.
// Decoration only: every word and link lives in the HTML around the canvas
// (the jokes in data/islandPlay.ts). Models are in islandModels.ts.

const S = 0.1; // world units per logo unit
const ORIGIN = [111, 100] as const; // logo point at the world origin
const SAND = { depth: 0.36, bevel: 0.1, size: 0.3, lift: -0.28 };
const BEACH = SAND.depth + SAND.bevel + SAND.lift; // height of the beach
const GRASS = { depth: 0.3, bevel: 0.07, inset: 0.42 };
const TOP = BEACH + GRASS.depth + GRASS.bevel * 2 - 0.07; // grass plateau
const FOV = 30;
const FLIGHT = 1.25; // seconds for the camera to fly to an island
const REVEAL = 2.8; // seconds for the first climb from sea level

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const smooth = (t: number) => t * t * (3 - 2 * t);
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
const wx = (lx: number) => (lx - ORIGIN[0]) * S;
const wz = (ly: number) => (ly - ORIGIN[1]) * S;
const ground = (lx: number, ly: number, y = TOP) =>
  new Vector3(wx(lx), y, wz(ly));

type Point = readonly [number, number];
const parse = (list: string) =>
  list
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(",").map(Number) as [number, number]);

// The letters' outlines in logo coordinates, straight from brandMark.ts.
const aLeft = parse(brandLogo.aLeft);
const aRight = parse(brandLogo.aRight);
const { x: ix, y: iy, width: iw, height: ih } = brandLogo.i;
const outlines: Record<"l" | "a" | "i", Point[]> = {
  l: parse(brandLogo.l),
  a: [aLeft[0], aRight[3], aRight[2], aRight[1], aLeft[2], aLeft[1]],
  i: [
    [ix, iy],
    [ix + iw, iy],
    [ix + iw, iy + ih],
    [ix, iy + ih],
  ],
};
const starRadius =
  brandLogo.starCenter[1] - Number(brandLogo.star.split(" ")[1]);

// Seeded random numbers, so the trees grow in the same places every visit.
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function inside(points: readonly Point[], x: number, y: number) {
  let hit = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      hit = !hit;
  }
  return hit;
}

function edgeDistance(points: readonly Point[], x: number, y: number) {
  let best = Infinity;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, ay] = points[j];
    const [bx, by] = points[i];
    const dx = bx - ax;
    const dy = by - ay;
    const t = clamp(
      ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy),
      0,
      1,
    );
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}

// How far inside an island a logo point is, in world units (negative: sea).
function depthIn(lx: number, ly: number) {
  let best = -Infinity;
  for (const points of Object.values(outlines)) {
    const d = edgeDistance(points, lx, ly) * S;
    best = Math.max(best, inside(points, lx, ly) ? d : -d);
  }
  const [cx, cy] = youIsland.center;
  return Math.max(best, (youIsland.radius - Math.hypot(lx - cx, ly - cy)) * S);
}
// The ground height under a world point: plateau, beach or sea.
const groundAt = (x: number, z: number) => {
  const d = depthIn(x / S + ORIGIN[0], z / S + ORIGIN[1]);
  return d > GRASS.inset - 0.06 ? TOP : d > -SAND.size * 0.5 ? BEACH : 0;
};

// ---------------------------------------------------------------------------
// Colours: only the site's --tb-* tokens, read from the stage's styles.
// ---------------------------------------------------------------------------

function readTokens(element: HTMLElement) {
  const styles = getComputedStyle(element);
  const raw = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;
  const hex = {
    ink: raw("--tb-ink", "#141414"),
    paper: raw("--tb-paper", "#fff9eb"),
    white: raw("--tb-white", "#ffffff"),
    green: raw("--tb-green", "#72b948"),
    coral: raw("--tb-coral", "#ff8b44"),
    blue: raw("--tb-blue", "#405ada"),
    sky: raw("--tb-sky", "#8bc8f4"),
    yellow: raw("--tb-yellow", "#ffbe23"),
    yellowLight: raw("--tb-yellow-light", "#fff5d6"),
    muted: raw("--tb-muted", "#51515a"),
    amber: raw("--tb-brand-amber", "#ffb020"),
  };
  const color = Object.fromEntries(
    Object.entries(hex).map(([key, value]) => [key, new Color(value)]),
  ) as Tokens;
  return { hex, color };
}
const mix = (a: Color, b: Color, t: number) => a.clone().lerp(b, t);
const flat = (geometry: BufferGeometry) =>
  geometry.index ? geometry.toNonIndexed() : geometry;

type Palette = {
  horizon: Color;
  zenith: Color;
  sea: Color;
  shallow: Color;
  dot: Color;
  foam: Color;
  sun: Color;
  sunAt: Vector3;
  sunPower: number;
  fill: Color;
  under: Color;
  fillPower: number;
  glow: number;
};
const colorKeys = [
  "horizon",
  "zenith",
  "sea",
  "shallow",
  "dot",
  "foam",
  "sun",
  "fill",
  "under",
] as const;

function palettes(c: Tokens): Record<Daypart, Palette> {
  return {
    morning: {
      horizon: mix(c.yellowLight, c.coral, 0.12),
      zenith: mix(c.sky, c.blue, 0.2),
      sea: mix(c.blue, c.sky, 0.3),
      shallow: mix(c.sky, c.white, 0.35),
      dot: mix(c.sky, c.white, 0.4),
      foam: c.white.clone(),
      sun: mix(c.yellowLight, c.white, 0.3),
      sunAt: new Vector3(14, 10, 9),
      sunPower: 2.5,
      fill: mix(c.sky, c.white, 0.3),
      under: c.yellowLight.clone(),
      fillPower: 1.6,
      glow: 0.12,
    },
    day: {
      horizon: mix(c.sky, c.white, 0.55),
      zenith: mix(c.sky, c.blue, 0.35),
      sea: c.blue.clone(),
      shallow: mix(c.sky, c.blue, 0.2),
      dot: mix(c.sky, c.blue, 0.2),
      foam: c.white.clone(),
      sun: c.white.clone(),
      sunAt: new Vector3(6, 16, 10),
      sunPower: 2.6,
      fill: mix(c.sky, c.white, 0.55),
      under: c.yellowLight.clone(),
      fillPower: 1.75,
      glow: 0,
    },
    evening: {
      horizon: mix(c.coral, c.yellow, 0.45),
      zenith: mix(c.blue, c.coral, 0.35),
      sea: mix(c.blue, c.ink, 0.2),
      shallow: mix(c.coral, c.sky, 0.45),
      dot: mix(c.coral, c.blue, 0.45),
      foam: mix(c.yellowLight, c.coral, 0.15),
      sun: mix(c.yellowLight, c.coral, 0.35),
      sunAt: new Vector3(-15, 8, 7),
      sunPower: 2.5,
      fill: mix(c.yellowLight, c.coral, 0.25),
      under: mix(c.blue, c.coral, 0.3),
      fillPower: 1.45,
      glow: 0.65,
    },
    night: {
      horizon: mix(c.blue, c.ink, 0.5),
      zenith: mix(c.ink, c.blue, 0.18),
      sea: mix(c.blue, c.ink, 0.62),
      shallow: mix(c.blue, c.sky, 0.25),
      dot: mix(c.blue, c.sky, 0.22),
      foam: mix(c.sky, c.blue, 0.3),
      sun: mix(c.sky, c.white, 0.62),
      sunAt: new Vector3(-7, 14, 4),
      sunPower: 1.5,
      fill: mix(c.blue, c.sky, 0.55),
      under: mix(c.ink, c.blue, 0.4),
      fillPower: 1.3,
      glow: 1,
    },
  };
}

function blend(from: Palette, to: Palette, t: number, out: Palette) {
  for (const key of colorKeys) out[key].copy(from[key]).lerp(to[key], t);
  out.sunAt.copy(from.sunAt).lerp(to.sunAt, t);
  out.sunPower = from.sunPower + (to.sunPower - from.sunPower) * t;
  out.fillPower = from.fillPower + (to.fillPower - from.fillPower) * t;
  out.glow = from.glow + (to.glow - from.glow) * t;
}

const clonePalette = (p: Palette): Palette => {
  const copy = { ...p, sunAt: p.sunAt.clone() };
  for (const key of colorKeys) copy[key] = p[key].clone();
  return copy;
};

// ---------------------------------------------------------------------------
// Textures drawn on the fly
// ---------------------------------------------------------------------------

function drawn(
  width: number,
  height: number,
  paint: (g: CanvasRenderingContext2D) => void,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext("2d");
  if (g) paint(g);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return { texture, repaint: () => g && paint(g) };
}

function roundRect(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function textures(hex: Record<keyof Tokens, string>) {
  const ink = hex.ink;
  // 寫: </> on a coral tag
  const code = drawn(128, 128, (g) => {
    g.clearRect(0, 0, 128, 128);
    roundRect(g, 10, 22, 108, 84, 22);
    g.fillStyle = hex.coral;
    g.strokeStyle = ink;
    g.lineWidth = 8;
    g.fill();
    g.stroke();
    g.lineCap = "round";
    g.lineJoin = "round";
    g.lineWidth = 9;
    g.beginPath();
    g.moveTo(44, 46);
    g.lineTo(28, 64);
    g.lineTo(44, 82);
    g.moveTo(84, 46);
    g.lineTo(100, 64);
    g.lineTo(84, 82);
    g.moveTo(71, 40);
    g.lineTo(57, 88);
    g.stroke();
  });
  const bubble = drawn(128, 128, (g) => {
    g.clearRect(0, 0, 128, 128);
    g.lineJoin = "round";
    roundRect(g, 12, 18, 104, 70, 26);
    g.moveTo(34, 86);
    g.lineTo(26, 112);
    g.lineTo(58, 87);
    g.fillStyle = hex.yellow;
    g.strokeStyle = ink;
    g.lineWidth = 8;
    g.fill();
    g.stroke();
    g.fillStyle = ink;
    for (const x of [42, 64, 86]) {
      g.beginPath();
      g.arc(x, 53, 7, 0, Math.PI * 2);
      g.fill();
    }
  });
  // A note for the songs
  const note = drawn(128, 128, (g) => {
    g.clearRect(0, 0, 128, 128);
    g.fillStyle = hex.yellow;
    g.strokeStyle = ink;
    g.lineWidth = 7;
    g.lineJoin = "round";
    g.beginPath();
    g.ellipse(52, 90, 24, 17, -0.45, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(72, 86);
    g.lineTo(72, 18);
    g.quadraticCurveTo(80, 44, 104, 50);
    g.lineTo(104, 62);
    g.quadraticCurveTo(84, 58, 80, 44);
    g.lineTo(80, 86);
    g.closePath();
    g.fill();
    g.stroke();
  });
  // A four-pointed spark, the brand star in white
  const spark = drawn(64, 64, (g) => {
    g.clearRect(0, 0, 64, 64);
    g.fillStyle = "#fff";
    g.beginPath();
    g.moveTo(32, 2);
    g.quadraticCurveTo(32, 32, 62, 32);
    g.quadraticCurveTo(32, 32, 32, 62);
    g.quadraticCurveTo(32, 32, 2, 32);
    g.quadraticCurveTo(32, 32, 32, 2);
    g.fill();
  });
  // A coral heart, for a purring cat and a happy home
  const heart = drawn(64, 64, (g) => {
    g.clearRect(0, 0, 64, 64);
    g.beginPath();
    g.moveTo(32, 55);
    g.bezierCurveTo(4, 37, 5, 9, 21, 9);
    g.bezierCurveTo(27, 9, 31, 13, 32, 18);
    g.bezierCurveTo(33, 13, 37, 9, 43, 9);
    g.bezierCurveTo(59, 9, 60, 37, 32, 55);
    g.closePath();
    g.fillStyle = hex.coral;
    g.strokeStyle = ink;
    g.lineWidth = 5;
    g.lineJoin = "round";
    g.fill();
    g.stroke();
  });
  // A falling raindrop, drawn as a short streak
  const drop = drawn(32, 32, (g) => {
    g.clearRect(0, 0, 32, 32);
    const gradient = g.createLinearGradient(0, 2, 0, 30);
    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(1, "rgba(255,255,255,1)");
    g.fillStyle = gradient;
    roundRect(g, 13, 2, 6, 28, 3);
    g.fill();
  });
  // Soft round glow for lights, and a darker one for shadows under animals
  const glow = drawn(64, 64, (g) => {
    const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.35, "rgba(255,255,255,0.45)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gradient;
    g.fillRect(0, 0, 64, 64);
  });
  const blob = drawn(64, 64, (g) => {
    const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,255,255,0.9)");
    gradient.addColorStop(0.6, "rgba(255,255,255,0.4)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gradient;
    g.fillRect(0, 0, 64, 64);
  });
  const ring = drawn(64, 64, (g) => {
    g.clearRect(0, 0, 64, 64);
    g.strokeStyle = "rgba(255,255,255,1)";
    g.lineWidth = 5;
    g.beginPath();
    g.arc(32, 32, 26, 0, Math.PI * 2);
    g.stroke();
  });
  const dot = drawn(32, 32, (g) => {
    g.fillStyle = "#fff";
    g.beginPath();
    g.arc(16, 16, 13, 0, Math.PI * 2);
    g.fill();
  });
  // The turtle's shell: hexagonal scutes
  const scutes = drawn(256, 128, (g) => {
    g.fillStyle = hex.green;
    g.fillRect(0, 0, 256, 128);
    g.fillStyle = "rgba(20,20,20,0.18)";
    g.fillRect(0, 0, 256, 128);
    g.strokeStyle = "rgba(255,249,235,0.85)";
    g.lineWidth = 5;
    g.lineJoin = "round";
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 6; col++) {
        const cx = col * 44 + (row % 2) * 22 + 10;
        const cy = row * 42 + 18;
        g.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
          const x = cx + Math.cos(a) * 20;
          const y = cy + Math.sin(a) * 18;
          if (k) g.lineTo(x, y);
          else g.moveTo(x, y);
        }
        g.closePath();
        g.stroke();
      }
  });
  // The laptop: a dark editor with a few lines of code
  const screen = drawn(128, 80, (g) => {
    g.fillStyle = "#1c2140";
    g.fillRect(0, 0, 128, 80);
    const lines = [
      [8, hex.coral, 40],
      [8, hex.sky, 70],
      [16, hex.yellow, 52],
      [16, hex.green, 34],
      [8, hex.sky, 60],
      [8, hex.coral, 28],
      [16, hex.white, 66],
    ] as const;
    lines.forEach(([x, color, w], k) => {
      g.fillStyle = color;
      g.fillRect(x, 8 + k * 9, w, 4);
    });
  });
  // The last mile: five lines and a bar line
  const staff = drawn(128, 256, (g) => {
    g.fillStyle = ink;
    g.fillRect(0, 0, 128, 256);
    g.fillStyle = hex.paper;
    for (let k = 0; k < 5; k++) g.fillRect(14 + k * 23, 0, 5, 256);
    g.fillRect(10, 120, 108, 7);
  });
  staff.texture.wrapT = RepeatWrapping;
  // The visitor's island is a blank page: ruled lines and a margin.
  const page = drawn(256, 256, (g) => {
    g.fillStyle = hex.paper;
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = hex.sky;
    for (let k = 1; k < 12; k++) g.fillRect(0, k * 21, 256, 3);
    g.fillStyle = hex.coral;
    g.fillRect(60, 0, 3, 256);
  });
  return {
    code,
    bubble,
    note,
    spark,
    heart,
    drop,
    glow,
    blob,
    ring,
    dot,
    scutes,
    screen,
    staff,
    page,
  };
}

// The sea needs to know how far each point is from the nearest coast: draw
// the islands' footprints and run a two-pass distance transform over them.
const SHORE = { minX: -14, minZ: -12, size: 28, px: 256, reach: 3.2 };

function shoreTexture() {
  const { minX, minZ, size, px, reach } = SHORE;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = px;
  const g = canvas.getContext("2d");
  const data = new Uint8Array(px * px).fill(255);
  if (!g) return new DataTexture(data, px, px, RedFormat);
  const scale = px / size;
  const toPx = (lx: number, ly: number): [number, number] => [
    (wx(lx) - minX) * scale,
    (wz(ly) - minZ) * scale,
  ];
  g.fillStyle = "#fff";
  g.strokeStyle = "#fff";
  g.lineJoin = "round";
  g.lineWidth = SAND.size * 2 * scale;
  for (const points of Object.values(outlines)) {
    g.beginPath();
    points.forEach(([x, y], index) => {
      const [u, v] = toPx(x, y);
      if (index) g.lineTo(u, v);
      else g.moveTo(u, v);
    });
    g.closePath();
    g.fill();
    g.stroke();
  }
  const [ux, uy] = toPx(youIsland.center[0], youIsland.center[1]);
  g.beginPath();
  g.arc(ux, uy, (youIsland.radius * S + SAND.size) * scale, 0, Math.PI * 2);
  g.fill();
  const land = g.getImageData(0, 0, px, px).data;
  const far = px * 4;
  const dist = new Float32Array(px * px);
  for (let i = 0; i < px * px; i++) dist[i] = land[i * 4] > 127 ? 0 : far;
  // Chamfer distance, forward then backward (3-4 weights).
  for (let y = 0; y < px; y++)
    for (let x = 0; x < px; x++) {
      const i = y * px + x;
      let d = dist[i];
      if (x > 0) d = Math.min(d, dist[i - 1] + 3);
      if (y > 0) {
        d = Math.min(d, dist[i - px] + 3);
        if (x > 0) d = Math.min(d, dist[i - px - 1] + 4);
        if (x < px - 1) d = Math.min(d, dist[i - px + 1] + 4);
      }
      dist[i] = d;
    }
  for (let y = px - 1; y >= 0; y--)
    for (let x = px - 1; x >= 0; x--) {
      const i = y * px + x;
      let d = dist[i];
      if (x < px - 1) d = Math.min(d, dist[i + 1] + 3);
      if (y < px - 1) {
        d = Math.min(d, dist[i + px] + 3);
        if (x < px - 1) d = Math.min(d, dist[i + px + 1] + 4);
        if (x > 0) d = Math.min(d, dist[i + px - 1] + 4);
      }
      dist[i] = d;
    }
  for (let i = 0; i < px * px; i++)
    data[i] = Math.round(clamp(dist[i] / 3 / scale / reach, 0, 1) * 255);
  const texture = new DataTexture(data, px, px, RedFormat);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------

const outlineVertex = /* glsl */ `
  #include <common>
  #include <fog_pars_vertex>
  uniform float uThickness;
  uniform vec2 uResolution;
  void main() {
    vec3 transformed = position;
    vec3 objectNormal = normal;
    #ifdef USE_INSTANCING
      objectNormal = mat3(instanceMatrix) * objectNormal;
      transformed = (instanceMatrix * vec4(transformed, 1.0)).xyz;
    #endif
    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
    vec4 clip = projectionMatrix * mvPosition;
    vec2 dir = (projectionMatrix * vec4(normalize(normalMatrix * objectNormal), 0.0)).xy;
    float len = length(dir);
    if (len > 0.0001) clip.xy += dir / len * uThickness * 2.0 / uResolution * clip.w;
    gl_Position = clip;
    #include <fog_vertex>
  }
`;

const outlineFragment = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>
  uniform vec3 uColor;
  void main() {
    gl_FragColor = vec4(uColor, 1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

const seaVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

// Halftone water: a dot screen that swells with slow waves, lighter shallows
// round the coasts, white foam that rings them and rolls outwards, and the
// far sea fading into the horizon.
const seaFragment = /* glsl */ `
  uniform vec3 uSea;
  uniform vec3 uShallow;
  uniform vec3 uDot;
  uniform vec3 uFoam;
  uniform vec3 uSky;
  uniform float uTime;
  uniform sampler2D uShore;
  uniform vec4 uShoreRect;
  uniform vec2 uFog;
  varying vec3 vWorld;
  void main() {
    vec2 p = vWorld.xz;
    vec2 shoreUv = (p - uShoreRect.xy) / uShoreRect.zw;
    float edge = step(0.0, shoreUv.x) * step(shoreUv.x, 1.0) * step(0.0, shoreUv.y) * step(shoreUv.y, 1.0);
    float d = mix(1.0, texture2D(uShore, clamp(shoreUv, 0.0, 1.0)).r, edge);
    vec3 base = mix(uShallow, uSea, smoothstep(0.03, 0.42, d));
    vec2 g = mat2(0.7071, -0.7071, 0.7071, 0.7071) * p * 2.4;
    vec2 cell = fract(g) - 0.5;
    float swell = sin(p.x * 0.42 + uTime * 0.7) * sin(p.y * 0.36 - uTime * 0.5);
    float radius = 0.13 + 0.11 * swell + 0.06 * (1.0 - d);
    float halftone = 1.0 - smoothstep(radius - 0.05, radius + 0.05, length(cell));
    vec3 color = mix(base, uDot, halftone * 0.55);
    float rings = fract(d * 5.5 - uTime * 0.22);
    float foam = (1.0 - smoothstep(0.0, 0.07, rings)) * (1.0 - smoothstep(0.08, 0.55, d));
    float coast = 1.0 - smoothstep(0.03, 0.055, d);
    color = mix(color, uFoam, max(foam * 0.8, coast));
    float far = smoothstep(uFog.x, uFog.y, distance(vWorld, cameraPosition));
    gl_FragColor = vec4(mix(color, uSky, far), 1.0);
    #include <colorspace_fragment>
  }
`;

const skyVertex = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// A sky that fades from the horizon to the zenith, with stars at night.
const skyFragment = /* glsl */ `
  uniform vec3 uHorizon;
  uniform vec3 uZenith;
  uniform float uStars;
  uniform float uTime;
  varying vec3 vDirection;
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  void main() {
    float h = clamp(vDirection.y, 0.0, 1.0);
    vec3 color = mix(uHorizon, uZenith, smoothstep(0.0, 0.45, h));
    vec3 cell = floor(vDirection * 180.0);
    float star = step(0.9965, hash(cell)) * smoothstep(0.04, 0.3, h);
    star *= 0.6 + 0.4 * sin(uTime * 2.0 + hash(cell + 1.0) * 30.0);
    color += vec3(star * uStars);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

// ---------------------------------------------------------------------------
// The world
// ---------------------------------------------------------------------------

export type IslandWorld = {
  // Animate only while the section is on screen.
  run(on: boolean): void;
  // Fly to an island, or back to the whole archipelago.
  focus(id: IslandId | null): void;
  // Time of day for the light, sea and windows.
  light(daypart: Daypart): void;
  // Make one landmark of the focused island hop.
  spot(index: number | null): void;
  // Fly up close to one landmark of the focused island.
  look(index: number | null): void;
  // Poke the landmark the camera is up close to (the 「戳一下」 button).
  poke(): void;
  // Every landmark and animal at once, with fireworks (the Konami code).
  party(): void;
  // Turn the view back to the way it was framed.
  straighten(): void;
  destroy(): void;
};

export type IslandEvents = {
  pick(id: IslandId | null): void;
  // The camera has risen high enough for the name to read.
  reveal(): void;
  lost(): void;
  // A landmark of the focused island was clicked: fly up close to it.
  look(index: number): void;
  // Something answered the visitor: a landmark or animal was poked, or an
  // animal picked up or put down. `eggs`: the easter eggs this counts for,
  // the first one not yet found wins. The words are in data/islandPlay.ts.
  play(id: PlayId, act: PlayAct, eggs?: readonly EggId[]): void;
  // The visitor has dragged the view away from its framing, or back.
  turned(on: boolean): void;
};

type Pose = { target: Vector3; yaw: number; pitch: number; distance: number };

type Carrier = {
  group: Group;
  curve: CatmullRomCurve3;
  period: number;
  offset: number;
  shadow: Mesh;
  size: number;
  pitch: boolean;
  move(t: number, u: number, previous: number): void;
  // Kept busy while it is held up in the air.
  hold(t: number): void;
  last: number;
  // Seconds spent off the route (held or finding the way back), so it picks
  // up where it was taken from.
  delay: number;
  away: boolean;
};

// Where a picked-up animal is: at home (its landmark or its route), held,
// falling, sitting where it landed (or bobbing in the sea), or hopping home.
type Motion =
  | { mode: "home" }
  | { mode: "held"; since: number }
  | { mode: "fall"; wet: boolean }
  | { mode: "rest"; until: number; wet: boolean }
  | { mode: "hop"; from: Vector3; start: number; duration: number };

type Critter = Pet & {
  kind: "land" | "sea" | "air";
  carrier?: Carrier;
  // Where it lives on its landmark (local to `parent`).
  parent: Object3D | null;
  home: { position: Vector3; quaternion: Quaternion; scale: Vector3 };
  motion: Motion;
  at: Vector3;
  velocity: Vector3;
  boing: number;
  // Real shadows (landmark animals) or a soft blob (route animals).
  blob: Mesh | null;
};

export function createIslandWorld(
  stage: HTMLElement,
  canvas: HTMLCanvasElement,
  events: IslandEvents,
  still: boolean,
): IslandWorld | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
      failIfMajorPerformanceCaveat: true,
    });
  } catch {
    return null;
  }
  // Software renderers chosen outright are not flagged as a caveat; the
  // static map is kinder there (same rule as the homepage lion).
  const gl = renderer.getContext();
  const debug = gl.getExtension("WEBGL_debug_renderer_info");
  const gpu = `${gl.getParameter(gl.RENDERER)} ${
    debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : ""
  }`;
  if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(gpu)) {
    renderer.dispose();
    return null;
  }
  let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);
  // Shadows only move when the light or the islands do, so the map is
  // redrawn on demand rather than every frame.
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;

  const tokens = readTokens(stage);
  const c = tones(tokens.color);
  const looks = palettes(tokens.color);
  let daypart: Daypart = "day";
  const now = clonePalette(looks.day);
  let fade = { from: clonePalette(looks.day), to: looks.day, start: -1 };

  const scene = new Scene();
  scene.fog = new Fog(now.horizon, 46, 120);
  const camera = new PerspectiveCamera(FOV, 1, 0.5, 400);
  const hemisphere = new HemisphereLight(now.fill, now.under, now.fillPower);
  const sun = new DirectionalLight(now.sun, now.sunPower);
  sun.castShadow = true;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(sun.shadow.camera, {
    left: -13,
    right: 13,
    top: 13,
    bottom: -13,
    near: 1,
    far: 70,
  });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = 3;
  sun.target.position.set(0, 0, 1.5);
  scene.add(hemisphere, sun, sun.target);

  // --- Materials ------------------------------------------------------------
  const ramp = new DataTexture(
    new Uint8Array([92, 158, 214, 255]),
    4,
    1,
    RedFormat,
  );
  ramp.minFilter = NearestFilter;
  ramp.magFilter = NearestFilter;
  ramp.generateMipmaps = false;
  ramp.needsUpdate = true;
  const art = textures(tokens.hex);
  const resolution = { value: new Vector2(1, 1) };
  const paints = new Map<string, MeshToonMaterial>();
  const paint = (color: Color, glow = 0) => {
    const key = `${color.getHexString()}-${glow}`;
    let material = paints.get(key);
    if (!material) {
      material = new MeshToonMaterial({
        color,
        gradientMap: ramp,
        emissive: color.clone().multiplyScalar(glow),
      });
      paints.set(key, material);
    }
    return material;
  };
  // Outlines are a dark shade of the colour family they wrap, not flat
  // black: warm, green, blue or neutral ink, in three weights.
  const inks = {
    warm: mix(c.ink, c.coral, 0.3),
    green: mix(c.ink, c.green, 0.32),
    blue: mix(c.ink, c.blue, 0.4),
    plain: mix(c.ink, c.muted, 0.2),
  };
  const hsl = { h: 0, s: 0, l: 0 };
  const inkFor = (color: Color) => {
    color.getHSL(hsl);
    if (hsl.s < 0.18 || hsl.l > 0.9) return inks.plain;
    if (hsl.h > 0.22 && hsl.h < 0.47) return inks.green;
    if (hsl.h >= 0.47 && hsl.h < 0.78) return inks.blue;
    return inks.warm;
  };
  const lines = new Map<string, ShaderMaterial>();
  const outline = (color: Color, weight: number) => {
    const shade = inkFor(color);
    const thickness =
      weight <= 1.15
        ? 1.1
        : weight <= 1.45
          ? 1.35
          : weight <= 1.9
            ? 1.7
            : weight;
    const key = `${shade.getHexString()}-${thickness}`;
    let material = lines.get(key);
    if (!material) {
      material = new ShaderMaterial({
        uniforms: {
          ...UniformsUtils.clone(UniformsLib.fog),
          uColor: { value: shade },
          uThickness: { value: thickness },
          uResolution: resolution,
        },
        vertexShader: outlineVertex,
        fragmentShader: outlineFragment,
        side: BackSide,
        fog: true,
      });
      lines.set(key, material);
    }
    return material;
  };
  const colorOf = (material: Material | Material[]) => {
    const first = Array.isArray(material) ? material[0] : material;
    return (first as Material & { color?: Color }).color ?? c.ink;
  };
  const hulls = new WeakMap<BufferGeometry, BufferGeometry>();
  const hull = (geometry: BufferGeometry) => {
    let shell = hulls.get(geometry);
    if (!shell) {
      const bare = new BufferGeometry();
      bare.setAttribute("position", geometry.getAttribute("position"));
      const index = geometry.getIndex();
      if (index) bare.setIndex(index);
      shell = mergeVertices(bare, 1e-4);
      shell.computeVertexNormals();
      hulls.set(geometry, shell);
    }
    return shell;
  };
  const lamps: { material: MeshBasicMaterial; day: Color; night: Color }[] = [];
  const halos: { sprite: Sprite; day: number; night: number }[] = [];
  const kit: Kit = {
    c,
    hex: tokens.hex,
    paint,
    textured(map, color = c.white) {
      return new MeshToonMaterial({ color, map, gradientMap: ramp });
    },
    solid(geometry, material, line = 1.3) {
      const mesh = new Mesh(geometry, material);
      if (line) {
        const shell = new Mesh(
          hull(geometry),
          outline(colorOf(material), line),
        );
        shell.userData.shell = true;
        mesh.add(shell);
      }
      return mesh;
    },
    lamp(day, night) {
      const material = new MeshBasicMaterial({ color: day.clone() });
      lamps.push({ material, day, night });
      return material;
    },
    halo(color, size, day = 0, night = 0.85) {
      const sprite = new Sprite(
        new SpriteMaterial({
          map: art.glow.texture,
          color,
          blending: AdditiveBlending,
          transparent: true,
          depthWrite: false,
          opacity: 0,
        }),
      );
      sprite.scale.setScalar(size);
      halos.push({ sprite, day, night });
      return sprite;
    },
    puff(size) {
      const sprite = new Sprite(
        new SpriteMaterial({
          map: art.blob.texture,
          color: c.white,
          transparent: true,
          depthWrite: false,
        }),
      );
      sprite.scale.setScalar(size);
      return sprite;
    },
    icon(name, size) {
      const sprite = new Sprite(
        new SpriteMaterial({
          map: art[name].texture,
          transparent: true,
          depthWrite: false,
        }),
      );
      sprite.scale.setScalar(size);
      return sprite;
    },
    words(text, width, height, ink, paper) {
      const font = `900 ${Math.round(height * 0.62)}px "Noto Sans TC", "Microsoft JhengHei", sans-serif`;
      const sign = drawn(width, height, (g) => {
        g.fillStyle = paper;
        g.fillRect(0, 0, width, height);
        g.fillStyle = ink;
        g.font = font;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(text, width / 2, height * 0.54, width * 0.92);
      });
      // The web font comes in slices by character, so wait for the ones
      // this text needs before painting it again.
      document.fonts
        ?.load(font, text)
        .then(() => {
          sign.repaint();
          sign.texture.needsUpdate = true;
          wake();
        })
        .catch(() => {});
      return sign.texture;
    },
    scutes: art.scutes.texture,
    screen: art.screen.texture,
    staff: art.staff.texture,
  };

  // --- Sky and sea ------------------------------------------------------------
  const skyMaterial = new ShaderMaterial({
    uniforms: {
      uHorizon: { value: now.horizon },
      uZenith: { value: now.zenith },
      uStars: { value: 0 },
      uTime: { value: 0 },
    },
    vertexShader: skyVertex,
    fragmentShader: skyFragment,
    side: BackSide,
    depthWrite: false,
  });
  const sky = new Mesh(new SphereGeometry(300, 32, 16), skyMaterial);
  scene.add(sky);
  const shore = shoreTexture();
  const seaMaterial = new ShaderMaterial({
    uniforms: {
      uSea: { value: now.sea },
      uShallow: { value: now.shallow },
      uDot: { value: now.dot },
      uFoam: { value: now.foam },
      uSky: { value: now.horizon },
      uTime: { value: 0 },
      uShore: { value: shore },
      uShoreRect: {
        value: new Vector4(SHORE.minX, SHORE.minZ, SHORE.size, SHORE.size),
      },
      uFog: { value: new Vector2(40, 115) },
    },
    vertexShader: seaVertex,
    fragmentShader: seaFragment,
  });
  const sea = new Mesh(new PlaneGeometry(400, 400), seaMaterial);
  sea.rotation.x = -Math.PI / 2;
  scene.add(sea);

  // --- Islands: a sand beach, an earth cliff and a grass plateau ------------
  const shapeOf = (points: readonly Point[]) =>
    new Shape(points.map(([x, y]) => new Vector2(wx(x), -wz(y))));
  const raise = (
    shape: Shape,
    options: {
      depth: number;
      bevel: number;
      size: number;
      offset?: number;
      lift: number;
    },
  ) => {
    const geometry = new ExtrudeGeometry(shape, {
      depth: options.depth,
      bevelEnabled: true,
      bevelThickness: options.bevel,
      bevelSize: options.size,
      bevelOffset: options.offset ?? 0,
      bevelSegments: 4,
      curveSegments: 48,
    });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, options.lift, 0);
    return geometry;
  };
  const sandPaint = paint(c.sand);
  const earthPaint = paint(c.earth);
  // The A keeps the logo's two tones: one green on the left half, a lighter
  // one on the right, split down the apex.
  const twoTone = () => {
    const material = new MeshToonMaterial({
      color: c.green,
      gradientMap: ramp,
    });
    const right = mix(c.green, c.paper, 0.4);
    const split = wx(aLeft[0][0]);
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uRight = { value: right };
      shader.uniforms.uSplit = { value: split };
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying float vSide;")
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvSide = position.x;",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nuniform vec3 uRight;\nuniform float uSplit;\nvarying float vSide;",
        )
        .replace(
          "vec4 diffuseColor = vec4( diffuse, opacity );",
          "vec4 diffuseColor = vec4( vSide < uSplit ? diffuse : uRight, opacity );",
        );
    };
    material.customProgramCacheKey = () => "lai-two-tone";
    return material;
  };
  const islandRoots = new Map<IslandId, Group>();
  const islandLines = new Map<IslandId, ShaderMaterial[]>();
  const pickables: Mesh[] = [];
  const addIsland = (id: IslandId, shape: Shape, grass: Material) => {
    const root = new Group();
    const beach = new Mesh(
      raise(shape, {
        depth: SAND.depth,
        bevel: SAND.bevel,
        size: SAND.size,
        lift: SAND.lift,
      }),
      sandPaint,
    );
    const plateau = new Mesh(
      raise(shape, {
        depth: GRASS.depth,
        bevel: GRASS.bevel,
        size: GRASS.bevel,
        offset: -GRASS.inset,
        lift: BEACH - 0.07,
      }),
      [grass, earthPaint],
    );
    const beachLine = outline(c.sand, 2).clone();
    const grassLine = outline(c.leafDeep, 1.8).clone();
    beachLine.uniforms.uResolution = grassLine.uniforms.uResolution =
      resolution;
    beach.add(new Mesh(hull(beach.geometry), beachLine));
    plateau.add(new Mesh(hull(plateau.geometry), grassLine));
    for (const mesh of [beach, plateau]) {
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      mesh.userData.island = id;
      pickables.push(mesh);
      root.add(mesh);
    }
    scene.add(root);
    islandRoots.set(id, root);
    islandLines.set(id, [beachLine, grassLine]);
    return root;
  };
  addIsland("l", shapeOf(outlines.l), paint(mix(c.green, c.ink, 0.12)));
  addIsland("a", shapeOf(outlines.a), twoTone());
  addIsland("i", shapeOf(outlines.i), paint(mix(c.green, c.ink, 0.12)));
  const youShape = new Shape();
  youShape.absarc(
    wx(youIsland.center[0]),
    -wz(youIsland.center[1]),
    youIsland.radius * S,
    0,
    Math.PI * 2,
    false,
  );
  // The visitor's island is a blank page, ruled and waiting for its story.
  art.page.texture.wrapS = RepeatWrapping;
  art.page.texture.wrapT = RepeatWrapping;
  art.page.texture.repeat.set(0.42, 0.42);
  art.page.texture.offset.set(
    -wx(youIsland.center[0]) * 0.42 + 0.5,
    wz(youIsland.center[1]) * 0.42 + 0.5,
  );
  addIsland("you", youShape, kit.textured(art.page.texture, c.white));

  // --- Landmarks ---------------------------------------------------------------
  type Placed = { island: IslandId; model: Model; at: Vector3 };
  let star: ReturnType<typeof aiStar> | null = null;
  const builders: Record<IslandId, (() => Model)[]> = {
    l: [
      () => database(kit),
      () => javaCafe(kit),
      () => cloudTower(kit),
      () => stackTower(kit),
    ],
    a: [
      () => (star = aiStar(kit, starRadius * S)),
      () => familyHome(kit),
      () => careBot(kit),
      () => testLab(kit),
    ],
    i: [
      () => lionDesk(kit),
      () => recordPlayer(kit),
      () => toolShop(kit),
      () => staffRoad(kit, TOP),
    ],
    you: [() => storySign(kit)],
  };
  const landmarks: Placed[] = [];
  for (const island of islands) {
    const root = islandRoots.get(island.id);
    if (!root) continue;
    island.spots.forEach((spot, index) => {
      const build = builders[island.id][index];
      if (!build) return;
      const model = build();
      const at = ground(spot.at[0], spot.at[1]);
      model.group.position.copy(at);
      root.add(model.group);
      landmarks.push({ island: island.id, model, at });
    });
  }
  // The road to the horizon starts at the I's north tip, so it turns to face
  // north (the model's road runs towards -z already).

  // --- Paths, bridges, docks, lamps -----------------------------------------
  const lionPath: [number, number, number?][] = [
    [189, 160],
    [183, 152],
    [176, 152, TOP + 0.06],
    [165.5, 152, TOP + 0.4],
    [155, 152, TOP + 0.06],
    [148, 146],
    [136, 126],
    [125, 110],
    [118, 104],
    [110, 117],
    [100, 134],
    [91, 148],
    [84, 152, TOP + 0.06],
    [77.5, 152, TOP + 0.24],
    [71, 152, TOP + 0.06],
    [62, 150],
    [48, 148],
    [40, 138],
    [36, 124],
    [35, 116],
  ];
  const curveOf = (points: [number, number, number?][], y: number) =>
    new CatmullRomCurve3(
      points.map(([lx, ly, h]) => ground(lx, ly, h ?? y)),
      false,
      "centripetal",
    );
  const walkPath = curveOf(lionPath, TOP);
  const pathPaint = paint(mix(c.sand, c.coral, 0.1));
  // A sandy footpath along the cubs' route, wherever it crosses land.
  {
    const samples = walkPath.getSpacedPoints(260);
    const strips: number[][] = [];
    let strip: number[] = [];
    samples.forEach((p, k) => {
      const onLand = groundAt(p.x, p.z) === TOP && p.y < TOP + 0.05;
      if (!onLand) {
        if (strip.length > 12) strips.push(strip);
        strip = [];
        return;
      }
      const next = samples[Math.min(k + 1, samples.length - 1)];
      const prev = samples[Math.max(k - 1, 0)];
      const dx = next.x - prev.x;
      const dz = next.z - prev.z;
      const len = Math.hypot(dx, dz) || 1;
      const nx = (-dz / len) * 0.13;
      const nz = (dx / len) * 0.13;
      strip.push(
        p.x + nx,
        TOP + 0.012,
        p.z + nz,
        p.x - nx,
        TOP + 0.012,
        p.z - nz,
      );
    });
    if (strip.length > 12) strips.push(strip);
    for (const points of strips) {
      const positions: number[] = [];
      for (let k = 0; k + 11 < points.length; k += 6) {
        const [ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz] = points.slice(
          k,
          k + 12,
        );
        positions.push(
          ax,
          ay,
          az,
          cx,
          cy,
          cz,
          bx,
          by,
          bz,
          bx,
          by,
          bz,
          cx,
          cy,
          cz,
          dx,
          dy,
          dz,
        );
      }
      const geometry = new BufferGeometry();
      geometry.setAttribute(
        "position",
        new Float32BufferAttribute(positions, 3),
      );
      geometry.computeVertexNormals();
      const mesh = new Mesh(geometry, pathPaint);
      mesh.receiveShadow = true;
      const first = new Vector3(points[0], 0, points[2]);
      const owner = nearestIsland(first);
      islandRoots.get(owner)?.add(mesh);
    }
  }
  function nearestIsland(p: Vector3): IslandId {
    const lx = p.x / S + ORIGIN[0];
    const ly = p.z / S + ORIGIN[1];
    let best: IslandId = "you";
    let bestD = Infinity;
    for (const [id, points] of Object.entries(outlines) as [
      "l" | "a" | "i",
      Point[],
    ][]) {
      const d = inside(points, lx, ly) ? -1 : edgeDistance(points, lx, ly);
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    }
    return best;
  }

  const wood = paint(c.wood);
  const woodDark = paint(c.woodDark);
  const bridge = (from: Point, to: Point, rise: number) => {
    const a = ground(from[0], from[1], TOP + 0.02);
    const b = ground(to[0], to[1], TOP + 0.02);
    const span = a.distanceTo(b);
    const count = Math.max(4, Math.round(span / 0.17));
    const planks: BufferGeometry[] = [];
    const posts: BufferGeometry[] = [];
    const rail = (side: number) => {
      const points: Vector3[] = [];
      for (let k = 0; k <= 16; k++) {
        const u = k / 16;
        const p = a.clone().lerp(b, u);
        points.push(
          new Vector3(
            p.x,
            p.y + Math.sin(u * Math.PI) * rise + 0.2,
            p.z + side * 0.24,
          ),
        );
      }
      return new CatmullRomCurve3(points);
    };
    for (let k = 0; k <= count; k++) {
      const u = k / count;
      const plank = rounded(0.15, 0.045, 0.52, 0.015);
      plank.rotateZ(Math.cos(u * Math.PI) * rise * 1.6 * (b.x > a.x ? 1 : -1));
      const p = a.clone().lerp(b, u);
      plank.translate(p.x, p.y + Math.sin(u * Math.PI) * rise, p.z);
      planks.push(plank);
    }
    for (const u of [0, 0.5, 1])
      for (const side of [-1, 1]) {
        const p = a.clone().lerp(b, u);
        posts.push(
          rounded(0.05, 0.26, 0.05, 0.015).translate(
            p.x,
            p.y + Math.sin(u * Math.PI) * rise + 0.1,
            p.z + side * 0.24,
          ),
        );
      }
    const deck = mergeGeometries(planks.map(flat));
    if (deck) {
      const mesh = kit.solid(deck, wood, 1.2);
      mesh.castShadow = mesh.receiveShadow = true;
      bridges.add(mesh);
    }
    const stakes = mergeGeometries(posts.map(flat));
    if (stakes) bridges.add(kit.solid(stakes, woodDark, 1));
    for (const side of [-1, 1])
      bridges.add(
        new Mesh(new TubeGeometry(rail(side), 24, 0.014, 6), woodDark),
      );
  };
  // Bridges span two islands, so they rise with the lowest of them.
  const bridges = new Group();
  scene.add(bridges);
  bridge([71, 152], [84, 152], 0.2);
  bridge([155, 152], [176, 152], 0.38);

  // Docks on the visitor's island, where the magpies leave and turtles land.
  for (const side of [-1, 1]) {
    const [cx, cy] = youIsland.center;
    const dock = new Group();
    const x = wx(cx) + side * (youIsland.radius * S + 0.15);
    put(
      dock,
      kit.solid(rounded(0.7, 0.05, 0.3, 0.015), wood, 1.2),
      side * 0.2,
      BEACH + 0.04,
      0,
    );
    for (const dx of [0.05, 0.45])
      for (const dz of [-0.13, 0.13])
        put(
          dock,
          kit.solid(rounded(0.05, 0.4, 0.05, 0.015), woodDark, 1),
          side * dx,
          0.02,
          dz,
        );
    dock.position.set(x, 0, wz(cy) + 0.1);
    islandRoots.get("you")?.add(dock);
  }

  // Lamp posts along the footpath, lit at night.
  const lampLight = kit.lamp(c.steel, c.yellow);
  for (const [lx, ly] of [
    [42, 132],
    [58, 147],
    [104, 128],
    [131, 118],
    [186, 150],
  ] as const) {
    const at = ground(lx, ly);
    const post = new Group();
    put(
      post,
      kit.solid(rounded(0.04, 0.6, 0.04, 0.012), paint(c.ink), 1),
      0,
      0.3,
      0,
    );
    put(
      post,
      kit.solid(rounded(0.12, 0.05, 0.12, 0.02), paint(c.ink), 1),
      0,
      0.62,
      0,
    );
    put(post, new Mesh(ball(0.045, 10, 8), lampLight), 0, 0.57, 0);
    put(post, kit.halo(c.yellow, 0.9, 0, 0.85), 0, 0.55, 0);
    post.position.copy(at);
    islandRoots.get(nearestIsland(at))?.add(post);
  }

  // --- Trees, flowers and rocks -------------------------------------------------
  const keepClear: Point[] = islands.flatMap((island) =>
    island.spots.map((spot) => spot.at),
  );
  type Plant = {
    x: number;
    z: number;
    y: number;
    kind: number;
    scale: number;
    turn: number;
    island: IslandId;
  };
  const plants: Plant[] = [];
  const roll = random(20261024);
  for (const [id, points] of Object.entries(outlines) as [
    "l" | "a" | "i",
    Point[],
  ][]) {
    for (let y = 30; y <= 172; y += 6.5)
      for (let x = 14; x <= 210; x += 6.5) {
        const jx = x + (roll() - 0.5) * 4.5;
        const jy = y + (roll() - 0.5) * 4.5;
        if (!inside(points, jx, jy)) continue;
        const depth = edgeDistance(points, jx, jy) * S;
        const clearance = id === "a" ? 12.5 : 10;
        if (
          keepClear.some(([sx, sy]) => Math.hypot(sx - jx, sy - jy) < clearance)
        )
          continue;
        if (lionPath.some(([px, py]) => Math.hypot(px - jx, py - jy) < 4.2))
          continue;
        if (
          id === "a" &&
          Math.hypot(
            jx - brandLogo.starCenter[0],
            jy - brandLogo.starCenter[1],
          ) <
            starRadius + 4
        )
          continue;
        if (depth > GRASS.inset + 0.18) {
          if (roll() > 0.5) continue;
          plants.push({
            x: wx(jx),
            z: wz(jy),
            y: TOP,
            kind: roll() < 0.6 ? 0 : 1,
            scale: 0.72 + roll() * 0.5,
            turn: roll() * 6.28,
            island: id,
          });
        } else if (
          depth > 0.08 &&
          depth < GRASS.inset - 0.12 &&
          roll() < 0.12
        ) {
          plants.push({
            x: wx(jx),
            z: wz(jy),
            y: BEACH,
            kind: 2,
            scale: 0.8 + roll() * 0.4,
            turn: roll() * 6.28,
            island: id,
          });
        }
      }
  }
  // A few palms on the visitor's island, too.
  for (const a of [2.4, 4.1]) {
    const [cx, cy] = youIsland.center;
    const r = youIsland.radius * S - 0.12;
    plants.push({
      x: wx(cx) + Math.cos(a) * r,
      z: wz(cy) + Math.sin(a) * r,
      y: BEACH,
      kind: 2,
      scale: 0.85,
      turn: a,
      island: "you",
    });
  }
  // Nothing grows where an animal lives (the cat and the rabbit by the desk).
  scene.updateMatrixWorld(true);
  const dens = landmarks.flatMap(({ model }) =>
    (model.pets ?? []).map((pet) => pet.group.getWorldPosition(new Vector3())),
  );
  const roomy = (p: Plant) =>
    dens.every((den) => Math.hypot(p.x - den.x, p.z - den.z) > 0.6);
  plants.splice(0, plants.length, ...plants.filter(roomy));
  const shapes = flora();
  const leafDeep = paint(c.leafDeep);
  const leaf = paint(c.leaf);
  const leafLight = paint(c.leafLight);
  const bark = paint(c.woodDark);
  // Every instanced set is redrawn each frame from its island's height, so
  // plants rise out of the sea with their island and lean in the breeze.
  const plantSets: { meshes: InstancedMesh[]; list: Plant[]; sway: boolean }[] =
    [];
  const forest = (
    geometry: BufferGeometry,
    material: Material,
    list: Plant[],
    sway: boolean,
    line: number | null = 1.2,
  ) => {
    if (!list.length) return;
    const body = new InstancedMesh(geometry, material, list.length);
    body.castShadow = true;
    body.receiveShadow = true;
    const meshes = [body];
    if (line)
      meshes.push(
        new InstancedMesh(
          hull(geometry),
          outline(colorOf(material), line),
          list.length,
        ),
      );
    scene.add(...meshes);
    plantSets.push({ meshes, list, sway });
  };
  const rounds = plants.filter((p) => p.kind === 0);
  const pines = plants.filter((p) => p.kind === 1);
  const palms = plants.filter((p) => p.kind === 2);
  const merged = (parts: BufferGeometry[]) =>
    mergeGeometries(parts.map(flat)) ?? parts[0];
  forest(
    merged(shapes.round),
    leaf,
    rounds.filter((_, k) => k % 3),
    true,
  );
  forest(
    merged(shapes.round),
    leafLight,
    rounds.filter((_, k) => !(k % 3)),
    true,
  );
  forest(merged(shapes.pine), leafDeep, pines, true);
  forest(shapes.trunk, bark, [...rounds, ...pines], false, 1);
  forest(shapes.palmTrunk, bark, palms, false, 1);
  forest(merged(shapes.fronds), leaf, palms, true);
  // Flowers and tufts on the plateaus, rocks along the beaches.
  const dots: Plant[] = [];
  const stones: Plant[] = [];
  for (const [id, points] of Object.entries(outlines) as [
    "l" | "a" | "i",
    Point[],
  ][]) {
    for (let k = 0; k < 220; k++) {
      const jx = 14 + roll() * 196;
      const jy = 26 + roll() * 150;
      if (!inside(points, jx, jy)) continue;
      const depth = edgeDistance(points, jx, jy) * S;
      if (keepClear.some(([sx, sy]) => Math.hypot(sx - jx, sy - jy) < 8))
        continue;
      if (lionPath.some(([px, py]) => Math.hypot(px - jx, py - jy) < 3))
        continue;
      if (depth > GRASS.inset + 0.08)
        dots.push({
          x: wx(jx),
          z: wz(jy),
          y: TOP,
          kind: Math.floor(roll() * 3),
          scale: 0.6 + roll() * 0.6,
          turn: roll() * 6.28,
          island: id,
        });
    }
    // Rocks just off the beach, half in the water.
    for (let i = 0; i < points.length; i++) {
      const [ax, ay] = points[i];
      const [bx, by] = points[(i + 1) % points.length];
      const span = Math.hypot(bx - ax, by - ay);
      for (let s = 4; s < span; s += 9 + roll() * 9) {
        if (roll() < 0.45) continue;
        const u = s / span;
        const nx = (by - ay) / span;
        const ny = -(bx - ax) / span;
        const sign = inside(
          points,
          ax + (bx - ax) * u + nx,
          ay + (by - ay) * u + ny,
        )
          ? -1
          : 1;
        const out = 1.5 + roll() * 3;
        stones.push({
          x: wx(ax + (bx - ax) * u + nx * sign * out),
          z: wz(ay + (by - ay) * u + ny * sign * out),
          y: 0.02,
          kind: 0,
          scale: 0.7 + roll() * 0.9,
          turn: roll() * 6.28,
          island: id,
        });
      }
    }
  }
  dots.splice(0, dots.length, ...dots.filter(roomy));
  const flowerColors = [c.coral, c.yellow, c.white];
  flowerColors.forEach((color, kind) => {
    const list = dots.filter((p) => p.kind === kind);
    const bloom = ball(0.03, 6, 5).translate(0, 0.06, 0);
    forest(bloom, paint(color), list, false, null);
  });
  const tuft = merged(
    [0, 1, 2].map((k) =>
      ball(0.045, 6, 5).translate((k - 1) * 0.04, 0.02, (k % 2) * 0.02),
    ),
  );
  forest(tuft, leafDeep, dots, false, null);
  forest(shapes.rock, paint(c.rock), stones, false, 1.1);

  // --- Clouds on the horizon, for the low shot; out of frame from above ----
  const puff = ball(1, 16, 12);
  const clouds = (
    [
      [-17, 4.4, -27, 2.3],
      [-4, 5.8, -34, 2.8],
      [9, 4.8, -29, 2.1],
      [21, 5.4, -25, 1.9],
    ] as const
  ).map(([x, y, z, size], k) => {
    const lumps = (
      [
        [0, 0, 0, 0.9],
        [-0.95, -0.2, 0.1, 0.62],
        [0.95, -0.15, -0.05, 0.7],
        [0.35, 0.42, -0.2, 0.58],
        [-0.45, 0.3, 0.15, 0.5],
      ] as const
    ).map(([dx, dy, dz, r]) =>
      puff
        .clone()
        .scale(r * size, r * 0.72 * size, r * size)
        .translate(dx * size, dy * size, dz * size),
    );
    const cloud = put(
      scene,
      kit.solid(mergeGeometries(lumps.map(flat)) ?? puff, paint(c.white), 1.6),
      x,
      y,
      z,
    );
    return { cloud, x, phase: k * 1.7 };
  });

  // --- Merge everything that does not move ---------------------------------------
  // Static parts of each island are merged by material into a handful of
  // meshes (they still rise and lift with their island); animated parts and
  // instanced plants keep their own.
  const bake = (root: Object3D, shadows: boolean) => {
    root.updateMatrixWorld(true);
    const inverse = new Matrix4().copy(root.matrixWorld).invert();
    const groups = new Map<Material, BufferGeometry[]>();
    const casts = new Map<Material, boolean>();
    const victims: Mesh[] = [];
    const inner: Object3D[] = [];
    const walk = (object: Object3D) => {
      for (const child of [...object.children]) {
        if (child instanceof InstancedMesh) continue;
        if (child.userData.live) {
          inner.push(child);
          continue;
        }
        if (
          child instanceof Mesh &&
          !Array.isArray(child.material) &&
          !child.userData.island
        ) {
          const geometry = child.geometry
            .clone()
            .applyMatrix4(
              new Matrix4().multiplyMatrices(inverse, child.matrixWorld),
            );
          const flat = geometry.index ? geometry.toNonIndexed() : geometry;
          for (const name of Object.keys(flat.attributes))
            if (!["position", "normal", "uv"].includes(name))
              flat.deleteAttribute(name);
          if (!flat.getAttribute("uv"))
            flat.setAttribute(
              "uv",
              new Float32BufferAttribute(
                new Float32Array(flat.getAttribute("position").count * 2),
                2,
              ),
            );
          const list = groups.get(child.material) ?? [];
          list.push(flat);
          groups.set(child.material, list);
          casts.set(
            child.material,
            !child.userData.shell &&
              !(child.material instanceof MeshBasicMaterial),
          );
          victims.push(child);
        }
        walk(child);
      }
    };
    walk(root);
    for (const mesh of victims) mesh.removeFromParent();
    const flying = (() => {
      for (let node: Object3D | null = root; node; node = node.parent)
        if (node.userData.flying) return true;
      return false;
    })();
    for (const [material, list] of groups) {
      const geometry = mergeGeometries(list);
      if (!geometry) continue;
      const mesh = new Mesh(geometry, material);
      const solid = casts.get(material) ?? false;
      mesh.castShadow = shadows && solid && !flying;
      mesh.receiveShadow = solid;
      mesh.userData.shell = !solid && material instanceof ShaderMaterial;
      root.add(mesh);
    }
    for (const group of inner) bake(group, shadows);
  };
  // Landmarks (and the animals that stay put) cast shadows; the animals on
  // the move get a soft blob under them instead.
  for (const root of islandRoots.values()) bake(root, true);
  // Merged into their islands, landmarks are found by clicks through
  // invisible stand-ins.
  const standIn = new CylinderGeometry(0.62, 0.62, 1, 12).translate(0, 0.5, 0);
  const proxies = landmarks.map((item, index) => {
    const proxy = new Mesh(standIn);
    proxy.visible = false;
    proxy.scale.y = item.model.height;
    proxy.position.copy(item.at);
    proxy.userData.landmark = index;
    islandRoots.get(item.island)?.add(proxy);
    return proxy;
  });

  // Animals the visitor can pick up: the ones that live at a landmark, and
  // the ones on the three routes below.
  const critters: Critter[] = [];
  const adopt = (pet: Pet, kind: Critter["kind"], carrier?: Carrier) => {
    const critter: Critter = {
      ...pet,
      kind,
      carrier,
      parent: carrier ? null : pet.group.parent,
      home: {
        position: pet.group.position.clone(),
        quaternion: pet.group.quaternion.clone(),
        scale: pet.group.scale.clone(),
      },
      motion: { mode: "home" },
      at: new Vector3(),
      velocity: new Vector3(),
      boing: -10,
      blob: carrier?.shadow ?? null,
    };
    pet.group.userData.critter = critter;
    critters.push(critter);
  };
  for (const { model } of landmarks)
    for (const pet of model.pets ?? []) adopt(pet, "land");

  // --- Animals on the three routes ------------------------------------------------
  const blobMaterial = new MeshBasicMaterial({
    map: art.blob.texture,
    color: c.ink,
    transparent: true,
    depthWrite: false,
    opacity: 0.32,
  });
  const blobShape = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const shadowFor = () => {
    const mesh = new Mesh(blobShape, blobMaterial);
    scene.add(mesh);
    return mesh;
  };
  const routeDots = (curve: CatmullRomCurve3, color: Color, gap: number) => {
    const count = Math.max(2, Math.round(curve.getLength() / gap));
    const positions: number[] = [];
    for (const p of curve.getSpacedPoints(count))
      positions.push(p.x, p.y + 0.02, p.z);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    const dots = new Points(
      geometry,
      new PointsMaterial({
        color,
        size: 0.12,
        map: art.dot.texture,
        transparent: true,
        depthWrite: false,
        opacity: 0.8,
      }),
    );
    scene.add(dots);
  };
  const carriers: Carrier[] = [];
  const pop = (u: number) =>
    smooth(clamp(u / 0.06, 0, 1)) * smooth(clamp((1 - u) / 0.06, 0, 1));

  // 聽: Taiwan blue magpies bring stories in from the visitor's island.
  const magpiePath = curveOf(
    [
      [140, 203, 0.55],
      [151, 201, 1.4],
      [165, 193, 1.95],
      [179, 180, 1.5],
      [188.5, 167, TOP + 0.3],
    ],
    1,
  );
  routeDots(magpiePath, c.yellow, 0.34);
  for (const offset of [0, 0.5]) {
    const bird = magpie(kit);
    bake(bird.group, false);
    scene.add(bird.group);
    carriers.push({
      group: bird.group,
      curve: magpiePath,
      period: 7.5,
      offset,
      shadow: shadowFor(),
      size: 0.6,
      pitch: true,
      last: 0,
      delay: 0,
      away: false,
      move(t, u) {
        bird.group.scale.setScalar(pop(u) * 1.45);
        bird.fly(t, Math.sin(t * 0.9 + offset * 7) > 0.55);
      },
      hold(t) {
        bird.fly(t * 1.6, false);
      },
    });
    adopt(
      { id: "magpie", group: bird.group, hang: 0.2, reach: 0.3, settle: 0.2 },
      "air",
      carriers[carriers.length - 1],
    );
  }

  // 寫: lion cubs carry code over the islands; the AI star makes it bigger.
  routeDots(walkPath, c.coral, 0.32);
  let starAt = 0;
  {
    let best = Infinity;
    const center = ground(brandLogo.starCenter[0], brandLogo.starCenter[1]);
    for (let k = 0; k <= 400; k++) {
      const d = walkPath.getPointAt(k / 400).distanceTo(center);
      if (d < best) {
        best = d;
        starAt = k / 400;
      }
    }
  }
  for (const offset of [0, 0.5]) {
    const cub = lionCub(kit, "code");
    bake(cub.group, false);
    scene.add(cub.group);
    const sign = cub.group.getObjectByProperty("type", "Sprite");
    carriers.push({
      group: cub.group,
      curve: walkPath,
      period: 16,
      offset,
      shadow: shadowFor(),
      size: 0.55,
      pitch: false,
      last: 0,
      delay: 0,
      away: false,
      move(t, u, previous) {
        cub.group.scale.setScalar(pop(u) * 1.2);
        cub.walk(t, true);
        if (previous < starAt && u >= starAt) star?.kick(t);
        const grown = smooth(clamp((u - starAt) / 0.04, 0, 1));
        if (sign) sign.scale.setScalar(0.32 * (1 + grown * 0.6));
      },
      // Held up, it keeps walking on air.
      hold(t) {
        cub.walk(t * 1.7, true);
      },
    });
    adopt(
      { id: "cub", group: cub.group, hang: 0.55, reach: 0.55, settle: 0.55 },
      "land",
      carriers[carriers.length - 1],
    );
  }

  // 創: sea turtles bring the finished work home to the visitor's island.
  const turtlePath = curveOf(
    [
      [13, 112],
      [10, 140],
      [14, 168],
      [30, 186],
      [56, 197],
      [78, 202],
      [96, 201.5],
    ],
    0.03,
  );
  routeDots(turtlePath, c.green, 0.36);
  const ripples: { mesh: Mesh; born: number; size: number }[] = [];
  const rippleMaterial = (opacity: number) =>
    new MeshBasicMaterial({
      map: art.ring.texture,
      color: c.white,
      transparent: true,
      depthWrite: false,
      opacity,
    });
  const ripple = (at: Vector3, t: number, size: number) => {
    let slot = ripples.find((item) => t - item.born > 1.6);
    if (!slot) {
      if (ripples.length > 24) return;
      slot = { mesh: new Mesh(blobShape, rippleMaterial(0)), born: t, size };
      scene.add(slot.mesh);
      ripples.push(slot);
    }
    slot.born = t;
    slot.size = size;
    slot.mesh.position.set(at.x, 0.03, at.z);
  };
  for (const offset of [0, 0.5]) {
    const swimmer = seaTurtle(kit);
    bake(swimmer.group, false);
    scene.add(swimmer.group);
    let wake = 0;
    carriers.push({
      group: swimmer.group,
      curve: turtlePath,
      period: 18,
      offset,
      shadow: shadowFor(),
      size: 0.7,
      pitch: false,
      last: 0,
      delay: 0,
      away: false,
      move(t, u) {
        swimmer.group.scale.setScalar(pop(u) * 1.35);
        swimmer.swim(t);
        if (!still && t - wake > 0.7 && u > 0.04 && u < 0.96) {
          wake = t;
          ripple(swimmer.group.position, t, 0.9);
        }
      },
      hold(t) {
        swimmer.swim(t * 2.4);
      },
    });
    adopt(
      { id: "turtle", group: swimmer.group, hang: 0.3, reach: 0.3, settle: 0.3 },
      "sea",
      carriers[carriers.length - 1],
    );
  }

  // Pink dolphins leap out of the open sea now and then, two at a time.
  const pod = [dolphin(kit), dolphin(kit)].map((model) => {
    model.group.visible = false;
    bake(model.group, false);
    scene.add(model.group);
    return model;
  });
  // Small animals drop their outlines when the camera is far away.
  const detail: { at: Object3D; shells: Object3D[] }[] = [];
  const outlined = (at: Object3D) => {
    const shells: Object3D[] = [];
    at.traverse((object) => {
      if (object.userData.shell) shells.push(object);
    });
    detail.push({ at, shells });
  };
  for (const carrier of carriers) outlined(carrier.group);
  for (const model of pod) outlined(model.group);
  for (const { model } of landmarks)
    model.group.traverse((object) => {
      if (!object.userData.live) return;
      for (let up = object.parent; up && up !== model.group; up = up.parent)
        if (up.userData.live) return;
      outlined(object);
    });
  const splashes: { sprite: Sprite; born: number; velocity: Vector3 }[] = [];
  const splash = (at: Vector3, t: number) => {
    for (let k = 0; k < 9; k++) {
      let drop = splashes.find((item) => t - item.born > 0.9);
      if (!drop) {
        if (splashes.length > 40) break;
        const sprite = new Sprite(
          new SpriteMaterial({
            map: art.dot.texture,
            color: c.white,
            transparent: true,
            depthWrite: false,
          }),
        );
        scene.add(sprite);
        drop = { sprite, born: t, velocity: new Vector3() };
        splashes.push(drop);
      }
      const a = (k / 9) * Math.PI * 2;
      drop.born = t;
      drop.sprite.position.copy(at).setY(0.05);
      drop.velocity.set(
        Math.cos(a) * 0.9,
        2.2 + (k % 3) * 0.5,
        Math.sin(a) * 0.9,
      );
    }
    ripple(at, t, 1.4);
  };
  // Out at sea, and every other time in a channel between the letters,
  // where they show from above too: [x, z, heading].
  const leapSites = {
    open: [
      [-12.5, 9.5, 0.6],
      [12.5, 10, -0.5],
      [-13, -3, 1.2],
      [3, 13.6, 0.2],
      [12.8, -4, -1.4],
    ],
    channel: [
      [-3.9, -3.2, 1.7],
      [4.1, -3.6, 1.45],
    ],
  } as const;
  let leap: {
    start: number;
    site: readonly [number, number, number];
    near: boolean;
  } = { start: 4, site: leapSites.open[0], near: false };

  // Rain for a few seconds under a cloud: the AWS tower's (near, fine
  // drops) or one on the horizon (far, so bigger).
  const showers = [0.18, 1.7].map((size) => {
    const count = 64;
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(new Float32Array(count * 3), 3),
    );
    const points = new Points(
      geometry,
      new PointsMaterial({
        map: art.drop.texture,
        color: mix(c.sky, c.blue, size > 1 ? 0.6 : 0.35),
        size,
        transparent: true,
        depthWrite: false,
        opacity: 0.9,
      }),
    );
    points.frustumCulled = false;
    points.visible = false;
    scene.add(points);
    const drops = Array.from({ length: count }, (_, k) => ({
      a: k * 2.399,
      r: Math.sqrt((k + 0.5) / count),
      phase: (k * 0.618) % 1,
    }));
    return {
      points,
      drops,
      from: new Vector3(),
      floor: 0,
      reach: 0,
      start: -10,
    };
  });
  const shower = (from: Vector3, t: number, far: boolean) => {
    const rain = showers[far ? 1 : 0];
    rain.from.copy(from);
    rain.reach = far ? 2 : 0.45;
    rain.floor = far ? 0 : Math.max(groundAt(from.x, from.z), 0.02);
    rain.start = t;
  };

  // Fireworks over the islands, for the party.
  const sparks: { sprite: Sprite; born: number; velocity: Vector3 }[] = [];
  const burst = (at: Vector3, color: Color, t: number) => {
    for (let k = 0; k < 22; k++) {
      let spark = sparks.find((item) => t - item.born > 1.4);
      if (!spark) {
        if (sparks.length > 160) break;
        const sprite = new Sprite(
          new SpriteMaterial({
            map: art.spark.texture,
            transparent: true,
            depthWrite: false,
          }),
        );
        scene.add(sprite);
        spark = { sprite, born: t, velocity: new Vector3() };
        sparks.push(spark);
      }
      const a = (k / 22) * Math.PI * 2;
      const lift = ((k % 4) - 1.5) * 0.5;
      spark.born = t;
      spark.sprite.material.color.copy(color);
      spark.sprite.position.copy(at);
      spark.velocity.set(Math.cos(a) * 3.6, 1.4 + lift * 2.4, Math.sin(a) * 3.6);
    }
  };
  let partyAt = -10;
  let bursts = Infinity;

  // Gulls round the tower are part of it; fireflies and sparkles are not.
  const glowCloud = (count: number, map: Texture, size: number) => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(new Float32Array(count * 3), 3),
    );
    geometry.setAttribute(
      "color",
      new Float32BufferAttribute(new Float32Array(count * 3), 3),
    );
    const points = new Points(
      geometry,
      new PointsMaterial({
        map,
        size,
        vertexColors: true,
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    );
    points.frustumCulled = false;
    scene.add(points);
    return geometry;
  };
  const fireflies = Array.from({ length: 22 }, (_, k) => {
    const home = plants[(k * 7) % Math.max(1, plants.length)];
    return { x: home?.x ?? 0, z: home?.z ?? 0, phase: k * 1.37 };
  });
  const flyCloud = glowCloud(fireflies.length, art.glow.texture, 0.24);
  const flyColor = mix(c.yellow, c.green, 0.3);
  const sparkles = Array.from({ length: 16 }, (_, k) => {
    const a = k * 2.399;
    const r = 7 + (k % 5) * 1.6;
    return {
      x: Math.cos(a) * r * 1.3,
      z: Math.sin(a) * r + 1.5,
      phase: k * 0.71,
    };
  });
  const sparkCloud = glowCloud(sparkles.length, art.spark.texture, 0.32);

  // --- Camera -----------------------------------------------------------------
  const cluster = [
    ...Object.values(outlines).flat(),
    [
      youIsland.center[0] - youIsland.radius,
      youIsland.center[1] + youIsland.radius,
    ] as Point,
    [
      youIsland.center[0] + youIsland.radius,
      youIsland.center[1] + youIsland.radius,
    ] as Point,
  ].flatMap(([x, y]) => [ground(x, y, 0), ground(x, y, 1.6)]);
  const footprint = (id: IslandId) => {
    if (id === "you") {
      const [x, y] = youIsland.center;
      const r = youIsland.radius + 13;
      return [
        ground(x - r, y - r, 0),
        ground(x + r, y + r, 0),
        ground(x - r, y + r, 1.6),
        ground(x + r, y - r, 1.6),
      ];
    }
    const heights = landmarks.filter((item) => item.island === id);
    return [
      ...outlines[id].map(([x, y]) => ground(x, y, 0)),
      ...heights.map((item) => item.at.clone().setY(TOP + item.model.height)),
    ];
  };
  const centerOf = (points: Vector3[]) => {
    const min = new Vector3(Infinity, Infinity, Infinity);
    const max = new Vector3(-Infinity, -Infinity, -Infinity);
    for (const p of points) {
      min.min(p);
      max.max(p);
    }
    return min.add(max).multiplyScalar(0.5).setY(0.3);
  };
  const pose = (
    target: Vector3,
    yaw: number,
    pitch: number,
    distance = 30,
  ): Pose => ({
    target,
    yaw,
    pitch,
    distance,
  });
  const place = (p: Pose) => {
    const flat = Math.cos(p.pitch) * p.distance;
    camera.position.set(
      p.target.x + Math.sin(p.yaw) * flat,
      p.target.y + Math.sin(p.pitch) * p.distance,
      p.target.z + Math.cos(p.yaw) * flat,
    );
    camera.lookAt(p.target);
    camera.updateMatrixWorld();
  };
  const probe = new Vector3();
  // The nearest distance at which every point fits in the frame.
  const fit = (p: Pose, points: Vector3[], margin = 0.86) => {
    let near = 3;
    let far = 220;
    for (let k = 0; k < 22; k++) {
      const mid = (near + far) / 2;
      place({ ...p, distance: mid });
      const fits = points.every((point) => {
        probe.copy(point).project(camera);
        return (
          probe.z < 1 &&
          Math.abs(probe.x) <= margin &&
          Math.abs(probe.y) <= margin
        );
      });
      if (fits) far = mid;
      else near = mid;
    }
    return { ...p, distance: far };
  };

  let width = 1;
  let height = 1;
  let overview = pose(new Vector3(0, 0, 1.2), 0, 1.0);
  let opening = pose(new Vector3(0, 0.8, -1), -0.42, 0.16);
  const focusPoses = new Map<IslandId, Pose>();
  const yawFor = (id: IslandId, wide: boolean) =>
    ({
      l: wide ? -1.3 : -0.18,
      a: wide ? 0.42 : 0.12,
      i: wide ? 1.3 : 0.2,
      you: 0.12,
    })[id];
  const frame = () => {
    const wide = width / height > 1.15;
    overview = fit(pose(centerOf(cluster), 0, 1.02), cluster, 0.9);
    opening = pose(
      overview.target.clone().setY(0.9).setZ(-0.5),
      -0.42,
      0.16,
      overview.distance * 1.02,
    );
    for (const island of islands) {
      const points = footprint(island.id);
      focusPoses.set(
        island.id,
        fit(
          pose(
            centerOf(points),
            yawFor(island.id, wide),
            island.id === "you" ? 0.62 : 0.72,
          ),
          points,
          0.78,
        ),
      );
    }
  };

  // Close enough to one landmark to watch its animals at work, from the
  // front (models face the camera's usual side) and a little above.
  const closeUp = (island: IslandId, index: number): Pose | null => {
    const item = landmarks.filter((entry) => entry.island === island)[index];
    if (!item) return null;
    const reach = Math.max(0.95, item.model.height * 0.72);
    const wide = width / height > 1.15;
    return {
      // On a tall phone stage the HUD fills the top and the lion's bubble
      // the bottom, so the landmark sits a little higher.
      target:
        wide && item.model.aim
          ? item.at.clone().add(item.model.aim)
          : item.at
              .clone()
              .setY(TOP + item.model.height * 0.42 - (wide ? 0 : 0.3)),
      yaw: island === "l" ? -0.45 : wide ? 0.42 : 0.2,
      pitch: 0.36,
      distance: (reach / Math.sin((FOV * Math.PI) / 360)) * (wide ? 1.15 : 1.5),
    };
  };

  // --- Labels and pins (HTML over the canvas) --------------------------------
  const tagAnchors: Record<IslandId, Vector3> = {
    l: ground(33, 22, 1.5),
    a: ground(118, 20, 1.6),
    i: ground(189, 22, 1.5),
    you: ground(
      youIsland.center[0],
      youIsland.center[1] + youIsland.radius + 9,
      1.1,
    ),
  };
  const tags = Array.from(
    stage.querySelectorAll<HTMLElement>("[data-isl-tag]"),
  ).map((element) => ({
    element,
    anchor: tagAnchors[element.dataset.island as IslandId] ?? new Vector3(),
  }));
  const pins = Array.from(
    stage.querySelectorAll<HTMLElement>("[data-isl-pin]"),
  ).map((element) => {
    const island = element.dataset.island as IslandId;
    const index = Number(element.dataset.spot);
    const item = landmarks.filter((entry) => entry.island === island)[index];
    return {
      element,
      anchor: item
        ? item.at.clone().setY(TOP + item.model.height + 0.3)
        : new Vector3(),
    };
  });
  const placeLabels = () => {
    for (const { element, anchor } of [...tags, ...pins]) {
      probe.copy(anchor).project(camera);
      const x = (probe.x * 0.5 + 0.5) * width;
      const y = (-probe.y * 0.5 + 0.5) * height;
      element.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      element.style.visibility =
        probe.z < 1 && Math.abs(probe.x) < 1.1 && Math.abs(probe.y) < 1.1
          ? ""
          : "hidden";
    }
  };

  // --- State ---------------------------------------------------------------------
  let focused: IslandId | null = null;
  let looked: number | null = null;
  let hovered: IslandId | null = null;
  let flight = { from: overview, start: -10 };
  let current = overview;
  let revealed = false;
  let rise = still ? 1 : 0;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let bouncing: { model: Model; start: number } | null = null;
  // The islands stay under water until the section is first on screen.
  let introStart = still ? -10 : Infinity;
  let lit = false;
  let shadowsDirty = true;
  const clock = () => performance.now() / 1000;

  // The climb starts once most of the stage is on screen (and the islands
  // are up), so the low shot and the swoop are seen whole.
  let revealStart = still ? -10 : Infinity;
  const lerpPose = (a: Pose, b: Pose, t: number): Pose => {
    let yaw = b.yaw - a.yaw;
    if (yaw > Math.PI) yaw -= Math.PI * 2;
    if (yaw < -Math.PI) yaw += Math.PI * 2;
    return {
      target: a.target.clone().lerp(b.target, t),
      yaw: a.yaw + yaw * t,
      pitch: a.pitch + (b.pitch - a.pitch) * t,
      distance: Math.exp(
        Math.log(a.distance) +
          (Math.log(b.distance) - Math.log(a.distance)) * t,
      ),
    };
  };
  const revealPose = (t: number) => {
    if (still) return overview;
    if (revealStart === Infinity && introStart !== Infinity) {
      const rect = stage.getBoundingClientRect();
      const view = window.innerHeight || 1;
      const shown =
        (Math.min(rect.bottom, view) - Math.max(rect.top, 0)) / rect.height;
      if (shown > 0.62) revealStart = Math.max(t + 0.35, introStart + 1.7);
    }
    rise = easeInOut(clamp((t - revealStart) / REVEAL, 0, 1));
    return lerpPose(opening, overview, rise);
  };

  const applyLight = (p: Palette) => {
    renderer.setClearColor(p.horizon);
    (scene.fog as Fog).color.copy(p.horizon);
    hemisphere.color.copy(p.fill);
    hemisphere.groundColor.copy(p.under);
    hemisphere.intensity = p.fillPower;
    sun.color.copy(p.sun);
    sun.intensity = p.sunPower;
    sun.position
      .copy(sun.target.position)
      .addScaledVector(p.sunAt.clone().normalize(), 32);
    skyMaterial.uniforms.uStars.value = p.glow;
    for (const item of lamps)
      item.material.color.copy(item.day).lerp(item.night, p.glow);
    for (const item of halos)
      item.sprite.material.opacity =
        item.day + (item.night - item.day) * p.glow;
    blobMaterial.opacity = 0.32 - p.glow * 0.12;
  };

  // --- Play: poke, drag the view, pick animals up ---------------------------------
  // A click on an island flies there; on a landmark of the focused island it
  // flies up close and pokes it; animals, a jumping dolphin and the clouds on
  // the horizon answer a click too. Dragging the sea or an island turns the
  // view (sideways only on touch, so the page still scrolls); pressing on an
  // animal and dragging, or holding it a moment, picks it up.
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const aimAt = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
  };
  type Hit =
    | { kind: "critter"; critter: Critter }
    | { kind: "dolphin"; model: Model }
    | { kind: "landmark"; index: number }
    | { kind: "cloud"; index: number }
    | { kind: "island"; id: IslandId };
  const shown = (root: Object3D, out: Object3D[] = []) => {
    if (!root.visible) return out;
    if (root instanceof Mesh) out.push(root);
    for (const child of root.children) shown(child, out);
    return out;
  };
  const ownerOf = (object: Object3D | undefined) => {
    for (let node = object ?? null; node; node = node.parent)
      if (node.userData.critter) return node.userData.critter as Critter;
    return null;
  };
  const cloudMeshes = clouds.map(({ cloud }, index) => {
    cloud.userData.cloud = index;
    return cloud;
  });
  // Animals first (they are small and stand in front of their landmarks),
  // then a jumping dolphin, then the nearest landmark, cloud or island.
  const hitTest = (clientX: number, clientY: number): Hit | null => {
    aimAt(clientX, clientY);
    const animals: Object3D[] = [];
    for (const critter of critters)
      if (critter.motion.mode !== "hop") shown(critter.group, animals);
    const animal = ownerOf(raycaster.intersectObjects(animals, false)[0]?.object);
    if (animal) return { kind: "critter", critter: animal };
    for (const model of pod)
      if (
        model.group.visible &&
        raycaster.intersectObjects(shown(model.group), false).length
      )
        return { kind: "dolphin", model };
    const hit = raycaster.intersectObjects(
      [...proxies, ...cloudMeshes, ...pickables],
      false,
    )[0]?.object;
    if (!hit) return null;
    if (hit.userData.landmark !== undefined)
      return { kind: "landmark", index: hit.userData.landmark as number };
    if (hit.userData.cloud !== undefined)
      return { kind: "cloud", index: hit.userData.cloud as number };
    return { kind: "island", id: hit.userData.island as IslandId };
  };
  const setHover = (id: IslandId | null) => {
    if (id === hovered) return;
    hovered = id;
    for (const [key, materials] of islandLines)
      for (const line of materials) {
        line.uniforms.uColor.value.copy(
          key === id
            ? c.yellow
            : inkFor(line === materials[0] ? c.sand : c.leafDeep),
        );
        line.uniforms.uThickness.value =
          key === id ? 3.6 : line === materials[0] ? 2 : 1.8;
      }
    if (id) stage.dataset.hover = id;
    else delete stage.dataset.hover;
    wake();
  };
  let cursor = "";
  const point = (style: string) => {
    if (style === cursor) return;
    cursor = style;
    canvas.style.cursor = style;
  };
  const canPlay = () => revealed || still;
  const hover = (clientX: number, clientY: number) => {
    const hit = canPlay() ? hitTest(clientX, clientY) : null;
    const island =
      hit?.kind === "island"
        ? hit.id
        : hit?.kind === "landmark"
          ? landmarks[hit.index].island
          : null;
    setHover(island === focused ? null : island);
    point(
      hit?.kind === "critter"
        ? "grab"
        : hit && (hit.kind !== "island" || hit.id !== focused)
          ? "pointer"
          : canPlay()
            ? "grab"
            : "",
    );
  };

  // Poking. The world counts the pokes (pokes in a row set off the big
  // reactions); under reduced motion nothing moves, but the words and the
  // eggs still come.
  const landmarkId = (item: Placed) =>
    `${item.island}${landmarks.filter((entry) => entry.island === item.island).indexOf(item)}` as PlayId;
  const pokes = new Map<string, number[]>();
  const inARow = (key: string, t: number, need: number, within: number) => {
    const times = pokes.get(key) ?? [];
    times.push(t);
    while (t - times[0] > within) times.shift();
    pokes.set(key, times);
    if (times.length < need) return false;
    times.length = 0;
    return true;
  };
  const specials: Partial<
    Record<PlayId, { egg: EggId; need: number; within: number }>
  > = {
    l3: { egg: "tower-fall", need: 3, within: 5 },
    a0: { egg: "star-dizzy", need: 5, within: 4 },
  };
  const pokeLandmark = (item: Placed, t: number) => {
    const id = landmarkId(item);
    const special = specials[id];
    const big = special ? inARow(id, t, special.need, special.within) : false;
    if (!still) item.model.poke?.(t, big);
    if (item.model.rain)
      shower(item.model.rain.getWorldPosition(new Vector3()), t, false);
    events.play(id, "poke", big && special ? [special.egg] : undefined);
    wake();
  };
  const pokeCritter = (critter: Critter, t: number) => {
    if (critter.motion.mode !== "home") return;
    const { id } = critter;
    // The rabbit jumps for itself (a binky); the others hop.
    if (!still && id !== "bunny") critter.boing = t;
    // Four pets in a row is one too many for the cat and the rabbit.
    const mad = (id === "cat" || id === "bunny") && inARow(id, t, 4, 6);
    // Rabbits are liveliest at dawn and dusk.
    const glad =
      id === "bunny" &&
      !mad &&
      (daypart === "morning" || daypart === "evening");
    if (!still) critter.poke?.(t, mad ? "mad" : glad ? "glad" : undefined);
    const eggs: EggId[] =
      id === "cat"
        ? mad
          ? []
          : now.glow > 0.5
            ? ["cat-night", "cat-pet"]
            : ["cat-pet"]
        : id === "bunny"
          ? mad
            ? ["bunny-thump"]
            : glad
              ? ["bunny-dusk", "bunny-binky"]
              : ["bunny-binky"]
          : [];
    events.play(id, mad ? "mad" : "poke", eggs);
    wake();
  };
  const click = (clientX: number, clientY: number) => {
    const t = clock();
    const hit = hitTest(clientX, clientY);
    if (canPlay() && hit) {
      if (hit.kind === "critter") return pokeCritter(hit.critter, t);
      if (!still && t - flight.start < FLIGHT * 0.85) return;
      if (hit.kind === "dolphin") {
        hit.model.group.userData.flip = t;
        events.play("dolphin", "poke", ["dolphin"]);
        return;
      }
      if (hit.kind === "cloud") {
        const { cloud } = clouds[hit.index];
        cloud.userData.bounce = t;
        shower(cloud.position.clone().setY(cloud.position.y - 0.8), t, true);
        events.play("cloud", "poke", ["cloud-rain"]);
        wake();
        return;
      }
      if (hit.kind === "landmark" && landmarks[hit.index].island === focused) {
        const item = landmarks[hit.index];
        const index = landmarks
          .filter((entry) => entry.island === focused)
          .indexOf(item);
        if (index !== looked) events.look(index);
        pokeLandmark(item, t);
        return;
      }
    }
    const id =
      hit?.kind === "island"
        ? hit.id
        : hit?.kind === "landmark"
          ? landmarks[hit.index].island
          : null;
    if (id || focused) events.pick(id);
  };

  // Dragging the view: offsets from the framed pose, and how fast it spins
  // on after a flick.
  const orbit = { yaw: 0, pitch: 0, spin: 0, turned: false, back: false };
  const turn = (dx: number, dy: number, ms: number, touch: boolean) => {
    const yaw = (-dx / width) * 3.4;
    orbit.yaw += yaw;
    if (!touch)
      orbit.pitch = clamp(
        orbit.pitch + (dy / height) * 1.8,
        0.1 - current.pitch,
        1.48 - current.pitch,
      );
    orbit.spin = orbit.spin * 0.4 + (ms > 0 ? yaw / (ms / 1000) : 0) * 0.6;
  };
  // Every flight starts from the view as the visitor left it.
  const takeOff = () => {
    flight = {
      from: {
        ...current,
        yaw: current.yaw + orbit.yaw,
        pitch: clamp(current.pitch + orbit.pitch, 0.08, 1.5),
      },
      start: clock(),
    };
    orbit.yaw = 0;
    orbit.pitch = 0;
    orbit.spin = 0;
  };

  // Picking animals up: the held one hangs from a hand that follows the
  // pointer over the islands, swings as it moves and faces the camera; let
  // go, it falls (bouncing on land, splashing in the sea), sits a moment and
  // hops home: back to its landmark, or onto its route where it left off.
  const presses = new Map<Placed, number>();
  let held: Critter | null = null;
  const hanger = new Group();
  hanger.rotation.order = "YXZ";
  scene.add(hanger);
  const hand = new Vector3();
  const handPlane = new Plane(new Vector3(0, 1, 0), 0);
  const handHit = new Vector3();
  const aimHand = (clientX: number, clientY: number) => {
    if (!held) return;
    aimAt(clientX, clientY);
    const y = Math.min(TOP + held.reach + 0.35, camera.position.y - 0.6);
    handPlane.constant = -y;
    const at = raycaster.ray.intersectPlane(handPlane, handHit);
    if (!at || at.distanceTo(camera.position) > 40) return;
    hand.set(clamp(at.x, -15, 15), y, clamp(at.z, -13, 14));
  };
  const floorAt = (x: number, z: number) => {
    const ground = groundAt(x, z);
    if (ground <= 0) return 0;
    const [cx, cy] = youIsland.center;
    const id =
      Math.hypot(x / S + ORIGIN[0] - cx, z / S + ORIGIN[1] - cy) <
      youIsland.radius + 2
        ? "you"
        : nearestIsland(new Vector3(x, 0, z));
    return ground + (islandRoots.get(id)?.position.y ?? 0);
  };
  const homeOf = (critter: Critter, out: Vector3) => {
    const { carrier } = critter;
    if (carrier) {
      const u = still
        ? (carrier.offset + 0.3) % 1
        : ((((clock() - carrier.delay) / carrier.period + carrier.offset) %
            1) +
            1) %
          1;
      return out.copy(carrier.curve.getPointAt(u));
    }
    return critter.parent
      ? critter.parent.localToWorld(out.copy(critter.home.position))
      : out.copy(critter.at);
  };
  const hopHome = (critter: Critter, t: number): Motion => {
    const from = critter.group.position.clone();
    const span = from.distanceTo(homeOf(critter, new Vector3()));
    return {
      mode: "hop",
      from,
      start: t,
      duration: clamp(0.45 + span * 0.07, 0.5, 1.4),
    };
  };
  const arrive = (critter: Critter, t: number) => {
    critter.motion = { mode: "home" };
    critter.boing = t;
    if (critter.carrier) critter.carrier.away = false;
    else if (critter.parent) {
      critter.parent.attach(critter.group);
      critter.group.position.copy(critter.home.position);
      critter.group.quaternion.copy(critter.home.quaternion);
      critter.group.scale.copy(critter.home.scale);
    }
    shadowsDirty = true;
  };
  const grab = (critter: Critter, clientX: number, clientY: number) => {
    const t = clock();
    if (press) press.mode = "hold";
    held = critter;
    critter.motion = { mode: "held", since: t };
    if (critter.carrier) critter.carrier.away = true;
    critter.group.getWorldPosition(critter.at);
    // Hung so that it starts off where it stood.
    hanger.position.copy(critter.at);
    hanger.position.y += critter.reach;
    hanger.rotation.set(
      0,
      Math.atan2(
        camera.position.x - critter.at.x,
        camera.position.z - critter.at.z,
      ),
      0,
    );
    hanger.updateMatrixWorld();
    hanger.attach(critter.group);
    critter.group.position.set(0, -critter.hang, 0);
    critter.group.quaternion.identity();
    critter.lift?.(true, still ? 0 : t);
    critter.velocity.set(0, 0, 0);
    hand.copy(hanger.position);
    aimHand(clientX, clientY);
    point("grabbing");
    events.play(
      critter.id,
      "lift",
      critter.id === "cat"
        ? ["cat-liquid"]
        : critter.id === "cub"
          ? ["cub-air"]
          : undefined,
    );
    wake();
  };
  // Put down by the cat, the rabbit sits next to it (not on it) and turns to
  // it, and they both light up for a while before it hops home.
  const catAt = new Vector3();
  const besideCat = (critter: Critter) => {
    const cat = critters.find((one) => one.id === "cat");
    if (!cat) return null;
    const at = critter.group.position;
    cat.group.getWorldPosition(catAt);
    const gap = Math.hypot(at.x - catAt.x, at.z - catAt.z);
    if (gap > 0.6) return null;
    if (gap < 0.42) {
      const a = gap > 0.01 ? Math.atan2(at.x - catAt.x, at.z - catAt.z) : -1.6;
      const x = catAt.x + Math.sin(a) * 0.42;
      const z = catAt.z + Math.cos(a) * 0.42;
      const floor = floorAt(x, z);
      if (floor > 0) at.set(x, floor, z);
    }
    return cat;
  };
  const landed = (critter: Critter, t: number, wet: boolean) => {
    if (wet && !still) splash(critter.group.position, t);
    let stay = critter.kind === "sea" ? 1.6 : 0.9;
    if (critter.id === "cat")
      events.play("cat", wet ? "wet" : "land", wet ? ["cat-water"] : undefined);
    else if (critter.id === "turtle" && !wet)
      events.play("turtle", "land", ["turtle-land"]);
    else if (critter.id === "bunny") {
      const cat = wet ? null : besideCat(critter);
      if (cat && !still) {
        const at = critter.group.position;
        critter.group.rotation.y = Math.atan2(catAt.x - at.x, catAt.z - at.z);
        critter.poke?.(t);
        cat.poke?.(t);
      }
      if (cat) stay = 2.4;
      events.play(
        "bunny",
        wet ? "wet" : "land",
        cat ? ["bunny-friends"] : undefined,
      );
    }
    critter.motion =
      critter.kind === "sea" && wet
        ? hopHome(critter, t)
        : { mode: "rest", until: t + stay, wet };
    if (still) arrive(critter, t);
  };
  const letGo = () => {
    const critter = held;
    if (!critter) return;
    const t = clock();
    held = null;
    scene.attach(critter.group);
    critter.group.position.copy(hanger.position);
    critter.group.position.y -= critter.settle;
    critter.group.rotation.set(0, hanger.rotation.y, 0);
    critter.lift?.(false, still ? 0 : t);
    critter.velocity.clampLength(0, 6);
    hanger.rotation.set(0, 0, 0);
    if (still) {
      const floor = floorAt(critter.group.position.x, critter.group.position.z);
      critter.group.position.y = floor;
      landed(critter, t, floor <= 0);
    } else
      critter.motion =
        critter.kind === "air"
          ? hopHome(critter, t)
          : { mode: "fall", wet: false };
    wake();
  };
  const jump = (s: number) =>
    s >= 0 && s < 0.45 ? Math.sin((s / 0.45) * Math.PI) * 0.22 : 0;
  const before = new Vector3();
  const homeAt = new Vector3();
  const tend = (t: number, dt: number) => {
    for (const critter of critters) {
      const { motion, group } = critter;
      if (motion.mode === "home") {
        const hop = jump(t - critter.boing);
        if (critter.carrier) group.position.y += hop;
        else group.position.y = critter.home.position.y + hop;
        continue;
      }
      if (critter.carrier) critter.carrier.delay += dt;
      if (!critter.blob) shadowsDirty = true;
      if (motion.mode === "held") {
        before.copy(hanger.position);
        hanger.position.lerp(hand, still ? 1 : 1 - Math.exp(-dt * 16));
        if (dt > 0)
          critter.velocity.lerp(
            homeAt.subVectors(hanger.position, before).divideScalar(dt),
            0.5,
          );
        const face = Math.atan2(
          camera.position.x - hanger.position.x,
          camera.position.z - hanger.position.z,
        );
        const ahead =
          critter.velocity.x * Math.sin(face) +
          critter.velocity.z * Math.cos(face);
        const aside =
          critter.velocity.x * Math.cos(face) -
          critter.velocity.z * Math.sin(face);
        const ease = still ? 1 : 1 - Math.exp(-dt * 7);
        hanger.rotation.y = face;
        hanger.rotation.x +=
          (clamp(ahead * 0.09, -0.7, 0.7) - hanger.rotation.x) * ease;
        hanger.rotation.z +=
          (clamp(-aside * 0.09, -0.7, 0.7) +
            (still ? 0 : Math.sin(t * 11) * 0.06) -
            hanger.rotation.z) *
          ease;
        critter.carrier?.hold(t);
      } else if (motion.mode === "fall") {
        critter.velocity.y -= 16 * dt;
        group.position.addScaledVector(critter.velocity, dt);
        const floor = floorAt(group.position.x, group.position.z);
        if (group.position.y <= floor) {
          group.position.y = floor;
          const wet = floor <= 0;
          if (!wet && critter.velocity.y < -3.2)
            critter.velocity.set(
              critter.velocity.x * 0.5,
              -critter.velocity.y * 0.3,
              critter.velocity.z * 0.5,
            );
          else landed(critter, t, wet);
        }
      } else if (motion.mode === "rest") {
        if (motion.wet) group.position.y = -0.05 + Math.sin(t * 7) * 0.025;
        if (t >= motion.until) critter.motion = hopHome(critter, t);
      } else {
        const k = clamp((t - motion.start) / motion.duration, 0, 1);
        homeOf(critter, homeAt);
        const rise = 0.5 + motion.from.distanceTo(homeAt) * 0.12;
        group.position.lerpVectors(motion.from, homeAt, k);
        group.position.y += Math.sin(k * Math.PI) * rise;
        group.rotation.y = Math.atan2(
          homeAt.x - motion.from.x,
          homeAt.z - motion.from.z,
        );
        if (k === 1) arrive(critter, t);
      }
      if (critter.blob && critter.motion.mode !== "home") {
        group.getWorldPosition(before);
        const floor = floorAt(before.x, before.z);
        critter.blob.position.set(before.x, floor + 0.015, before.z);
        critter.blob.scale.setScalar(
          (critter.carrier?.size ?? 0.5) /
            (1 + Math.max(0, before.y - floor) * 0.6),
        );
        critter.blob.visible = true;
      }
    }
  };

  type Press = {
    pointer: number;
    x: number;
    y: number;
    time: number;
    lastX: number;
    lastY: number;
    lastTime: number;
    critter: Critter | null;
    mode: "press" | "turn" | "hold";
    touch: boolean;
  };
  let press: Press | null = null;
  const onPointerDown = (event: PointerEvent) => {
    if ((event.pointerType === "mouse" && event.button !== 0) || press) return;
    const hit = canPlay() ? hitTest(event.clientX, event.clientY) : null;
    const stamp = performance.now();
    press = {
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      time: stamp,
      lastX: event.clientX,
      lastY: event.clientY,
      lastTime: stamp,
      critter:
        hit?.kind === "critter" && hit.critter.motion.mode === "home"
          ? hit.critter
          : null,
      mode: "press",
      touch: event.pointerType !== "mouse",
    };
    pointer.tx = 0;
    pointer.ty = 0;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // The pointer is already gone; the press ends with it.
    }
  };
  const onPointerMove = (event: PointerEvent) => {
    if (press && event.pointerId === press.pointer) {
      const stamp = performance.now();
      if (
        press.mode === "press" &&
        Math.hypot(event.clientX - press.x, event.clientY - press.y) > 6
      ) {
        if (press.critter) grab(press.critter, event.clientX, event.clientY);
        else if (canPlay()) {
          press.mode = "turn";
          setHover(null);
          point("grabbing");
        }
      }
      if (press.mode === "turn")
        turn(
          event.clientX - press.lastX,
          event.clientY - press.lastY,
          stamp - press.lastTime,
          press.touch,
        );
      else if (press.mode === "hold") aimHand(event.clientX, event.clientY);
      press.lastX = event.clientX;
      press.lastY = event.clientY;
      press.lastTime = stamp;
    } else if (!press) {
      const rect = canvas.getBoundingClientRect();
      pointer.tx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.ty = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      if (event.pointerType === "mouse") hover(event.clientX, event.clientY);
    }
    wake();
  };
  const onPointerUp = (event: PointerEvent) => {
    if (!press || event.pointerId !== press.pointer) return;
    const done = press;
    press = null;
    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch {
      // Released already.
    }
    const stamp = performance.now();
    if (done.mode === "hold") letGo();
    else if (done.mode === "turn") {
      if (still || stamp - done.lastTime > 80) orbit.spin = 0;
    } else if (stamp - done.time < 700) click(event.clientX, event.clientY);
    point("");
    if (event.pointerType === "mouse") hover(event.clientX, event.clientY);
    wake();
  };
  // The browser took the gesture over (a scroll, say).
  const onPointerCancel = (event: PointerEvent) => {
    if (!press || event.pointerId !== press.pointer) return;
    const done = press;
    press = null;
    if (done.mode === "hold") letGo();
    orbit.spin = 0;
    point("");
  };
  const onPointerLeave = () => {
    pointer.tx = 0;
    pointer.ty = 0;
    if (press) return;
    setHover(null);
    point("");
  };
  // A finger that lands on an animal is picking it up, not scrolling.
  const onTouchStart = (event: TouchEvent) => {
    if (event.touches.length !== 1 || !canPlay()) return;
    const touch = event.touches[0];
    if (hitTest(touch.clientX, touch.clientY)?.kind === "critter")
      event.preventDefault();
  };
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);
  canvas.addEventListener("touchstart", onTouchStart, { passive: false });

  const onLost = (event: Event) => {
    event.preventDefault();
    sleep();
    events.lost();
  };
  canvas.addEventListener("webglcontextlost", onLost);

  // --- Loop -----------------------------------------------------------------------
  let running = false;
  let raf = 0;
  const islandIds = islands.map((island) => island.id);
  const matrix = new Matrix4();
  const spin = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const tilt = new Vector3(1, 0, 0);
  const sway = new Quaternion();
  const size = new Vector3();
  const place3 = new Vector3();
  let lastFrame = 0;

  function draw() {
    const t = clock();
    const dt = clamp(t - lastFrame, 0, 0.05);
    lastFrame = t;
    // Islands rise out of the sea one after another the first time.
    let moving = false;
    islandIds.forEach((id, k) => {
      const root = islandRoots.get(id);
      if (!root) return;
      const local = clamp((t - introStart - k * 0.24) / 1.3, 0, 1);
      const back =
        local === 1 ? 1 : 1 + 2.2 * (local - 1) ** 3 + 1.2 * (local - 1) ** 2;
      const lift = id === hovered ? 0.14 : 0;
      const before = root.userData.lift ?? 0;
      root.userData.lift = before + (lift - before) * (still ? 1 : 0.15);
      root.position.y = (back - 1) * 1.6 + root.userData.lift;
      if (local < 1 || Math.abs(root.userData.lift - lift) > 0.002)
        moving = true;
    });
    if (fade.start >= 0) {
      const k = still ? 1 : clamp((t - fade.start) / 1.4, 0, 1);
      blend(fade.from, fade.to, smooth(k), now);
      if (k === 1) fade.start = -1;
      shadowsDirty = true;
    }
    if (moving) shadowsDirty = true;
    applyLight(now);
    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;
    const base = focused
      ? (looked !== null && closeUp(focused, looked)) ||
        (focusPoses.get(focused) ?? overview)
      : revealPose(t);
    const k = still ? 1 : clamp((t - flight.start) / FLIGHT, 0, 1);
    current = k < 1 ? lerpPose(flight.from, base, easeInOut(k)) : base;
    // A flicked view spins on and slows down.
    if (press?.mode !== "turn" && orbit.spin) {
      orbit.yaw += orbit.spin * dt;
      orbit.spin *= Math.exp(-dt * 3.2);
      if (Math.abs(orbit.spin) < 0.01) orbit.spin = 0;
    }
    place({
      ...current,
      yaw: current.yaw + orbit.yaw + (still ? 0 : pointer.x * 0.045),
      pitch: clamp(
        current.pitch + orbit.pitch + (still ? 0 : -pointer.y * 0.03),
        0.08,
        1.5,
      ),
    });
    const turned =
      Math.abs(Math.atan2(Math.sin(orbit.yaw), Math.cos(orbit.yaw))) > 0.35 ||
      Math.abs(orbit.pitch) > 0.2;
    if (turned !== orbit.turned) {
      orbit.turned = turned;
      events.turned(turned);
    }
    // Turned right round, the name reads backwards.
    if (!focused && revealed) {
      const yaw = current.yaw + orbit.yaw;
      const facing = Math.abs(Math.atan2(Math.sin(yaw), Math.cos(yaw)));
      if (facing > 2.5 && !orbit.back) {
        orbit.back = true;
        events.play("view", "poke", ["back-view"]);
      } else if (facing < 1.6) orbit.back = false;
    }
    // Holding an animal a moment picks it up.
    if (
      press?.mode === "press" &&
      press.critter &&
      performance.now() - press.time > 380
    )
      grab(press.critter, press.lastX, press.lastY);
    sky.position.copy(camera.position);
    stage.style.setProperty("--isl-rise", rise.toFixed(3));
    if (!revealed && rise > 0.97) {
      revealed = true;
      if (!still) star?.kick(t);
      events.reveal();
    }
    const time = still ? 0 : t;
    seaMaterial.uniforms.uTime.value = time;
    skyMaterial.uniforms.uTime.value = time;
    for (const { model } of landmarks) model.tick?.(time, camera.position);
    for (const { cloud, x, phase } of clouds) {
      cloud.position.x = x + Math.sin(time * 0.05 + phase) * 1.6;
      const bounce = t - (cloud.userData.bounce ?? -10);
      cloud.scale.setScalar(
        1 + (bounce < 0.6 ? Math.sin((bounce / 0.6) * Math.PI) * 0.15 : 0),
      );
    }
    // Plants follow their island and lean a little in the breeze.
    for (const { meshes, list, sway: leans } of plantSets) {
      list.forEach((plant, k) => {
        sway.setFromAxisAngle(
          tilt,
          leans ? Math.sin(time * 1.3 + plant.x * 0.8 + plant.z) * 0.035 : 0,
        );
        spin.setFromAxisAngle(up, plant.turn).multiply(sway);
        size.setScalar(plant.scale);
        place3.set(
          plant.x,
          plant.y + (islandRoots.get(plant.island)?.position.y ?? 0),
          plant.z,
        );
        matrix.compose(place3, spin, size);
        for (const mesh of meshes) mesh.setMatrixAt(k, matrix);
      });
      for (const mesh of meshes) mesh.instanceMatrix.needsUpdate = true;
    }
    bridges.position.y = Math.min(
      ...(["l", "a", "i"] as const).map(
        (id) => islandRoots.get(id)?.position.y ?? 0,
      ),
    );
    if (bouncing) {
      const b = clamp((t - bouncing.start) / 0.7, 0, 1);
      const hop = Math.sin(b * Math.PI) * (1 - b * 0.4);
      bouncing.model.group.scale.setScalar(1 + hop * 0.22);
      if (b === 1 && !still) bouncing = null;
    }
    const ready = still ? 1 : smooth(clamp((t - introStart - 1.6) / 0.6, 0, 1));
    for (const carrier of carriers) {
      // In a visitor's hand, or on its way back to the route.
      if (carrier.away) continue;
      const u = still
        ? (carrier.offset + 0.3) % 1
        : ((((t - carrier.delay) / carrier.period + carrier.offset) % 1) + 1) %
          1;
      const point = carrier.curve.getPointAt(u);
      const ahead = carrier.curve.getPointAt(Math.min(u + 0.01, 1));
      carrier.group.position.copy(point);
      if (u < 0.99)
        carrier.group.lookAt(
          ahead.x,
          carrier.pitch ? ahead.y : point.y,
          ahead.z,
        );
      carrier.move(time, u, carrier.last);
      carrier.last = u;
      carrier.group.scale.multiplyScalar(ready);
      carrier.group.visible = ready > 0.01;
      const floor = groundAt(point.x, point.z);
      const lifted = Math.max(0, point.y - floor);
      carrier.shadow.position.set(point.x, floor + 0.015, point.z);
      carrier.shadow.scale.setScalar(
        carrier.size * pop(u) * ready * (1 + lifted * 0.25),
      );
      carrier.shadow.visible = pop(u) * ready > 0.05;
    }
    tend(t, dt);
    // Dolphins.
    if (!still) {
      const local = t - leap.start;
      const [sx, sz, heading] = leap.site;
      pod.forEach((model, k) => {
        const u = (local - k * 0.28) / 1.5;
        model.group.visible = u > 0 && u < 1;
        if (!model.group.visible) return;
        const side = (k - 0.5) * 0.8;
        const along = (u - 0.5) * 3;
        const x = sx + Math.cos(heading) * along - Math.sin(heading) * side;
        const z = sz + Math.sin(heading) * along + Math.cos(heading) * side;
        const y = -0.35 + 4 * 1.25 * u * (1 - u);
        const du = 0.01;
        const nx =
          sx + Math.cos(heading) * (along + du * 3) - Math.sin(heading) * side;
        const nz =
          sz + Math.sin(heading) * (along + du * 3) + Math.cos(heading) * side;
        const ny = -0.35 + 4 * 1.25 * (u + du) * (1 - u - du);
        model.group.position.set(x, y, z);
        model.group.lookAt(nx, ny, nz);
        // Clicked mid-air: a barrel roll.
        const roll = t - (model.group.userData.flip ?? -10);
        if (roll < 0.7) model.group.rotateZ(smooth(roll / 0.7) * Math.PI * 2);
        if (model.group.userData.out === undefined && u > 0.04) {
          model.group.userData.out = true;
          splash(model.group.position, t);
        }
        if (model.group.userData.back === undefined && u > 0.9) {
          model.group.userData.back = true;
          splash(model.group.position, t);
        }
      });
      if (local > 2.2) {
        const near = !leap.near;
        const sites = near ? leapSites.channel : leapSites.open;
        leap = {
          start: t + 5 + Math.random() * 5,
          site: sites[Math.floor(Math.random() * sites.length)],
          near,
        };
        for (const model of pod) {
          delete model.group.userData.out;
          delete model.group.userData.back;
        }
      }
      for (const drop of splashes) {
        const age = t - drop.born;
        drop.sprite.visible = age < 0.9;
        if (!drop.sprite.visible) continue;
        drop.sprite.position.addScaledVector(drop.velocity, 1 / 60);
        drop.velocity.y -= 9 / 60;
        drop.sprite.scale.setScalar(0.18 * (1 - age));
        drop.sprite.material.opacity = 1 - age / 0.9;
      }
    }
    for (const rain of showers) {
      const age = t - rain.start;
      rain.points.visible = age < 3.4 && !still;
      if (!rain.points.visible) continue;
      const where = rain.points.geometry.getAttribute("position");
      const fall = Math.max(0.5, rain.from.y - rain.floor);
      rain.drops.forEach((drop, k) => {
        const life = (age * (7 / fall) + drop.phase) % 1;
        const r = drop.r * rain.reach;
        where.setXYZ(
          k,
          rain.from.x + Math.cos(drop.a) * r,
          rain.from.y - life * fall,
          rain.from.z + Math.sin(drop.a) * r,
        );
      });
      where.needsUpdate = true;
      (rain.points.material as PointsMaterial).opacity =
        0.9 * Math.min(1, age * 4, (3.4 - age) * 2);
    }
    // The party: fireworks over each island in turn.
    const show = [0.15, 0.6, 1.05, 1.5, 2, 2.6, 3.2];
    while (!still && bursts < show.length && t - partyAt >= show[bursts]) {
      const id = islandIds[bursts % islandIds.length];
      const colors = [c.yellow, c.coral, c.green, c.amber];
      burst(
        centerOf(footprint(id)).setY(3.6 + (bursts % 3) * 0.7),
        colors[bursts % colors.length],
        t,
      );
      bursts += 1;
    }
    for (const spark of sparks) {
      const age = t - spark.born;
      spark.sprite.visible = age < 1.4 && !still;
      if (!spark.sprite.visible) continue;
      spark.velocity.y -= 2.6 * dt;
      spark.sprite.position.addScaledVector(spark.velocity, dt);
      spark.sprite.scale.setScalar(0.15 + 0.85 * (1 - age / 1.4));
      spark.sprite.material.opacity = 1 - age / 1.4;
    }
    for (const item of ripples) {
      const age = t - item.born;
      item.mesh.visible = age < 1.6 && !still;
      const grow = age / 1.6;
      item.mesh.scale.setScalar(item.size * (0.3 + grow));
      (item.mesh.material as MeshBasicMaterial).opacity = (1 - grow) * 0.7;
    }
    {
      const where = flyCloud.getAttribute("position");
      const tint = flyCloud.getAttribute("color");
      fireflies.forEach((fly, k) => {
        const a = time * 0.5 + fly.phase;
        where.setXYZ(
          k,
          fly.x + Math.sin(a) * 0.5,
          TOP + 0.5 + Math.sin(a * 1.7) * 0.25,
          fly.z + Math.cos(a * 0.8) * 0.5,
        );
        const glow =
          now.glow * (0.5 + Math.sin(time * 3 + fly.phase * 5) * 0.5);
        tint.setXYZ(k, flyColor.r * glow, flyColor.g * glow, flyColor.b * glow);
      });
      where.needsUpdate = tint.needsUpdate = true;
    }
    {
      const where = sparkCloud.getAttribute("position");
      const tint = sparkCloud.getAttribute("color");
      sparkles.forEach((spark, k) => {
        const twinkle =
          Math.max(0, Math.sin(time * 1.6 + spark.phase * 3)) ** 3;
        where.setXYZ(k, spark.x, 0.08, spark.z);
        const light = (1 - now.glow) * twinkle * 0.9;
        tint.setXYZ(k, light, light, light);
      });
      where.needsUpdate = tint.needsUpdate = true;
    }
    for (const { at, shells } of detail) {
      at.getWorldPosition(probe);
      const near = probe.distanceTo(camera.position) < 11;
      for (const shell of shells) shell.visible = near;
    }
    if (shadowsDirty) {
      renderer.shadowMap.needsUpdate = true;
      shadowsDirty = false;
    }
    renderer.render(scene, camera);
    placeLabels();
  }

  // Phones that cannot keep up draw fewer pixels instead of dropping frames.
  const pace = { last: 0, sum: 0, count: 0 };
  function loop() {
    raf = 0;
    if (!running || document.hidden) return;
    const start = performance.now();
    if (pace.last && start - pace.last < 250) {
      pace.sum += start - pace.last;
      if (++pace.count === 90) {
        if (pace.sum / pace.count > 24 && pixelRatio > 1) {
          pixelRatio = Math.max(1, pixelRatio * 0.7);
          renderer.setPixelRatio(pixelRatio);
          renderer.setSize(width, height, false);
        }
        pace.sum = 0;
        pace.count = 0;
      }
    }
    pace.last = start;
    draw();
    raf = requestAnimationFrame(loop);
  }
  function wake() {
    if (still) {
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          draw();
        });
      return;
    }
    if (running && !raf && !document.hidden) raf = requestAnimationFrame(loop);
  }
  function sleep() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function layout() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    resolution.value.set(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    frame();
    current = focused
      ? (focusPoses.get(focused) ?? overview)
      : still
        ? overview
        : current;
    shadowsDirty = true;
    draw();
  }

  const resizer = new ResizeObserver(() => layout());
  resizer.observe(canvas);
  const onVisibility = () => (document.hidden ? sleep() : wake());
  document.addEventListener("visibilitychange", onVisibility);
  applyLight(now);
  layout();
  current = still ? overview : opening;
  flight = { from: current, start: -10 };

  // Development only: where things are on the page, for scripted checks
  // (an animal by id, "dolphin", "cloud", or a landmark like "i0").
  if (import.meta.env.DEV)
    Object.assign(window, {
      __islands: {
        find(name: string, nth = 0) {
          const [kind, id] = [name.replace(/\d+$/, ""), name];
          const target =
            critters.filter((item) => item.id === id)[nth]?.group ??
            (kind === "dolphin"
              ? pod.find((model) => model.group.visible)?.group
              : kind === "cloud"
                ? clouds[nth]?.cloud
                : proxies.find(
                    (proxy) =>
                      landmarkId(landmarks[proxy.userData.landmark]) === id,
                  ));
          if (!target) return null;
          target.getWorldPosition(probe);
          if (target.userData.landmark !== undefined)
            probe.y += target.scale.y * 0.4;
          else if (target.userData.critter) {
            const box = new Box3();
            for (const mesh of shown(target)) box.expandByObject(mesh);
            box.getCenter(probe);
          }
          probe.project(camera);
          const rect = canvas.getBoundingClientRect();
          return {
            x: rect.left + (probe.x * 0.5 + 0.5) * rect.width,
            y: rect.top + (-probe.y * 0.5 + 0.5) * rect.height,
          };
        },
        draws: () => renderer.info.render.calls,
      },
    });

  return {
    run(on) {
      running = on;
      if (on && introStart === Infinity) introStart = clock();
      if (on) wake();
      else sleep();
    },
    focus(id) {
      if (id === focused) return;
      if (revealStart > clock()) revealStart = clock() - REVEAL;
      takeOff();
      focused = id;
      looked = null;
      bouncing = null;
      setHover(null);
      wake();
    },
    light(next) {
      if (lit && next === daypart && fade.start < 0) return;
      daypart = next;
      // The first light is set at once; later changes fade over a second.
      fade = {
        from: clonePalette(lit ? now : looks[next]),
        to: looks[next],
        start: clock(),
      };
      lit = true;
      wake();
    },
    spot(index) {
      const mine = landmarks.filter((item) => item.island === focused);
      const model = index === null ? undefined : mine[index]?.model;
      if (bouncing && bouncing.model !== model)
        bouncing.model.group.scale.setScalar(1);
      bouncing = model ? { model, start: clock() } : null;
      wake();
    },
    look(index) {
      if (index === looked) return;
      takeOff();
      looked = index;
      wake();
    },
    poke() {
      if (!focused || looked === null) return;
      const item = landmarks.filter((entry) => entry.island === focused)[
        looked
      ];
      if (!item) return;
      // Where animals live at the landmark, every other press is for one of
      // them, in turn.
      const turn = (presses.get(item) ?? 0) + 1;
      presses.set(item, turn);
      const pets = critters.filter(
        (critter) =>
          critter.motion.mode === "home" &&
          item.model.pets?.some((one) => one.group === critter.group),
      );
      if (pets.length && turn % 2 === 0)
        pokeCritter(pets[(turn / 2 - 1) % pets.length], clock());
      else pokeLandmark(item, clock());
    },
    party() {
      const t = clock();
      partyAt = t;
      bursts = 0;
      for (const item of landmarks) {
        if (!still) item.model.poke?.(t);
        if (item.model.rain)
          shower(item.model.rain.getWorldPosition(new Vector3()), t, false);
      }
      critters.forEach((critter, k) => {
        critter.boing = t + k * 0.12;
      });
      wake();
    },
    straighten() {
      takeOff();
      wake();
    },
    destroy() {
      sleep();
      resizer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("webglcontextlost", onLost);
      scene.traverse((object) => {
        const mesh = object as Mesh;
        mesh.geometry?.dispose();
        const materials = Array.isArray(mesh.material)
          ? mesh.material
          : mesh.material
            ? [mesh.material]
            : [];
        for (const material of materials) material.dispose();
      });
      const owned: Texture[] = [
        ramp,
        shore,
        ...Object.values(art).map((item) => item.texture),
      ];
      for (const texture of owned) texture.dispose();
      renderer.dispose();
    },
  };
}
