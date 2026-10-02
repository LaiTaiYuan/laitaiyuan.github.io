import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import lion from "./data/lionScene.json";
import { lionQuips } from "./data/lionQuips";
import type { LionLine } from "./data/lionQuips";
import type { Daypart } from "./motion";

// The homepage lion looks at you and talks back.
//
// A WebGL pass redraws the studio base image (scripts/build-lion-scene.py)
// with the head warped like a rubber sheet: a broad bump over the face and a
// tighter one on the muzzle slide sideways or up and down, so the near cheek
// stretches and the far one squeezes as if the head turned; the head also
// tilts about the neck, and the jaw drops while the lion talks. The warp fades
// out into the shoulders and stops short of the monitor and the raised arm,
// so no new artwork is needed and nothing tears. The pupils are separate
// layers, moved to wherever the warp carries each eye plus a look of their
// own: the eyes lead and the head follows.
//
// Without WebGL, or under reduced motion, the base image stays and the CSS
// keeps its gentle head bob and pupils; the speech bubble works either way.

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const SCENE = { w: lion.width, h: lion.height };

// Geometry in source pixels of the illustration.
type Ellipse = { x: number; y: number; rx: number; ry: number };
const NECK = { x: 765, y: 395 }; // tilt pivot, under the beard
// The head weight is 1 above the beard line (a parabola under the mane) and
// fades to 0 over the shoulders, before the monitor on the left and, on the
// right, in the free air beside the mane or just before the raised arm.
const HEAD = {
  beardX: 760,
  beardY: 400,
  beardLeft: 0.0028,
  beardRight: 0.0014,
  below: 15,
  above: 45,
  leftFrom: 562,
  leftTo: 600,
  air: 1030,
  arm: 990,
  armFrom: 235,
  armTo: 275,
  inside: 30,
  outside: 5,
};
const FACE: Ellipse = { x: 775, y: 215, rx: 175, ry: 165 };
const MUZZLE: Ellipse = { x: 725, y: 255, rx: 85, ry: 80 };
const JAW: Ellipse = { x: 735, y: 318, rx: 62, ry: 34 };
const TURN = { face: 24, muzzle: 11 }; // sideways slide at a full turn
const NOD = { face: 14, muzzle: 5 }; // vertical slide at a full nod
const JAW_DROP = 8;
const SHIFT = 4.5; // the whole head leans this far into a full turn
const TILT = 3; // degrees of tilt at a full turn
const LOOK = { x: 4.5, y: 3.6 }; // pupil travel inside the eye
const PHONES = { x: 905, y: 205 }; // headphone cup, where the notes rise

type Pose = {
  yaw: number;
  pitch: number;
  roll: number; // radians
  shift: number;
  lift: number;
  jaw: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const ramp = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const bump = (x: number, y: number, e: Ellipse) => {
  const u = (x - e.x) / e.rx;
  const v = (y - e.y) / e.ry;
  const r = Math.max(0, 1 - u * u - v * v);
  return r * r;
};

function headWeight(x: number, y: number) {
  const dx = x - HEAD.beardX;
  const beard =
    HEAD.beardY - (dx < 0 ? HEAD.beardLeft : HEAD.beardRight) * dx * dx;
  const edge =
    HEAD.air + (HEAD.arm - HEAD.air) * ramp(HEAD.armFrom, HEAD.armTo, y);
  return (
    ramp(HEAD.leftFrom, HEAD.leftTo, x) *
    (1 - ramp(edge - HEAD.inside, edge + HEAD.outside, x)) *
    ramp(beard + HEAD.below, beard - HEAD.above, y)
  );
}

// Where the pixel drawn at (x, y) is taken from; the fragment shader below
// is the same function, run for every pixel.
function source(x: number, y: number, pose: Pose): [number, number] {
  const w = headWeight(x, y);
  const a = -pose.roll * w;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const dx = x - NECK.x;
  const dy = y - NECK.y;
  const face = bump(x, y, FACE);
  const muzzle = bump(x, y, MUZZLE);
  return [
    NECK.x +
      c * dx -
      s * dy -
      pose.yaw * (TURN.face * face + TURN.muzzle * muzzle) -
      pose.shift * w,
    NECK.y +
      s * dx +
      c * dy -
      pose.pitch * (NOD.face * face + NOD.muzzle * muzzle) -
      pose.lift * w -
      pose.jaw * JAW_DROP * bump(x, y, JAW),
  ];
}

// Where a point of the artwork ends up: source() inverted by fixed-point
// iteration (the warp is gentle, so a few rounds land within a hair).
function forward(x: number, y: number, pose: Pose): [number, number] {
  let px = x;
  let py = y;
  for (let i = 0; i < 5; i++) {
    const [sx, sy] = source(px, py, pose);
    px += x - sx;
    py += y - sy;
  }
  return [px, py];
}

const f = (v: number) => (Number.isInteger(v) ? `${v}.0` : `${v}`);
const vec4 = (e: Ellipse) =>
  `vec4(${f(e.x)}, ${f(e.y)}, ${f(e.rx)}, ${f(e.ry)})`;

const VERTEX = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = vec2(a_position.x * 0.5 + 0.5, 0.5 - a_position.y * 0.5);
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const FRAGMENT = `
precision highp float;
uniform sampler2D u_image;
uniform vec4 u_turn; // yaw, pitch, roll (radians), jaw
uniform vec2 u_move; // shift, lift
varying vec2 v_uv;
const vec2 SCENE = vec2(${f(SCENE.w)}, ${f(SCENE.h)});
const vec2 NECK = vec2(${f(NECK.x)}, ${f(NECK.y)});
float ramp(float a, float b, float x) {
  float t = clamp((x - a) / (b - a), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}
float bump(vec2 p, vec4 e) {
  vec2 q = (p - e.xy) / e.zw;
  float r = max(1.0 - dot(q, q), 0.0);
  return r * r;
}
float headWeight(vec2 p) {
  float dx = p.x - ${f(HEAD.beardX)};
  float beard = ${f(HEAD.beardY)} - (dx < 0.0 ? ${f(HEAD.beardLeft)} : ${f(HEAD.beardRight)}) * dx * dx;
  float edge = mix(${f(HEAD.air)}, ${f(HEAD.arm)}, ramp(${f(HEAD.armFrom)}, ${f(HEAD.armTo)}, p.y));
  return ramp(${f(HEAD.leftFrom)}, ${f(HEAD.leftTo)}, p.x)
    * (1.0 - ramp(edge - ${f(HEAD.inside)}, edge + ${f(HEAD.outside)}, p.x))
    * ramp(beard + ${f(HEAD.below)}, beard - ${f(HEAD.above)}, p.y);
}
void main() {
  vec2 p = v_uv * SCENE;
  float w = headWeight(p);
  float a = -u_turn.z * w;
  vec2 d = p - NECK;
  vec2 s = NECK + vec2(cos(a) * d.x - sin(a) * d.y, sin(a) * d.x + cos(a) * d.y);
  float face = bump(p, ${vec4(FACE)});
  float muzzle = bump(p, ${vec4(MUZZLE)});
  s.x -= u_turn.x * (${f(TURN.face)} * face + ${f(TURN.muzzle)} * muzzle) + u_move.x * w;
  s.y -= u_turn.y * (${f(NOD.face)} * face + ${f(NOD.muzzle)} * muzzle) + u_move.y * w
    + u_turn.w * ${f(JAW_DROP)} * bump(p, ${vec4(JAW)});
  gl_FragColor = texture2D(u_image, s / SCENE);
}`;

function link(gl: WebGLRenderingContext) {
  const program = gl.createProgram();
  if (!program) return null;
  const shaders = (
    [
      [gl.VERTEX_SHADER, VERTEX],
      [gl.FRAGMENT_SHADER, FRAGMENT],
    ] as const
  ).map(([type, text]) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, text);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
    return shader;
  });
  gl.linkProgram(program);
  for (const shader of shaders) if (shader) gl.deleteShader(shader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

// A layer's box and pivot in source pixels, from the scene manifest.
function layerBox(name: keyof typeof lion.layers) {
  const box = lion.layers[name];
  const w = (box.w / 100) * SCENE.w;
  const h = (box.h / 100) * SCENE.h;
  return {
    w,
    h,
    x: (box.x / 100) * SCENE.w + (box.ox / 100) * w,
    y: (box.y / 100) * SCENE.h + (box.oy / 100) * h,
  };
}

type Look = { yaw: number; pitch: number; eyes: [number, number] };
// Where the lion glances when nobody is pointing: back at the viewer most of
// the time, now and then up at its bulb, down at the laptop or over at the
// monitor, or it nods along to whatever is playing in its headphones.
const VIEWER: Look = { yaw: 0, pitch: 0, eyes: [0, 0] };
const GLANCES: Look[] = [
  { yaw: 0.8, pitch: -0.85, eyes: [1, -1] }, // bulb
  { yaw: -0.45, pitch: 0.95, eyes: [-0.4, 1] }, // laptop
  { yaw: -1, pitch: 0.15, eyes: [-1, 0.15] }, // monitor
];
const GROOVE = 3.6; // six beats
const BPM = 100;
const DIZZY = 1.5;

type Spring = { x: number; v: number };
function step(s: Spring, target: number, k: number, zeta: number, dt: number) {
  s.v += (k * (target - s.x) - 2 * Math.sqrt(k) * zeta * s.v) * dt;
  s.x += s.v * dt;
}
// 0 → 1 → 0 over `length` seconds with `fade`-second edges.
const envelope = (t: number, length: number, fade: number) =>
  clamp(Math.min(t / fade, (length - t) / fade), 0, 1);

export type LionHead = {
  // Animate only while the scene is on screen.
  run(on: boolean): void;
  // Watch a point (client pixels) for the next `seconds`.
  look(x: number, y: number, seconds: number): void;
  // Stop watching and go back to glancing around.
  rest(): void;
  poke(): void;
  dizzy(): void;
  talk(seconds: number): void;
  // The base image switched source (responsive images).
  refresh(): void;
  destroy(): void;
};

export function createLionHead(
  scene: HTMLElement,
  canvas: HTMLCanvasElement,
  base: HTMLImageElement,
  events: { ready(): void; lost(): void },
): LionHead | null {
  // A software-rendered context would redraw the whole scene on the CPU
  // every frame; the static fallback is kinder there.
  const context = canvas.getContext("webgl", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "low-power",
    failIfMajorPerformanceCaveat: true,
  });
  // Source pixels need more precision than mediump floats carry.
  if (
    !context ||
    !context.getShaderPrecisionFormat(
      context.FRAGMENT_SHADER,
      context.HIGH_FLOAT,
    )?.precision
  )
    return null;
  const gl: WebGLRenderingContext = context;
  // Software renderers chosen outright are not flagged as a caveat.
  const debug = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer = `${gl.getParameter(gl.RENDERER)} ${
    debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : ""
  }`;
  if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer))
    return null;
  const program = link(gl);
  if (!program) return null;
  gl.useProgram(program);
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const position = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.uniform1i(gl.getUniformLocation(program, "u_image"), 0);
  const turn = gl.getUniformLocation(program, "u_turn");
  const move = gl.getUniformLocation(program, "u_move");

  const layer = (name: string) =>
    scene.querySelector<HTMLElement>(`[data-layer="${name}"]`);
  const eyes = (["pupil-left", "pupil-right"] as const).map((name) => ({
    element: layer(name),
    ...layerBox(name),
  }));
  const notes = { element: layer("head"), ...layerBox("head") };

  const pose: Pose = { yaw: 0, pitch: 0, roll: 0, shift: 0, lift: 0, jaw: 0 };
  const yaw: Spring = { x: 0, v: 0 };
  const pitch: Spring = { x: 0, v: 0 };
  const roll: Spring = { x: 0, v: 0 }; // degrees
  const hop: Spring = { x: 0, v: 0 };
  const eyeX: Spring = { x: 0, v: 0 };
  const eyeY: Spring = { x: 0, v: 0 };
  const pupil: Spring = { x: 1, v: 0 };
  const now = () => performance.now() / 1000;
  let pointX = 0;
  let pointY = 0;
  let watchUntil = 0;
  let idle = VIEWER;
  let idleUntil = now() + 2.5;
  let grooveFrom = -Infinity;
  let dizzyFrom = -Infinity;
  let talkFrom = -Infinity;
  let talkUntil = -Infinity;
  let running = false;
  let ready = false;
  let frame = 0;
  let last = 0;

  // The texture is the base image as the browser would draw it at the
  // canvas's own resolution, so the untouched parts stay pixel for pixel.
  let fitted = "";
  function fit(force = false) {
    const width = scene.clientWidth;
    if (!width || !base.complete) return false;
    const w = Math.round(width * Math.min(window.devicePixelRatio || 1, 2));
    const h = Math.round((w * SCENE.h) / SCENE.w);
    if (!force && fitted === `${w}x${h}`) return true;
    const scratch = document.createElement("canvas");
    scratch.width = w;
    scratch.height = h;
    const g = scratch.getContext("2d");
    if (!g) return false;
    g.imageSmoothingQuality = "high";
    try {
      g.drawImage(base, 0, 0, w, h);
    } catch {
      return false; // the image failed to load
    }
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      scratch,
    );
    scratch.width = scratch.height = 0;
    fitted = `${w}x${h}`;
    return true;
  }

  function nextIdle(t: number) {
    if (idle !== VIEWER && Math.random() < 0.8) {
      idle = VIEWER;
    } else if (Math.random() < 0.25) {
      idle = VIEWER;
      grooveFrom = t;
      idleUntil = t + GROOVE + 0.6;
      return;
    } else {
      idle = GLANCES[Math.floor(Math.random() * GLANCES.length)];
    }
    idleUntil =
      t +
      (idle === VIEWER ? 2.4 + Math.random() * 1.8 : 1.2 + Math.random() * 0.9);
  }

  function update(t: number, dt: number) {
    let yawTo: number;
    let pitchTo: number;
    let eyeXTo: number;
    let eyeYTo: number;
    if (t < watchUntil) {
      const rect = scene.getBoundingClientRect();
      const nx =
        (pointX - rect.left - (rect.width * FACE.x) / SCENE.w) /
        (rect.width * 0.32);
      const ny =
        (pointY - rect.top - (rect.height * FACE.y) / SCENE.h) /
        (rect.height * 0.55);
      yawTo = Math.tanh(nx);
      pitchTo = Math.tanh(ny) * 0.85;
      eyeXTo = clamp(nx * 1.8, -1, 1);
      eyeYTo = clamp(ny * 1.8, -1, 1);
    } else {
      if (t >= idleUntil) nextIdle(t);
      yawTo = idle.yaw;
      pitchTo = idle.pitch;
      [eyeXTo, eyeYTo] = idle.eyes;
    }
    const dizzy = t - dizzyFrom;
    if (dizzy < DIZZY) {
      // Eyes roll round and round.
      eyeXTo = Math.cos(dizzy * TAU * 1.6);
      eyeYTo = 0.8 * Math.sin(dizzy * TAU * 1.6);
    }
    // Eyes snap first, the head follows and the tilt trails behind it.
    for (let left = dt; left > 1e-6; left -= 1 / 120) {
      const h = Math.min(left, 1 / 120);
      step(eyeX, eyeXTo, 420, 0.9, h);
      step(eyeY, eyeYTo, 420, 0.9, h);
      step(yaw, yawTo, 60, 0.72, h);
      step(pitch, pitchTo, 60, 0.72, h);
      step(roll, yawTo * TILT, 34, 0.6, h);
      step(hop, 0, 140, 0.32, h);
      step(pupil, 1, 90, 0.4, h);
    }
    // Breathing, grooving, wobbling and talking ride on top of the springs.
    const breath = Math.sin((t * TAU) / 4.6);
    let tilt = roll.x + 0.35 * breath;
    let nod = pitch.x;
    let turnBy = yaw.x;
    const groove = t - grooveFrom;
    if (groove < GROOVE) {
      const beat = (groove * BPM) / 60;
      const fade = envelope(groove, GROOVE, 0.4);
      nod += fade * 0.4 * (0.5 - 0.5 * Math.cos(beat * TAU));
      tilt += fade * 2.2 * Math.sin(beat * Math.PI);
    }
    if (dizzy < DIZZY) {
      const fade = envelope(dizzy, DIZZY, 0.25);
      tilt += fade * 4 * Math.sin(dizzy * TAU * 2.2);
      turnBy += fade * 0.3 * Math.sin(dizzy * TAU * 1.1);
    }
    const talking = t - talkFrom;
    pose.jaw =
      t < talkUntil
        ? envelope(talking, talkUntil - talkFrom, 0.12) *
          (0.5 - 0.5 * Math.cos(talking * TAU * 4.5))
        : 0;
    pose.yaw = turnBy;
    pose.pitch = nod;
    pose.roll = tilt * DEG;
    pose.shift = turnBy * SHIFT;
    pose.lift = hop.x - 1.4 * (0.5 + 0.5 * breath);
  }

  const percent = (value: number, size: number) =>
    `${((value / size) * 100).toFixed(2)}%`;

  function draw() {
    gl.uniform4f(turn, pose.yaw, pose.pitch, pose.roll, pose.jaw);
    gl.uniform2f(move, pose.shift, pose.lift);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    for (const eye of eyes) {
      if (!eye.element) continue;
      const [x, y] = forward(eye.x, eye.y, pose);
      eye.element.style.transform = `translate(${percent(
        x - eye.x + eyeX.x * LOOK.x,
        eye.w,
      )}, ${percent(y - eye.y + eyeY.x * LOOK.y, eye.h)}) scale(${pupil.x.toFixed(3)})`;
    }
    if (notes.element) {
      const [x, y] = forward(PHONES.x, PHONES.y, pose);
      notes.element.style.transform = `translate(${percent(
        x - PHONES.x,
        notes.w,
      )}, ${percent(y - PHONES.y, notes.h)})`;
    }
  }

  function tick(ms: number) {
    frame = 0;
    const t = ms / 1000;
    update(t, clamp(t - last, 0, 1 / 20));
    last = t;
    draw();
    frame = requestAnimationFrame(tick);
  }
  function wake() {
    if (!running || !ready || frame || document.hidden) return;
    last = now();
    frame = requestAnimationFrame(tick);
  }
  function sleep() {
    cancelAnimationFrame(frame);
    frame = 0;
  }
  function settle() {
    if (ready || !fit()) return;
    ready = true;
    update(now(), 0);
    draw();
    events.ready();
    wake();
  }

  let resizeTimer = 0;
  const resizer = new ResizeObserver(() => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (!ready) return settle();
      fit();
      draw();
    }, 150);
  });
  resizer.observe(scene);
  const onVisibility = () => (document.hidden ? sleep() : wake());
  document.addEventListener("visibilitychange", onVisibility);
  const reset = () => {
    for (const element of [...eyes.map((eye) => eye.element), notes.element])
      if (element) element.style.transform = "";
  };
  const onLost = (event: Event) => {
    event.preventDefault();
    sleep();
    reset();
    events.lost();
  };
  canvas.addEventListener("webglcontextlost", onLost);
  settle();

  return {
    run(on) {
      running = on;
      if (on) wake();
      else sleep();
    },
    look(x, y, seconds) {
      pointX = x;
      pointY = y;
      watchUntil = now() + seconds;
    },
    rest() {
      watchUntil = 0;
      idleUntil = 0;
    },
    poke() {
      hop.v -= 230;
      roll.v += (Math.random() < 0.5 ? -1 : 1) * 45;
      pupil.x = 0.7;
    },
    dizzy() {
      dizzyFrom = now();
    },
    talk(seconds) {
      talkFrom = now();
      talkUntil = talkFrom + seconds;
    },
    refresh() {
      if (ready && fit(true)) draw();
      else settle();
    },
    destroy() {
      sleep();
      window.clearTimeout(resizeTimer);
      resizer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onLost);
      reset();
      gl.deleteTexture(texture);
      gl.deleteBuffer(quad);
      gl.deleteProgram(program);
    },
  };
}

type Kind = "hello" | "pass" | "dizzy" | "poke";

function shuffled<T>(lines: readonly T[]) {
  const order = [...lines];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

const POP = [{ scale: "0.8" }, { scale: "1.08", offset: 0.55 }, { scale: "1" }];

// How long a bubble stays up: a joke's setup only long enough to read, the
// last beat (or a single line) long enough to land.
const beatTime = (text: string, last: boolean) => {
  const length = [...text].length;
  return last
    ? clamp(2400 + length * 110, 3200, 5600)
    : clamp(900 + length * 90, 1300, 2400);
};

// Wires the lion to the page: the head follows a mouse anywhere on screen
// while the scene is visible (or a tap, on touch screens), and the bubble
// speaks up when the pointer arrives, sweeps past its face, shakes it about
// or pokes it. Lines come from src/data/lionQuips.ts, shuffled so none repeats
// before the rest have been said; a joke is told beat by beat, and the bubble
// falls back to the motto a few seconds after the last one.
export function useLionHead(daypart: Daypart) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const headRef = useRef<LionHead | null>(null);
  const daypartRef = useRef(daypart);
  const [live, setLive] = useState(false);
  const [quip, setQuip] = useState<string | null>(null);
  // What a screen reader hears after pressing the lion.
  const [heard, setHeard] = useState("");
  const talk = useRef({
    timer: 0,
    quietUntil: -Infinity, // when the current line or joke ends
    hello: -Infinity,
    dizzy: -Infinity,
    pokes: 0,
    previous: null as LionLine | null,
    told: new Set<LionLine>(),
    bags: new Map<string, LionLine[]>(),
  });

  useEffect(() => {
    daypartRef.current = daypart;
  }, [daypart]);

  // `asked`: a press always gets an answer, whatever was said just before.
  const say = useCallback((kind: Kind, asked = false) => {
    const state = talk.current;
    const at = performance.now();
    if (!asked) {
      // Pointer chatter waits for a few quiet seconds after the last line;
      // greetings come at most every 45s and never over another line.
      if (kind === "pass" && at < state.quietUntil + 4000) return;
      if (
        kind === "hello" &&
        (at - state.hello < 45000 || at < state.quietUntil)
      )
        return;
      if (kind === "dizzy" && at - state.dizzy < 5000) return;
    }
    const pick = (lines: readonly LionLine[], key: string) => {
      let bag = state.bags.get(key);
      if (!bag?.length) {
        bag = shuffled(lines);
        const end = bag.length - 1;
        if (end > 0 && bag[end] === state.previous)
          [bag[0], bag[end]] = [bag[end], bag[0]];
        state.bags.set(key, bag);
      }
      return bag.pop() ?? lines[0];
    };
    let line: LionLine;
    if (kind === "hello") {
      state.hello = at;
      const time = daypartRef.current;
      line = pick(
        [...lionQuips.hello, ...lionQuips.daypart[time]],
        `hello-${time}`,
      );
    } else if (kind === "poke") {
      state.pokes += 1;
      const milestone = lionQuips.milestones[state.pokes];
      if (milestone !== undefined && !state.told.has(milestone)) {
        line = milestone;
        // Told now, so not again from the shuffled pile this round.
        const bag = state.bags.get(kind);
        const index = bag?.indexOf(milestone) ?? -1;
        if (bag && index >= 0) bag.splice(index, 1);
      } else {
        line = pick(lionQuips.poke, kind);
      }
    } else {
      if (kind === "dizzy") state.dizzy = at;
      line = pick(lionQuips[kind], kind);
    }
    state.previous = line;
    state.told.add(line);
    const beats = typeof line === "string" ? [line] : line;
    if (asked) setHeard(beats.join(""));
    state.quietUntil =
      at +
      beats.reduce(
        (total, beat, index) =>
          total + beatTime(beat, index === beats.length - 1),
        0,
      );
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const show = (index: number) => {
      const text = beats[index];
      const last = index === beats.length - 1;
      setQuip(text);
      headRef.current?.talk(Math.min(1.6, 0.5 + [...text].length * 0.06));
      if (!still)
        bubbleRef.current?.animate?.(POP, {
          duration: 460,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        });
      state.timer = window.setTimeout(
        () => (last ? setQuip(null) : show(index + 1)),
        beatTime(text, last),
      );
    };
    window.clearTimeout(state.timer);
    show(0);
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    const canvas = canvasRef.current;
    const base = scene?.querySelector<HTMLImageElement>("img.lp-scene-base");
    if (!scene || !canvas || !base || !("IntersectionObserver" in window))
      return;
    const state = talk.current;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let head: LionHead | null = null;
    let visible = false;
    const start = () => {
      if (head || still || !("ResizeObserver" in window)) return;
      head = createLionHead(scene, canvas, base, {
        ready: () => setLive(true),
        lost: () => {
          head?.destroy();
          head = headRef.current = null;
          setLive(false);
        },
      });
      headRef.current = head;
      head?.run(visible);
    };
    const onLoad = () => (head ? head.refresh() : start());
    if (base.complete) start();
    base.addEventListener("load", onLoad);

    const observer = new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting;
      head?.run(visible);
    });
    observer.observe(scene);

    // A mouse sweeping across the face, or shaking left and right in front
    // of it (four swings of 40px or more within 1.4s), gets a reaction.
    let side = 0;
    let lastX = 0;
    let heading = 0;
    let turnX = 0;
    const turns: number[] = [];
    const onMove = (event: PointerEvent) => {
      if (!visible || event.pointerType !== "mouse" || still) return;
      head?.look(event.clientX, event.clientY, 6);
      const rect = scene.getBoundingClientRect();
      const face = rect.left + (rect.width * FACE.x) / SCENE.w;
      const facing = Math.sign(event.clientX - face);
      const level =
        event.clientY > rect.top - 40 && event.clientY < rect.bottom;
      if (facing && side && facing !== side && level) say("pass");
      if (facing) side = facing;
      const dx = event.clientX - lastX;
      lastX = event.clientX;
      if (Math.abs(dx) < 2) return;
      const direction = Math.sign(dx);
      if (direction !== heading) {
        if (heading && Math.abs(event.clientX - turnX) > 40)
          turns.push(event.timeStamp);
        turnX = event.clientX;
        heading = direction;
      }
      while (turns.length && event.timeStamp - turns[0] > 1400) turns.shift();
      if (turns.length >= 4) {
        turns.length = 0;
        head?.dizzy();
        say("dizzy");
      }
    };
    // On touch screens the lion looks wherever you tap.
    const onDown = (event: PointerEvent) => {
      if (visible && event.pointerType !== "mouse")
        head?.look(event.clientX, event.clientY, 2.5);
    };
    const onLeave = () => head?.rest();
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      observer.disconnect();
      base.removeEventListener("load", onLoad);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.clearTimeout(state.timer);
      head?.destroy();
      headRef.current = null;
      setLive(false);
    };
  }, [say]);

  // Pressing the lion: it hops and answers back (the first time, it says
  // hello instead).
  const poke = useCallback(() => {
    headRef.current?.poke();
    say(talk.current.hello === -Infinity ? "hello" : "poke", true);
  }, [say]);

  const greet = useCallback(
    (event: ReactPointerEvent) => {
      if (event.pointerType === "mouse") say("hello");
    },
    [say],
  );

  return { sceneRef, canvasRef, bubbleRef, live, quip, heard, poke, greet };
}
