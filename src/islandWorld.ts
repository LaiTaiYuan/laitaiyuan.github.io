import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
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
  PerspectiveCamera,
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
  TextureLoader,
  TorusGeometry,
  UniformsLib,
  UniformsUtils,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
} from "three";
import type { Material, Object3D, Texture } from "three";
import {
  mergeGeometries,
  mergeVertices,
} from "three/addons/utils/BufferGeometryUtils.js";
import { brandLogo } from "./data/brandMark";
import { islands, youIsland } from "./data/islands";
import type { IslandId } from "./data/islands";
import type { Daypart } from "./motion";

// 「LAI 群島」 in WebGL (three.js, loaded only when the section comes near).
// The three letter islands are the brand mark extruded out of a halftone sea,
// with a small blank island under the A for the visitor. Comic look: toon
// shading in three steps and an ink outline around every solid (an inverted
// hull pushed out a fixed number of pixels). The islands rise out of the sea
// when the section first shows, then the camera climbs from sea level to the
// bird's-eye view, so the name only reads once you are above it; picking an
// island flies the camera there. Animals
// keep the 聽 → 寫 → 創 loop running: magpies bring stories in from the
// visitor's island, lion cubs carry them across the API bridges (growing as
// they pass the AI star), and turtles bring the finished work back.
// Decoration only: every word and link lives in the HTML around the canvas.

const S = 0.1; // world units per logo unit
const ORIGIN = [111, 100] as const; // logo point at the world origin
const DEPTH = 0.7;
const BEVEL = 0.16;
const BEVEL_SIZE = 0.22;
const LIFT = -0.35;
const TOP = DEPTH + BEVEL + LIFT; // height of the island tops
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
  ) as Record<keyof typeof hex, Color>;
  return { hex, color };
}
type Tokens = ReturnType<typeof readTokens>;
const mix = (a: Color, b: Color, t: number) => a.clone().lerp(b, t);

type Palette = {
  sky: Color;
  sea: Color;
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

function palettes({ color: c }: Tokens): Record<Daypart, Palette> {
  return {
    morning: {
      sky: mix(c.yellowLight, c.sky, 0.45),
      sea: mix(c.blue, c.sky, 0.28),
      dot: mix(c.sky, c.white, 0.35),
      foam: c.white.clone(),
      sun: mix(c.yellowLight, c.white, 0.3),
      sunAt: new Vector3(14, 10, 8),
      sunPower: 2.7,
      fill: c.sky.clone(),
      under: c.yellowLight.clone(),
      fillPower: 1.5,
      glow: 0.12,
    },
    day: {
      sky: mix(c.sky, c.white, 0.4),
      sea: c.blue.clone(),
      dot: mix(c.sky, c.blue, 0.25),
      foam: c.white.clone(),
      sun: c.white.clone(),
      sunAt: new Vector3(5, 16, 10),
      sunPower: 2.9,
      fill: c.white.clone(),
      under: c.yellowLight.clone(),
      fillPower: 1.6,
      glow: 0,
    },
    evening: {
      sky: mix(c.coral, c.yellow, 0.4),
      sea: mix(c.blue, c.ink, 0.22),
      dot: mix(c.coral, c.blue, 0.45),
      foam: mix(c.yellowLight, c.coral, 0.15),
      sun: mix(c.yellowLight, c.coral, 0.32),
      sunAt: new Vector3(-15, 8, 6),
      sunPower: 2.7,
      fill: mix(c.yellowLight, c.coral, 0.2),
      under: mix(c.blue, c.coral, 0.3),
      fillPower: 1.35,
      glow: 0.65,
    },
    night: {
      sky: mix(c.ink, c.blue, 0.32),
      sea: mix(c.blue, c.ink, 0.62),
      dot: mix(c.blue, c.sky, 0.2),
      foam: mix(c.sky, c.blue, 0.35),
      sun: mix(c.sky, c.white, 0.62),
      sunAt: new Vector3(-6, 14, -2),
      sunPower: 1.6,
      fill: mix(c.blue, c.sky, 0.55),
      under: mix(c.ink, c.blue, 0.4),
      fillPower: 1.25,
      glow: 1,
    },
  };
}

function blend(from: Palette, to: Palette, t: number, out: Palette) {
  for (const key of [
    "sky",
    "sea",
    "dot",
    "foam",
    "sun",
    "fill",
    "under",
  ] as const)
    out[key].copy(from[key]).lerp(to[key], t);
  out.sunAt.copy(from.sunAt).lerp(to.sunAt, t);
  out.sunPower = from.sunPower + (to.sunPower - from.sunPower) * t;
  out.fillPower = from.fillPower + (to.fillPower - from.fillPower) * t;
  out.glow = from.glow + (to.glow - from.glow) * t;
}

const clonePalette = (p: Palette): Palette => ({
  ...p,
  sky: p.sky.clone(),
  sea: p.sea.clone(),
  dot: p.dot.clone(),
  foam: p.foam.clone(),
  sun: p.sun.clone(),
  sunAt: p.sunAt.clone(),
  fill: p.fill.clone(),
  under: p.under.clone(),
});

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
  return { texture, canvas, repaint: () => g && paint(g) };
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

function icons({ hex }: Tokens) {
  const ink = hex.ink;
  // 聽: a speech bubble with "…"
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
  // A note for the songs on the last-mile road
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
  // A soft round glow for lights at night
  const glow = drawn(64, 64, (g) => {
    const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.35, "rgba(255,255,255,0.45)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gradient;
    g.fillRect(0, 0, 64, 64);
  });
  // Route dots
  const dot = drawn(32, 32, (g) => {
    g.fillStyle = "#fff";
    g.beginPath();
    g.arc(16, 16, 13, 0, Math.PI * 2);
    g.fill();
  });
  return { bubble, code, note, glow, dot };
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
  g.lineWidth = BEVEL_SIZE * 2 * scale;
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
  g.arc(ux, uy, (youIsland.radius * S + BEVEL_SIZE) * scale, 0, Math.PI * 2);
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
// Materials
// ---------------------------------------------------------------------------

function toonRamp() {
  const ramp = new DataTexture(
    new Uint8Array([105, 185, 255]),
    3,
    1,
    RedFormat,
  );
  ramp.minFilter = NearestFilter;
  ramp.magFilter = NearestFilter;
  ramp.generateMipmaps = false;
  ramp.needsUpdate = true;
  return ramp;
}

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

// Halftone water: a dot screen that swells with slow waves, white foam that
// rings the coasts and rolls outwards, and the far sea fading into the sky.
const seaFragment = /* glsl */ `
  uniform vec3 uSea;
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
    vec2 g = mat2(0.7071, -0.7071, 0.7071, 0.7071) * p * 2.4;
    vec2 cell = fract(g) - 0.5;
    float swell = sin(p.x * 0.42 + uTime * 0.7) * sin(p.y * 0.36 - uTime * 0.5);
    float radius = 0.16 + 0.13 * swell + 0.08 * (1.0 - d);
    float halftone = 1.0 - smoothstep(radius - 0.05, radius + 0.05, length(cell));
    vec3 color = mix(uSea, uDot, halftone * 0.7);
    float rings = fract(d * 5.5 - uTime * 0.22);
    float foam = (1.0 - smoothstep(0.0, 0.07, rings)) * (1.0 - smoothstep(0.08, 0.55, d));
    float coast = 1.0 - smoothstep(0.035, 0.06, d);
    color = mix(color, uFoam, max(foam * 0.85, coast));
    float far = smoothstep(uFog.x, uFog.y, distance(vWorld, cameraPosition));
    gl_FragColor = vec4(mix(color, uSky, far), 1.0);
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
  destroy(): void;
};

export type IslandEvents = {
  pick(id: IslandId | null): void;
  // The camera has risen high enough for the name to read.
  reveal(): void;
  lost(): void;
};

type Pose = { target: Vector3; yaw: number; pitch: number; distance: number };

type Landmark = { group: Group; height: number; tick?(t: number): void };

type Carrier = {
  group: Group;
  curve: CatmullRomCurve3;
  period: number;
  offset: number;
  move(t: number, u: number, previous: number): void;
  last: number;
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

  const tokens = readTokens(stage);
  const c = tokens.color;
  const looks = palettes(tokens);
  let daypart: Daypart = "day";
  const now = clonePalette(looks.day);
  let fade = { from: clonePalette(looks.day), to: looks.day, start: -1 };

  const scene = new Scene();
  scene.fog = new Fog(now.sky, 46, 120);
  const camera = new PerspectiveCamera(FOV, 1, 0.5, 260);
  const hemisphere = new HemisphereLight(now.fill, now.under, now.fillPower);
  const sun = new DirectionalLight(now.sun, now.sunPower);
  scene.add(hemisphere, sun, sun.target);

  const ramp = toonRamp();
  const art = icons(tokens);
  const resolution = { value: new Vector2(1, 1) };
  const toons = new Map<string, MeshToonMaterial>();
  const toon = (color: Color) => {
    const key = color.getHexString();
    let material = toons.get(key);
    if (!material) {
      material = new MeshToonMaterial({ color, gradientMap: ramp });
      toons.set(key, material);
    }
    return material;
  };
  const outline = (thickness: number, color = c.ink) =>
    new ShaderMaterial({
      uniforms: {
        ...UniformsUtils.clone(UniformsLib.fog),
        uColor: { value: color.clone() },
        uThickness: { value: thickness },
        uResolution: resolution,
      },
      vertexShader: outlineVertex,
      fragmentShader: outlineFragment,
      side: BackSide,
      fog: true,
    });
  const ink = { bold: outline(2.4), thin: outline(1.6) };

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
  // A toon solid with its ink outline.
  const solid = (
    geometry: BufferGeometry,
    material: Material | Material[],
    line: ShaderMaterial | null = ink.thin,
  ) => {
    const mesh = new Mesh(geometry, material);
    if (line) mesh.add(new Mesh(hull(geometry), line));
    return mesh;
  };
  const put = <T extends Object3D>(
    parent: Object3D,
    object: T,
    x: number,
    y: number,
    z: number,
  ) => {
    object.position.set(x, y, z);
    parent.add(object);
    return object;
  };

  // Things that light up at night: windows, screens, lamps, the star.
  const lamps: { material: MeshBasicMaterial; day: Color; night: Color }[] = [];
  const lamp = (day: Color, night: Color) => {
    const material = new MeshBasicMaterial({ color: day.clone() });
    lamps.push({ material, day, night });
    return material;
  };
  const halos: { sprite: Sprite; day: number; night: number }[] = [];
  const halo = (color: Color, size: number, day = 0, night = 0.85) => {
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
  };

  // --- Sea --------------------------------------------------------------
  const shore = shoreTexture();
  const seaMaterial = new ShaderMaterial({
    uniforms: {
      uSea: { value: now.sea },
      uDot: { value: now.dot },
      uFoam: { value: now.foam },
      uSky: { value: now.sky },
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
  const sea = new Mesh(new PlaneGeometry(260, 260), seaMaterial);
  sea.rotation.x = -Math.PI / 2;
  scene.add(sea);

  // --- Islands ----------------------------------------------------------
  const shapeOf = (points: readonly Point[]) =>
    new Shape(points.map(([x, y]) => new Vector2(wx(x), -wz(y))));
  const land = (shape: Shape) => {
    const geometry = new ExtrudeGeometry(shape, {
      depth: DEPTH,
      bevelEnabled: true,
      bevelThickness: BEVEL,
      bevelSize: BEVEL_SIZE,
      bevelSegments: 3,
      curveSegments: 40,
    });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, LIFT, 0);
    return geometry;
  };
  const sand = toon(mix(c.yellowLight, c.yellow, 0.18));
  const deepGrass = mix(c.green, c.ink, 0.2);
  // The A keeps the logo's two tones: one green on the left half, a lighter
  // one on the right, split down the apex.
  const twoTone = () => {
    const material = new MeshToonMaterial({
      color: c.green,
      gradientMap: ramp,
    });
    const right = mix(c.green, c.paper, 0.42);
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
  const islandLines = new Map<IslandId, ShaderMaterial>();
  const pickables: Mesh[] = [];
  const addIsland = (id: IslandId, shape: Shape, top: Material) => {
    const root = new Group();
    const geometry = land(shape);
    const line = outline(2.6);
    const mesh = solid(geometry, [top, sand], line);
    mesh.userData.island = id;
    pickables.push(mesh);
    root.add(mesh);
    scene.add(root);
    islandRoots.set(id, root);
    islandLines.set(id, line);
    return root;
  };
  addIsland("l", shapeOf(outlines.l), toon(deepGrass));
  addIsland("a", shapeOf(outlines.a), twoTone());
  addIsland("i", shapeOf(outlines.i), toon(deepGrass));
  const youShape = new Shape();
  youShape.absarc(
    wx(youIsland.center[0]),
    -wz(youIsland.center[1]),
    youIsland.radius * S,
    0,
    Math.PI * 2,
    false,
  );
  // The visitor's island is a blank page, waiting for its story.
  addIsland("you", youShape, toon(c.paper));

  // --- Landmarks --------------------------------------------------------
  const box = (w: number, h: number, d: number) => new BoxGeometry(w, h, d);
  const cylinder = (top: number, bottom: number, h: number, segments = 20) =>
    new CylinderGeometry(top, bottom, h, segments);
  const ball = (r: number, w = 16, h = 12) => new SphereGeometry(r, w, h);

  function database(): Landmark {
    const group = new Group();
    const disc = cylinder(0.42, 0.42, 0.17, 28);
    [c.paper, c.paper, c.yellow].forEach((color, k) =>
      put(group, solid(disc, toon(color)), 0, 0.09 + k * 0.23, 0),
    );
    return { group, height: 0.62 };
  }

  function javaCafe(): Landmark {
    const group = new Group();
    put(
      group,
      solid(cylinder(0.52, 0.46, 0.06, 28), toon(c.white)),
      0,
      0.03,
      0,
    );
    put(
      group,
      solid(cylinder(0.36, 0.28, 0.52, 28), toon(c.coral)),
      0,
      0.32,
      0,
    );
    put(
      group,
      new Mesh(cylinder(0.32, 0.32, 0.02, 24), toon(mix(c.coral, c.ink, 0.6))),
      0,
      0.575,
      0,
    );
    put(
      group,
      solid(new TorusGeometry(0.15, 0.05, 10, 20), toon(c.coral)),
      0.37,
      0.34,
      0,
    );
    // Steam: Spring Boot is starting, so there is time for coffee.
    const puff = ball(0.09, 10, 8);
    const steam = [0, 1, 2].map((k) =>
      put(group, solid(puff, toon(c.white)), -0.08 + k * 0.08, 0.7, 0),
    );
    return {
      group,
      height: 0.95,
      tick(t) {
        steam.forEach((cloud, k) => {
          const life = (t * 0.45 + k / 3) % 1;
          cloud.position.y = 0.66 + life * 0.75;
          cloud.position.x = -0.08 + k * 0.08 + Math.sin(life * 6 + k) * 0.06;
          cloud.scale.setScalar(Math.sin(life * Math.PI) * 1.1 + 0.001);
        });
      },
    };
  }

  function cloudTower(): Landmark {
    const group = new Group();
    put(group, solid(cylinder(0.13, 0.2, 1.3, 16), toon(c.white)), 0, 0.65, 0);
    put(group, solid(cylinder(0.27, 0.27, 0.07, 18), toon(c.sky)), 0, 1.0, 0);
    const fluff = [
      [0, 1.56, 0, 0.33],
      [-0.31, 1.46, 0.02, 0.23],
      [0.32, 1.47, 0.04, 0.25],
      [0.06, 1.66, -0.12, 0.24],
    ] as const;
    for (const [x, y, z, r] of fluff)
      put(group, solid(ball(r), toon(c.white)), x, y, z);
    const light = put(
      group,
      new Mesh(ball(0.06, 10, 8), lamp(c.coral, c.yellow)),
      0,
      1.93,
      0,
    );
    put(group, halo(c.yellow, 0.7, 0.15, 0.9), 0, 1.93, 0);
    return {
      group,
      height: 2.0,
      tick(t) {
        light.scale.setScalar(Math.sin(t * 3) > 0.3 ? 1.25 : 0.85);
      },
    };
  }

  function stackTower(): Landmark {
    const group = new Group();
    put(group, solid(box(0.92, 0.12, 0.92), toon(c.ink)), 0, 0.06, 0);
    const colors = [c.yellow, c.coral, c.green, c.sky, c.white, c.yellow];
    const tower = put(group, new Group(), 0, 0.12, 0);
    colors.forEach((color, k) => {
      const w = 0.8 - k * 0.045;
      put(
        tower,
        solid(box(w, 0.16, w), toon(color)),
        (k % 2 ? 1 : -1) * 0.035,
        0.08 + k * 0.165,
        ((k % 3) - 1) * 0.02,
      );
    });
    return {
      group,
      height: 1.25,
      tick(t) {
        tower.rotation.z = Math.sin(t * 1.3) * 0.035;
        tower.rotation.x = Math.sin(t * 1.1 + 1) * 0.025;
      },
    };
  }

  // The brand's four-pointed star, flat in the A like the logo, with a
  // smaller one floating above it: the AI core.
  const starShape = (radius: number) => {
    const shape = new Shape();
    shape.moveTo(0, radius);
    shape.quadraticCurveTo(0, 0, radius, 0);
    shape.quadraticCurveTo(0, 0, 0, -radius);
    shape.quadraticCurveTo(0, 0, -radius, 0);
    shape.quadraticCurveTo(0, 0, 0, radius);
    return shape;
  };
  let starPulse = -10;
  function aiStar(): Landmark {
    const group = new Group();
    const amber = new MeshToonMaterial({
      color: c.amber,
      gradientMap: ramp,
      emissive: c.amber,
      emissiveIntensity: 0.35,
    });
    const inlay = new ExtrudeGeometry(starShape(starRadius * S), {
      depth: 0.05,
      bevelEnabled: false,
      curveSegments: 16,
    });
    inlay.rotateX(-Math.PI / 2);
    put(group, solid(inlay, amber, ink.bold), 0, 0.005, 0);
    const charm = new ExtrudeGeometry(starShape(0.5), {
      depth: 0.12,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 2,
      curveSegments: 14,
    });
    charm.translate(0, 0, -0.06);
    charm.rotateX(-0.75);
    const floating = put(group, solid(charm, amber, ink.bold), 0, 1.45, 0);
    const glow = put(group, halo(c.amber, 2.2, 0.35, 1), 0, 1.45, 0);
    return {
      group,
      height: 1.7,
      tick(t) {
        const kick = Math.max(0, 1 - (t - starPulse) / 0.9);
        floating.rotation.y = t * 0.8 + kick * 4;
        floating.position.y = 1.45 + Math.sin(t * 1.6) * 0.1 + kick * 0.25;
        floating.scale.setScalar(1 + kick * 0.45);
        glow.scale.setScalar(2.2 + kick * 2.4);
      },
    };
  }

  function familyHome(): Landmark {
    const group = new Group();
    put(group, solid(box(0.64, 0.42, 0.54), toon(c.paper)), 0, 0.21, 0);
    const roofShape = new Shape([
      new Vector2(-0.4, 0),
      new Vector2(0.4, 0),
      new Vector2(0, 0.32),
    ]);
    const roof = new ExtrudeGeometry(roofShape, {
      depth: 0.62,
      bevelEnabled: false,
    });
    roof.translate(0, 0, -0.31);
    put(group, solid(roof, toon(c.coral)), 0, 0.42, 0);
    put(group, solid(box(0.08, 0.2, 0.08), toon(c.coral)), 0.2, 0.62, -0.08);
    put(group, new Mesh(box(0.14, 0.22, 0.02), toon(c.ink)), -0.12, 0.11, 0.28);
    put(
      group,
      new Mesh(box(0.15, 0.13, 0.02), lamp(c.sky, c.yellow)),
      0.15,
      0.25,
      0.28,
    );
    put(group, halo(c.yellow, 0.6), 0.15, 0.25, 0.34);
    return { group, height: 0.82 };
  }

  function careBot(): Landmark {
    const group = new Group();
    put(group, solid(box(0.58, 0.38, 0.5), toon(c.white)), 0, 0.19, 0);
    const head = put(group, new Group(), 0, 0.56, 0);
    put(head, solid(box(0.44, 0.3, 0.34), toon(c.sky)), 0, 0, 0);
    for (const x of [-0.1, 0.1])
      put(head, new Mesh(ball(0.045, 10, 8), toon(c.ink)), x, 0.03, 0.17);
    put(head, new Mesh(box(0.12, 0.025, 0.02), toon(c.ink)), 0, -0.07, 0.172);
    put(
      head,
      solid(cylinder(0.015, 0.015, 0.16, 8), toon(c.ink), null),
      0,
      0.23,
      0,
    );
    const bulb = put(
      head,
      new Mesh(ball(0.05, 10, 8), lamp(c.yellow, c.yellow)),
      0,
      0.33,
      0,
    );
    put(head, halo(c.yellow, 0.5, 0.1, 0.8), 0, 0.33, 0);
    return {
      group,
      height: 1.0,
      tick(t) {
        head.rotation.y = Math.sin(t * 0.9) * 0.35;
        bulb.scale.setScalar(1 + Math.max(0, Math.sin(t * 4)) * 0.3);
      },
    };
  }

  // Three lights for the three steps of an LLM evaluation, lit in turn.
  function testLab(): Landmark {
    const group = new Group();
    put(group, solid(box(0.9, 0.32, 0.46), toon(c.paper)), 0, 0.16, 0);
    const steps = [c.yellow, c.coral, c.green].map((color, k) => {
      const material = new MeshBasicMaterial({
        color: mix(color, c.ink, 0.55),
      });
      put(group, solid(ball(0.1, 12, 10), material), -0.27 + k * 0.27, 0.42, 0);
      return { material, on: color, off: mix(color, c.ink, 0.55) };
    });
    return {
      group,
      height: 0.62,
      tick(t) {
        const step = t === 0 ? 3 : Math.floor(t / 0.8) % 4;
        steps.forEach((light, k) =>
          light.material.color.copy(k < step ? light.on : light.off),
        );
      },
    };
  }

  // The lion at his desk: the homepage's own lion head, as a standee.
  const base = import.meta.env.BASE_URL;
  const lionFace = new TextureLoader().load(
    `${base}images/lion/head.webp`,
    () => wake(),
  );
  lionFace.colorSpace = SRGBColorSpace;
  lionFace.repeat.set(1, 0.84); // crop the stray body pixels under the chin
  lionFace.offset.set(0, 0.16);
  const lionSprite = (size: number) => {
    const sprite = new Sprite(
      new SpriteMaterial({ map: lionFace, transparent: true }),
    );
    sprite.scale.set(size * (303 / (384 * 0.84)), size, 1);
    return sprite;
  };

  function lionDesk(): Landmark {
    const group = new Group();
    const wood = toon(mix(c.coral, c.yellow, 0.45));
    put(group, solid(box(0.96, 0.06, 0.52), wood), 0, 0.42, 0);
    for (const [x, z] of [
      [-0.42, -0.2],
      [0.42, -0.2],
      [-0.42, 0.2],
      [0.42, 0.2],
    ])
      put(group, new Mesh(box(0.05, 0.4, 0.05), toon(c.ink)), x, 0.2, z);
    put(group, solid(box(0.38, 0.025, 0.26), toon(c.muted)), -0.08, 0.46, 0.05);
    const screen = put(
      group,
      solid(box(0.38, 0.25, 0.025), toon(c.muted)),
      -0.08,
      0.59,
      -0.08,
    );
    screen.rotation.x = -0.25;
    put(
      screen,
      new Mesh(
        new PlaneGeometry(0.33, 0.2),
        lamp(c.sky, mix(c.sky, c.white, 0.4)),
      ),
      0,
      0,
      0.014,
    );
    put(
      group,
      new Mesh(cylinder(0.06, 0.08, 0.03, 12), toon(c.ink)),
      0.34,
      0.46,
      -0.1,
    );
    put(
      group,
      new Mesh(cylinder(0.012, 0.012, 0.34, 6), toon(c.ink)),
      0.34,
      0.62,
      -0.1,
    );
    const shade = new ConeGeometry(0.12, 0.12, 14, 1, true);
    put(group, solid(shade, toon(c.yellow)), 0.3, 0.8, -0.06);
    put(
      group,
      new Mesh(ball(0.04, 8, 6), lamp(c.yellowLight, c.yellow)),
      0.3,
      0.75,
      -0.06,
    );
    put(group, halo(c.yellow, 0.9, 0.05, 0.95), 0.3, 0.72, -0.06);
    const lion = put(group, lionSprite(0.78), -0.02, 1.02, -0.3);
    return {
      group,
      height: 1.45,
      tick(t) {
        lion.position.y = 1.02 + Math.abs(Math.sin(t * 2.4)) * 0.04;
        lion.material.rotation = Math.sin(t * 1.2) * 0.06;
      },
    };
  }

  function recordShop(): Landmark {
    const group = new Group();
    put(group, solid(box(1.0, 0.22, 0.8), toon(c.coral)), 0, 0.11, 0);
    const platter = cylinder(0.34, 0.34, 0.05, 40);
    const disc = put(group, new Group(), -0.1, 0.25, 0);
    put(disc, solid(platter, toon(c.ink), ink.bold), 0, 0, 0);
    put(
      disc,
      new Mesh(cylinder(0.12, 0.12, 0.06, 24), toon(c.yellow)),
      0,
      0.005,
      0,
    );
    put(disc, new Mesh(ball(0.03, 8, 6), toon(c.coral)), 0.07, 0.035, 0.02);
    const arm = put(group, new Group(), 0.36, 0.26, -0.26);
    put(arm, new Mesh(cylinder(0.05, 0.05, 0.05, 12), toon(c.white)), 0, 0, 0);
    const rod = put(
      arm,
      new Mesh(box(0.035, 0.03, 0.42), toon(c.white)),
      -0.08,
      0.04,
      0.18,
    );
    rod.rotation.y = 0.45;
    const floaters = [0, 1, 2].map(() => {
      const sprite = new Sprite(
        new SpriteMaterial({
          map: art.note.texture,
          transparent: true,
          depthWrite: false,
        }),
      );
      sprite.scale.setScalar(0.34);
      return put(group, sprite, 0, 0.5, 0);
    });
    return {
      group,
      height: 0.75,
      tick(t) {
        disc.rotation.y = -t * 2.2;
        floaters.forEach((sprite, k) => {
          const life = (t * 0.3 + k / 3) % 1;
          sprite.position.set(
            -0.1 + Math.sin(life * 5 + k * 2) * 0.22,
            0.45 + life * 1.1,
            0,
          );
          sprite.material.opacity =
            t === 0 ? (k ? 0 : 1) : Math.sin(life * Math.PI);
        });
      },
    };
  }

  function toolShop(): Landmark {
    const group = new Group();
    put(group, solid(box(0.82, 0.44, 0.52), toon(c.paper)), 0, 0.22, 0);
    const stripes = new Group();
    for (let k = 0; k < 6; k++)
      put(
        stripes,
        new Mesh(box(0.15, 0.025, 0.3), toon(k % 2 ? c.white : c.coral)),
        -0.375 + k * 0.15,
        0,
        0,
      );
    stripes.rotation.x = 0.45;
    put(group, stripes, 0, 0.42, 0.36);
    put(group, solid(box(0.54, 0.15, 0.04), toon(c.yellow)), 0, 0.6, 0.27);
    put(
      group,
      new Mesh(box(0.3, 0.16, 0.02), lamp(c.sky, c.yellow)),
      0.12,
      0.18,
      0.27,
    );
    put(group, halo(c.yellow, 0.7), 0.12, 0.2, 0.33);
    return { group, height: 0.85 };
  }

  // The last mile: a five-line staff road leaving the I's north tip for the
  // horizon, with written songs drifting along it.
  function staffRoad(): Landmark {
    const group = new Group();
    const length = 36;
    const road = drawn(128, 256, (g) => {
      g.fillStyle = tokens.hex.ink;
      g.fillRect(0, 0, 128, 256);
      g.fillStyle = tokens.hex.paper;
      for (let k = 0; k < 5; k++) g.fillRect(14 + k * 23, 0, 5, 256);
      g.fillRect(10, 120, 108, 7);
    });
    road.texture.wrapT = RepeatWrapping;
    road.texture.repeat.set(1, length / 2.6);
    const strip = new Mesh(
      new PlaneGeometry(1.15, length),
      toon(c.white).clone(),
    );
    (strip.material as MeshToonMaterial).map = road.texture;
    strip.rotation.x = -Math.PI / 2;
    put(group, strip, 0, -TOP + 0.04, -length / 2 - 0.25);
    const songs = Array.from({ length: 7 }, () => {
      const sprite = new Sprite(
        new SpriteMaterial({
          map: art.note.texture,
          transparent: true,
          depthWrite: false,
        }),
      );
      sprite.scale.setScalar(0.42);
      return put(group, sprite, 0, 0, 0);
    });
    return {
      group,
      height: 0.35,
      tick(t) {
        songs.forEach((sprite, k) => {
          const along = ((t * 0.09 + k / songs.length) % 1) * length;
          sprite.position.set(
            Math.sin(along * 0.9 + k) * 0.22,
            -TOP + 0.38 + Math.sin(t * 2 + k) * 0.06,
            -0.5 - along,
          );
          sprite.material.opacity =
            Math.min(1, along / 1.5) * (1 - along / length);
        });
      },
    };
  }

  function storySign(): Landmark {
    const group = new Group();
    put(
      group,
      new Mesh(cylinder(0.035, 0.035, 0.9, 8), toon(c.ink)),
      0,
      0.45,
      0,
    );
    put(group, solid(box(0.98, 0.38, 0.05), toon(c.white)), 0, 0.86, 0);
    const words = drawn(256, 96, (g) => {
      g.fillStyle = tokens.hex.white;
      g.fillRect(0, 0, 256, 96);
      g.fillStyle = tokens.hex.ink;
      g.font = '900 52px "Noto Sans TC", "Microsoft JhengHei", sans-serif';
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("你的故事", 128, 52);
    });
    document.fonts
      ?.load('900 52px "Noto Sans TC"')
      .then(() => {
        words.repaint();
        words.texture.needsUpdate = true;
        wake();
      })
      .catch(() => {});
    put(
      group,
      new Mesh(
        new PlaneGeometry(0.9, 0.34),
        new MeshBasicMaterial({ map: words.texture }),
      ),
      0,
      0.86,
      0.03,
    );
    // Docks on both sides, where the magpies take off and the turtles land.
    for (const side of [-1, 1])
      put(
        group,
        solid(box(0.6, 0.05, 0.26), toon(mix(c.coral, c.yellow, 0.45))),
        side * 1.45,
        -0.38,
        0.1,
      );
    const host = put(group, lionSprite(0.55), 0.62, 0.42, 0.2);
    return {
      group,
      height: 1.15,
      tick(t) {
        host.material.rotation = Math.sin(t * 5) * 0.18;
      },
    };
  }

  const builders: Record<IslandId, (() => Landmark)[]> = {
    l: [database, javaCafe, cloudTower, stackTower],
    a: [aiStar, familyHome, careBot, testLab],
    i: [lionDesk, recordShop, toolShop, staffRoad],
    you: [storySign],
  };
  const landmarks: { island: IslandId; mark: Landmark; at: Vector3 }[] = [];
  for (const island of islands) {
    const root = islandRoots.get(island.id);
    if (!root) continue;
    island.spots.forEach((spot, index) => {
      const build = builders[island.id][index];
      if (!build) return;
      const mark = build();
      const at = ground(spot.at[0], spot.at[1]);
      mark.group.position.copy(at);
      root.add(mark.group);
      landmarks.push({ island: island.id, mark, at });
    });
  }

  // --- Bridges (REST API between the islands) --------------------------
  const bridge = (from: Point, to: Point, rise: number) => {
    const a = ground(from[0], from[1], TOP + 0.02);
    const b = ground(to[0], to[1], TOP + 0.02);
    const count = Math.max(4, Math.round(a.distanceTo(b) / 0.19));
    const planks: BufferGeometry[] = [];
    for (let k = 0; k <= count; k++) {
      const u = k / count;
      const plank = box(0.17, 0.05, 0.5);
      plank.rotateZ(Math.cos(u * Math.PI) * rise * 1.6 * (b.x > a.x ? 1 : -1));
      const p = a.clone().lerp(b, u);
      plank.translate(p.x, p.y + Math.sin(u * Math.PI) * rise, p.z);
      planks.push(plank);
    }
    const deck = mergeGeometries(planks);
    if (deck) scene.add(solid(deck, toon(mix(c.coral, c.yellow, 0.45))));
  };
  bridge([71, 152], [84, 152], 0.2);
  bridge([155, 152], [176, 152], 0.38);

  // --- Trees ------------------------------------------------------------
  const keepClear: Point[] = [
    ...islands.flatMap((island) => island.spots.map((spot) => spot.at)),
  ];
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
  const treeSpots: { x: number; z: number; kind: number; scale: number }[] = [];
  const roll = random(20261024);
  for (const [id, points] of Object.entries(outlines) as [
    "l" | "a" | "i",
    Point[],
  ][]) {
    for (let y = 30; y <= 170; y += 7)
      for (let x = 14; x <= 210; x += 7) {
        const jx = x + (roll() - 0.5) * 5;
        const jy = y + (roll() - 0.5) * 5;
        if (!inside(points, jx, jy) || edgeDistance(points, jx, jy) < 3.2)
          continue;
        if (
          keepClear.some(
            ([sx, sy]) =>
              Math.hypot(sx - jx, sy - jy) < (id === "a" ? 13 : 10.5),
          )
        )
          continue;
        if (lionPath.some(([px, py]) => Math.hypot(px - jx, py - jy) < 4.5))
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
        if (roll() > 0.42) continue;
        treeSpots.push({
          x: wx(jx),
          z: wz(jy),
          kind: roll() < 0.55 ? 0 : 1,
          scale: 0.75 + roll() * 0.5,
        });
      }
  }
  const crown = ball(0.21, 12, 10);
  const pine = new ConeGeometry(0.19, 0.5, 9);
  const trunk = cylinder(0.035, 0.045, 0.22, 6);
  const leaf = [
    toon(mix(c.green, c.ink, 0.32)),
    toon(mix(c.green, c.yellow, 0.25)),
  ];
  const forest = (
    geometry: BufferGeometry,
    material: Material,
    list: typeof treeSpots,
    lift: number,
  ) => {
    const body = new InstancedMesh(geometry, material, list.length);
    const shell = new InstancedMesh(hull(geometry), ink.thin, list.length);
    const matrix = new Matrix4();
    list.forEach((tree, k) => {
      matrix.compose(
        new Vector3(tree.x, TOP + lift * tree.scale, tree.z),
        new Quaternion(),
        new Vector3(tree.scale, tree.scale, tree.scale),
      );
      body.setMatrixAt(k, matrix);
      shell.setMatrixAt(k, matrix);
    });
    scene.add(body, shell);
  };
  const rounds = treeSpots.filter((tree) => tree.kind === 0);
  const pines = treeSpots.filter((tree) => tree.kind === 1);
  forest(crown, leaf[1], rounds, 0.36);
  forest(pine, leaf[0], pines, 0.33);
  forest(trunk, toon(mix(c.coral, c.ink, 0.45)), treeSpots, 0.11);

  // --- Clouds on the horizon, for the low shot; out of frame from above --
  const puff = ball(1, 14, 10);
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
      ] as const
    ).map(([dx, dy, dz, r]) =>
      puff
        .clone()
        .scale(r * size, r * 0.78 * size, r * size)
        .translate(dx * size, dy * size, dz * size),
    );
    const cloud = put(
      scene,
      solid(mergeGeometries(lumps) ?? puff, toon(c.white), ink.bold),
      x,
      y,
      z,
    );
    return { cloud, x, phase: k * 1.7 };
  });

  // --- Animals on the three routes --------------------------------------
  const sprite = (map: Texture, size: number) => {
    const icon = new Sprite(
      new SpriteMaterial({ map, transparent: true, depthWrite: false }),
    );
    icon.scale.setScalar(size);
    return icon;
  };
  const curveOf = (points: [number, number, number?][], y: number) =>
    new CatmullRomCurve3(
      points.map(([lx, ly, h]) => ground(lx, ly, h ?? y)),
      false,
      "centripetal",
    );
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
        size: 0.13,
        map: art.dot.texture,
        transparent: true,
        depthWrite: false,
        opacity: 0.85,
      }),
    );
    scene.add(dots);
  };
  const carriers: Carrier[] = [];
  const pop = (u: number) =>
    smooth(clamp(u / 0.06, 0, 1)) * smooth(clamp((1 - u) / 0.06, 0, 1));

  // 聽: Taiwan blue magpies, long tail and red beak, carrying a story.
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
  routeDots(magpiePath, c.yellow, 0.32);
  const magpie = () => {
    const group = new Group();
    const body = new Group();
    group.add(body);
    const blue = toon(c.blue);
    const torso = ball(0.11, 14, 10);
    const bird = put(body, solid(torso, blue), 0, 0, 0);
    bird.scale.set(0.85, 0.8, 1.45);
    put(body, solid(ball(0.075, 12, 10), toon(c.ink)), 0, 0.05, 0.15);
    const beak = new ConeGeometry(0.028, 0.09, 8);
    beak.rotateX(Math.PI / 2);
    put(body, new Mesh(beak, toon(c.coral)), 0, 0.04, 0.24);
    put(body, solid(box(0.055, 0.016, 0.44), blue), 0, -0.01, -0.33);
    put(body, solid(box(0.065, 0.018, 0.08), toon(c.white)), 0, -0.01, -0.56);
    const wings = [-1, 1].map((side) => {
      const pivot = put(body, new Group(), side * 0.07, 0.03, 0);
      put(pivot, solid(box(0.28, 0.016, 0.15), blue), side * 0.14, 0, 0);
      return { pivot, side };
    });
    const cargo = put(group, sprite(art.bubble.texture, 0.48), 0, 0.3, 0.12);
    return { group, body, wings, cargo };
  };
  for (const offset of [0, 0.5]) {
    const bird = magpie();
    scene.add(bird.group);
    carriers.push({
      group: bird.group,
      curve: magpiePath,
      period: 7.5,
      offset,
      last: 0,
      move(t, u) {
        const size = pop(u);
        bird.group.scale.setScalar(size * 1.35);
        for (const { pivot, side } of bird.wings)
          pivot.rotation.z = side * Math.sin(t * 16 + offset * 9) * 0.7;
        bird.body.rotation.z = Math.sin(t * 2 + offset * 5) * 0.12;
        bird.cargo.position.y = 0.3 + Math.sin(t * 8) * 0.02;
      },
    });
  }

  // 寫: lion cubs carrying code across the islands; the AI star makes the
  // load bigger as they pass it.
  const walkPath = curveOf(lionPath, TOP);
  routeDots(walkPath, c.coral, 0.3);
  let starAt = 0;
  {
    let best = Infinity;
    const star = ground(brandLogo.starCenter[0], brandLogo.starCenter[1]);
    for (let k = 0; k <= 400; k++) {
      const d = walkPath.getPointAt(k / 400).distanceTo(star);
      if (d < best) {
        best = d;
        starAt = k / 400;
      }
    }
  }
  const lionCub = () => {
    const group = new Group();
    const body = put(group, new Group(), 0, 0, 0);
    const fur = toon(c.yellow);
    const torso = put(body, solid(ball(0.13, 14, 10), fur), 0, 0.17, -0.02);
    torso.scale.set(1, 0.85, 1.25);
    put(
      body,
      solid(new TorusGeometry(0.12, 0.06, 8, 18), toon(c.coral)),
      0,
      0.33,
      0.1,
    );
    put(body, solid(ball(0.115, 14, 10), fur), 0, 0.33, 0.13);
    for (const x of [-0.085, 0.085])
      put(body, solid(ball(0.04, 8, 6), fur), x, 0.44, 0.1);
    for (const x of [-0.042, 0.042])
      put(body, new Mesh(ball(0.017, 6, 5), toon(c.ink)), x, 0.35, 0.235);
    put(body, new Mesh(ball(0.02, 6, 5), toon(c.ink)), 0, 0.315, 0.245);
    const legs = [
      [-0.07, 0.08],
      [0.07, 0.08],
      [-0.07, -0.1],
      [0.07, -0.1],
    ].map(([x, z]) => {
      const pivot = put(body, new Group(), x, 0.12, z);
      put(pivot, new Mesh(cylinder(0.03, 0.03, 0.12, 6), fur), 0, -0.06, 0);
      return pivot;
    });
    const tail = put(body, new Group(), 0, 0.2, -0.17);
    put(
      tail,
      new Mesh(cylinder(0.012, 0.012, 0.18, 5), fur),
      0,
      0.06,
      -0.04,
    ).rotation.x = -0.7;
    put(tail, new Mesh(ball(0.035, 8, 6), toon(c.coral)), 0, 0.12, -0.1);
    const cargo = put(group, sprite(art.code.texture, 0.42), 0, 0.68, 0);
    return { group, body, legs, tail, cargo };
  };
  for (const offset of [0, 0.5]) {
    const cub = lionCub();
    scene.add(cub.group);
    carriers.push({
      group: cub.group,
      curve: walkPath,
      period: 15,
      offset,
      last: 0,
      move(t, u, previous) {
        cub.group.scale.setScalar(pop(u) * 1.25);
        const step = t * 11 + offset * 7;
        cub.body.position.y = Math.abs(Math.sin(step)) * 0.035;
        cub.legs.forEach(
          (leg, k) =>
            (leg.rotation.x = Math.sin(step + (k % 2 ? Math.PI : 0)) * 0.6),
        );
        cub.tail.rotation.z = Math.sin(t * 5) * 0.4;
        if (previous < starAt && u >= starAt) starPulse = t;
        const grown = smooth(clamp((u - starAt) / 0.04, 0, 1));
        cub.cargo.scale.setScalar(0.42 * (1 + grown * 0.55));
        cub.cargo.position.y = 0.68 + grown * 0.14;
      },
    });
  }

  // 創: sea turtles bringing the finished work home to the visitor's island.
  const turtlePath = curveOf(
    [
      [13, 112],
      [10, 140],
      [14, 168],
      [30, 186],
      [56, 197],
      [78, 202],
      [97, 201.5],
    ],
    0.02,
  );
  routeDots(turtlePath, c.green, 0.34);
  const turtle = () => {
    const group = new Group();
    const body = put(group, new Group(), 0, 0, 0);
    const shell = put(
      body,
      solid(ball(0.24, 16, 10), toon(mix(c.green, c.ink, 0.25))),
      0,
      0.02,
      0,
    );
    shell.scale.set(1, 0.42, 1.25);
    put(
      body,
      solid(ball(0.085, 12, 8), toon(mix(c.green, c.paper, 0.45))),
      0,
      0.05,
      0.32,
    );
    for (const x of [-0.04, 0.04])
      put(body, new Mesh(ball(0.016, 6, 5), toon(c.ink)), x, 0.09, 0.39);
    const flippers = [
      [-0.21, 0.13, 1],
      [0.21, 0.13, -1],
      [-0.17, -0.2, -1],
      [0.17, -0.2, 1],
    ].map(([x, z, phase]) => {
      const pivot = put(body, new Group(), x, 0, z);
      const fin = put(
        pivot,
        solid(ball(0.08, 10, 6), toon(mix(c.green, c.paper, 0.45))),
        x * 0.4,
        0,
        0,
      );
      fin.scale.set(1.6, 0.28, 0.7);
      return { pivot, phase };
    });
    // The work it carries: a green gift with a yellow ribbon.
    const gift = put(body, new Group(), 0, 0.2, -0.02);
    put(gift, solid(box(0.2, 0.17, 0.2), toon(c.green)), 0, 0, 0);
    put(gift, new Mesh(box(0.05, 0.175, 0.205), toon(c.yellow)), 0, 0, 0);
    put(gift, new Mesh(box(0.205, 0.175, 0.05), toon(c.yellow)), 0, 0, 0);
    put(
      gift,
      solid(new TorusGeometry(0.035, 0.016, 6, 12), toon(c.yellow)),
      -0.03,
      0.11,
      0,
    );
    put(
      gift,
      solid(new TorusGeometry(0.035, 0.016, 6, 12), toon(c.yellow)),
      0.03,
      0.11,
      0,
    );
    return { group, body, flippers };
  };
  for (const offset of [0, 0.5]) {
    const swimmer = turtle();
    scene.add(swimmer.group);
    carriers.push({
      group: swimmer.group,
      curve: turtlePath,
      period: 17,
      offset,
      last: 0,
      move(t, u) {
        swimmer.group.scale.setScalar(pop(u) * 1.35);
        swimmer.body.position.y = Math.sin(t * 2.2 + offset * 4) * 0.025;
        swimmer.body.rotation.z = Math.sin(t * 1.4 + offset * 3) * 0.06;
        for (const { pivot, phase } of swimmer.flippers)
          pivot.rotation.y = Math.sin(t * 3.2 + offset * 5) * 0.5 * phase;
      },
    });
  }

  // --- Camera -----------------------------------------------------------
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
      ...heights.map((item) => item.at.clone().setY(TOP + item.mark.height)),
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
  let opening = pose(new Vector3(0, 0.8, -1), -0.42, 0.12);
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

  // --- Labels and pins (HTML over the canvas) ---------------------------
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
        ? item.at.clone().setY(TOP + item.mark.height + 0.3)
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

  // --- State --------------------------------------------------------------
  let focused: IslandId | null = null;
  let hovered: IslandId | null = null;
  let flight = { from: overview, start: -10 };
  let current = overview;
  let revealed = false;
  let rise = still ? 1 : 0;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let bouncing: { mark: Landmark; start: number } | null = null;
  // The islands stay under water until the section is first on screen.
  let introStart = still ? -10 : Infinity;
  let lit = false;
  const clock = () => performance.now() / 1000;

  // The climb starts once most of the stage is on screen (and the islands
  // are up), so the low shot and the swoop are seen whole.
  let revealStart = still ? -10 : Infinity;
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

  const applyLight = (p: Palette) => {
    renderer.setClearColor(p.sky);
    (scene.fog as Fog).color.copy(p.sky);
    hemisphere.color.copy(p.fill);
    hemisphere.groundColor.copy(p.under);
    hemisphere.intensity = p.fillPower;
    sun.color.copy(p.sun);
    sun.intensity = p.sunPower;
    sun.position.copy(p.sunAt);
    for (const item of lamps)
      item.material.color.copy(item.day).lerp(item.night, p.glow);
    for (const item of halos)
      item.sprite.material.opacity =
        item.day + (item.night - item.day) * p.glow;
  };

  const raycaster = new Raycaster();
  const pick = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    raycaster.setFromCamera(
      new Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    );
    const hit = raycaster.intersectObjects(pickables, false)[0];
    return (hit?.object.userData.island as IslandId | undefined) ?? null;
  };
  const setHover = (id: IslandId | null) => {
    if (id === hovered) return;
    hovered = id;
    for (const [key, line] of islandLines) {
      line.uniforms.uColor.value.copy(key === id ? c.yellow : c.ink);
      line.uniforms.uThickness.value = key === id ? 4 : 2.6;
    }
    canvas.style.cursor = id ? "pointer" : "";
    if (id) stage.dataset.hover = id;
    else delete stage.dataset.hover;
    wake();
  };

  let downAt: { x: number; y: number; time: number } | null = null;
  const onPointerMove = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointer.tx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.ty = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    if (event.pointerType === "mouse")
      setHover(pick(event.clientX, event.clientY));
    wake();
  };
  const onPointerLeave = () => {
    pointer.tx = 0;
    pointer.ty = 0;
    setHover(null);
  };
  const onPointerDown = (event: PointerEvent) => {
    downAt = { x: event.clientX, y: event.clientY, time: performance.now() };
  };
  const onPointerUp = (event: PointerEvent) => {
    if (!downAt) return;
    const moved = Math.hypot(
      event.clientX - downAt.x,
      event.clientY - downAt.y,
    );
    const quick = performance.now() - downAt.time < 600;
    downAt = null;
    if (moved > 8 || !quick) return;
    const id = pick(event.clientX, event.clientY);
    if (id || focused) events.pick(id);
  };
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);

  const onLost = (event: Event) => {
    event.preventDefault();
    sleep();
    events.lost();
  };
  canvas.addEventListener("webglcontextlost", onLost);

  // --- Loop -----------------------------------------------------------------
  let running = false;
  let raf = 0;
  const islandIds = islands.map((island) => island.id);

  function draw() {
    const t = clock();
    // Islands rise out of the sea one after another the first time.
    islandIds.forEach((id, k) => {
      const root = islandRoots.get(id);
      if (!root) return;
      const local = clamp((t - introStart - k * 0.24) / 1.3, 0, 1);
      const back =
        local === 1 ? 1 : 1 + 2.2 * (local - 1) ** 3 + 1.2 * (local - 1) ** 2;
      root.position.y = (back - 1) * 1.6;
    });
    if (fade.start >= 0) {
      const k = still ? 1 : clamp((t - fade.start) / 1.4, 0, 1);
      blend(fade.from, fade.to, smooth(k), now);
      if (k === 1) fade.start = -1;
    }
    applyLight(now);
    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;
    const base = focused
      ? (focusPoses.get(focused) ?? overview)
      : revealPose(t);
    const k = still ? 1 : clamp((t - flight.start) / FLIGHT, 0, 1);
    current = k < 1 ? lerpPose(flight.from, base, easeInOut(k)) : base;
    place({
      ...current,
      yaw: current.yaw + (still ? 0 : pointer.x * 0.045),
      pitch: current.pitch + (still ? 0 : -pointer.y * 0.03),
    });
    stage.style.setProperty("--isl-rise", rise.toFixed(3));
    if (!revealed && rise > 0.97) {
      revealed = true;
      starPulse = t;
      events.reveal();
    }
    const time = still ? 0 : t;
    seaMaterial.uniforms.uTime.value = time;
    for (const { mark } of landmarks) mark.tick?.(time);
    for (const { cloud, x, phase } of clouds)
      cloud.position.x = x + Math.sin(time * 0.05 + phase) * 1.6;
    // The island under the pointer lifts a little to meet it.
    for (const [id, root] of islandRoots) {
      const lift = id === hovered ? 0.14 : 0;
      root.userData.lift =
        (root.userData.lift ?? 0) +
        (lift - (root.userData.lift ?? 0)) * (still ? 1 : 0.15);
      root.position.y += root.userData.lift;
    }
    if (bouncing) {
      const b = clamp((t - bouncing.start) / 0.7, 0, 1);
      const hop = Math.sin(b * Math.PI) * (1 - b * 0.4);
      bouncing.mark.group.scale.setScalar(1 + hop * 0.22);
      if (b === 1 && !still) bouncing = null;
    }
    for (const carrier of carriers) {
      const u = still
        ? (carrier.offset + 0.3) % 1
        : (t / carrier.period + carrier.offset) % 1;
      const point = carrier.curve.getPointAt(u);
      const ahead = carrier.curve.getPointAt(Math.min(u + 0.01, 1));
      carrier.group.position.copy(point);
      if (u < 0.99) carrier.group.lookAt(ahead.x, point.y, ahead.z);
      carrier.move(time, u, carrier.last);
      carrier.last = u;
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
      flight = { from: current, start: clock() };
      focused = id;
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
      const mark = index === null ? undefined : mine[index]?.mark;
      if (bouncing && bouncing.mark !== mark)
        bouncing.mark.group.scale.setScalar(1);
      bouncing = mark ? { mark, start: clock() } : null;
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
      for (const texture of [
        ramp,
        shore,
        lionFace,
        ...Object.values(art).map((item) => item.texture),
      ])
        texture.dispose();
      renderer.dispose();
    },
  };
}
