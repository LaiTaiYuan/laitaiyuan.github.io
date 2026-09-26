import { useCallback, useEffect, useRef, useState } from "react";

// Full Stack: an isometric stacking game drawn in the site's comic style.
// Every layer carries something from Leonard's actual stack; drops that line
// up exactly climb a pentatonic scale. The canvas draws the tower, while the
// score, buttons and messages stay HTML (see Home.tsx).

const TAU = Math.PI * 2;
const C30 = Math.cos(Math.PI / 6);
const S30 = 0.5;
const LAYER = 20; // world units per layer
const BASE = 100; // footprint of the pedestal and the first layer
const PERFECT = 3.5; // how close to the layer below counts as perfect
const RANGE = 150; // how far the sliding block travels either side
const RESTART_DELAY = 0.7; // seconds before a tap after game over restarts
// C major pentatonic, climbing with each perfect drop in a row
const NOTES = [
  523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760,
  2093,
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function channels(hex: string) {
  const value = parseInt(hex.replace("#", ""), 16);
  return Number.isNaN(value)
    ? [20, 20, 20]
    : [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
const shade = (hex: string, factor: number) =>
  `rgb(${channels(hex)
    .map((c) => Math.min(255, Math.round(c * factor)))
    .join(", ")})`;
const tint = (hex: string, alpha: number) =>
  `rgba(${channels(hex).join(", ")}, ${alpha})`;

type Axis = "x" | "z";
type Block = {
  x: number; // centre
  z: number;
  w: number; // size along x
  d: number; // size along z
  y: number; // bottom
  h: number;
  tone: number; // palette index, -1 for the pedestal
  label: string;
};
type Mover = Block & {
  axis: Axis;
  origin: number;
  phase: number;
  speed: number;
};
type Piece = Block & {
  vx: number;
  vy: number;
  vz: number;
  angle: number;
  spin: number;
};
type Spark = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  born: number;
  light: boolean;
};

const along = (b: Block, axis: Axis) => (axis === "x" ? b.x : b.z);
const span = (b: Block, axis: Axis) => (axis === "x" ? b.w : b.d);
const cube = (b: Block): Block => ({
  x: b.x,
  z: b.z,
  w: b.w,
  d: b.d,
  y: b.y,
  h: b.h,
  tone: b.tone,
  label: b.label,
});
const resized = (b: Block, axis: Axis, centre: number, size: number) =>
  axis === "x"
    ? { ...cube(b), x: centre, w: size }
    : { ...cube(b), z: centre, d: size };

// Plucked notes synthesised on the fly; nothing plays until a tap or key
// press has started the game.
function createSound() {
  let audio: AudioContext | null = null;
  let out: GainNode | null = null;
  let enabled = true;
  const ready = () => {
    if (!enabled) return null;
    if (!audio) {
      const Context =
        window.AudioContext ??
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Context) return null;
      audio = new Context();
      out = audio.createGain();
      out.gain.value = 0.2;
      out.connect(audio.destination);
    }
    if (audio.state === "suspended") void audio.resume();
    return audio;
  };
  const note = (
    frequency: number,
    delay: number,
    length: number,
    type: "sine" | "triangle",
    peak: number,
  ) => {
    const context = ready();
    if (!context || !out) return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    oscillator.connect(gain).connect(out);
    oscillator.start(start);
    oscillator.stop(start + length + 0.05);
  };
  return {
    enable(on: boolean) {
      enabled = on;
    },
    unlock() {
      ready();
    },
    place(perfect: boolean, combo: number) {
      if (perfect) {
        const frequency = NOTES[Math.min(combo - 1, NOTES.length - 1)];
        note(frequency, 0, 0.55, "triangle", 0.7);
        note(frequency * 2, 0, 0.3, "sine", 0.15);
      } else {
        note(220, 0, 0.16, "sine", 0.8);
        note(440, 0, 0.1, "triangle", 0.2);
      }
    },
    over() {
      [392, 329.63, 261.63].forEach((frequency, i) =>
        note(frequency, i * 0.15, 0.32, "triangle", 0.5),
      );
    },
    close() {
      void audio?.close();
      audio = null;
    },
  };
}

export type StackStatus = "idle" | "playing" | "over";
export type StackEvents = {
  onStart(): void;
  onPlace(score: number, perfect: boolean, combo: number): void;
  onOver(score: number): void;
};
export type StackGame = {
  // Start, drop the sliding block, or restart after game over.
  press(): void;
  setSound(on: boolean): void;
  // Animate only while the stage is on screen.
  run(on: boolean): void;
  destroy(): void;
};

export function createStackGame(
  canvas: HTMLCanvasElement,
  labels: readonly string[],
  events: StackEvents,
): StackGame | null {
  const context = canvas.getContext("2d");
  if (!context) return null;
  const ctx: CanvasRenderingContext2D = context;
  const styles = getComputedStyle(canvas);
  const token = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;
  const tones = [0, 1, 2, 3, 4].map((i) => token(`--stack-${i}`, "#ffbe23"));
  const ink = token("--tb-ink", "#141414");
  const white = token("--tb-white", "#ffffff");
  const blue = token("--tb-blue", "#405ada");
  const yellow = token("--tb-yellow", "#ffbe23");
  const font = token("--tb-display", "sans-serif");
  // Lit top, a shaded left face and a darker right face per colour.
  const faces = tones.map(
    (hex) => [hex, shade(hex, 0.86), shade(hex, 0.7)] as const,
  );
  const pedestal = [shade(ink, 2.2), ink, shade(ink, 0.6)] as const;
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sound = createSound();

  let width = 0;
  let height = 0;
  let dpr = 1;
  let scale = 1;
  let backdrop: HTMLCanvasElement | null = null;

  let status: StackStatus = "idle";
  let tower: Block[] = [];
  let mover: Mover | null = null;
  let pieces: Piece[] = [];
  let sparks: Spark[] = [];
  let pops: { text: string; block: Block; born: number }[] = [];
  let rings: { block: Block; born: number }[] = [];
  let score = 0;
  let combo = 0;
  let overAt = 0;
  let camY = 0;
  let zoom = 1;
  let zoomTarget = 1;
  let anchor = 0.36;
  let anchorTarget = 0.36;
  let shake = 0;
  let flash = 0;
  let jitterX = 0;
  let jitterY = 0;
  let frame = 0;
  let last = 0;
  let running = false;

  const top = () => tower[tower.length - 1];
  const topY = () => top().y + top().h;
  const labelFor = (index: number) => labels[index] ?? `${index + 1}F`;
  const layer = (index: number): Block => ({
    x: 0,
    z: 0,
    w: BASE,
    d: BASE,
    y: index * LAYER,
    h: LAYER,
    tone: index % tones.length,
    label: labelFor(index),
  });
  // Where the camera looks: the top of the tower while playing, the middle
  // of the whole tower once it is over.
  const camTarget = () =>
    status === "over" ? (topY() - LAYER * 3) / 2 : topY();
  const fitZoom = () =>
    clamp(
      (height * 0.52) / ((topY() + LAYER * 3 + BASE * 0.9) * scale),
      0.22,
      1,
    );

  function slide(distance: number) {
    if (!mover) return;
    mover.phase = (mover.phase + distance / (2 * RANGE)) % 2;
    const t = mover.phase < 1 ? mover.phase : 2 - mover.phase;
    const position = mover.origin - RANGE + 2 * RANGE * t;
    if (mover.axis === "x") mover.x = position;
    else mover.z = position;
  }

  // The next block copies the footprint of the top one and slides along the
  // other axis than the last.
  function spawn() {
    const below = top();
    const index = tower.length - 1;
    const axis: Axis = index % 2 === 0 ? "x" : "z";
    mover = {
      ...layer(index),
      x: below.x,
      z: below.z,
      w: below.w,
      d: below.d,
      axis,
      origin: along(below, axis),
      phase: 0,
      speed: Math.min(3.2, 1.35 + index * 0.055),
    };
    slide(0);
  }

  function reset(demo: boolean) {
    tower = [
      {
        x: 0,
        z: 0,
        w: BASE,
        d: BASE,
        y: -LAYER * 3,
        h: LAYER * 3,
        tone: -1,
        label: "LEONARD LAI",
      },
    ];
    if (demo) for (let i = 0; i < 4; i++) tower.push(layer(i));
    pieces = [];
    sparks = [];
    pops = [];
    rings = [];
    score = 0;
    combo = 0;
    flash = 0;
    spawn();
  }

  function celebrate(block: Block, now: number) {
    flash = 1;
    rings.push({ block, born: now });
    pops.push({
      text: combo > 1 ? `PERFECT ×${combo}` : "PERFECT!",
      block,
      born: now,
    });
    if (calm) return;
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * TAU;
      const speed = 1.1 + Math.random() * 1.2;
      sparks.push({
        x: block.x + Math.cos(angle) * block.w * 0.5,
        y: block.y + block.h,
        z: block.z + Math.sin(angle) * block.d * 0.5,
        vx: Math.cos(angle) * speed,
        vy: 1.4 + Math.random() * 1.6,
        vz: Math.sin(angle) * speed,
        born: now,
        light: i % 2 === 0,
      });
    }
  }

  function drop(now: number) {
    if (!mover) return;
    const below = top();
    const axis = mover.axis;
    const delta = along(mover, axis) - along(below, axis);
    const size = span(mover, axis);
    const perfect = Math.abs(delta) <= PERFECT;
    let placed: Block;
    if (perfect) {
      combo += 1;
      // A streak grows the block back towards its full footprint.
      const grown = combo >= 3 ? Math.min(BASE, size + 6) : size;
      placed = resized(mover, axis, along(below, axis), grown);
    } else {
      const overlap = size - Math.abs(delta);
      if (overlap <= 0) {
        fall(now);
        return;
      }
      combo = 0;
      placed = resized(mover, axis, along(below, axis) + delta / 2, overlap);
      // The overhang is cut off and tumbles away.
      const side = Math.sign(delta);
      const cut = Math.abs(delta);
      pieces.push({
        ...resized(
          mover,
          axis,
          along(placed, axis) + (side * (overlap + cut)) / 2,
          cut,
        ),
        vx: axis === "x" ? side * 0.9 : 0,
        vy: 0.6,
        vz: axis === "z" ? side * 0.9 : 0,
        angle: 0,
        spin: side * (axis === "x" ? 0.018 : -0.018),
      });
    }
    tower.push(placed);
    score += 1;
    if (perfect) celebrate(placed, now);
    sound.place(perfect, combo);
    events.onPlace(score, perfect, combo);
    spawn();
  }

  // Missed completely: the block falls, the camera pulls back to show the
  // whole tower.
  function fall(now: number) {
    if (!mover) return;
    const side =
      Math.sign(along(mover, mover.axis) - along(top(), mover.axis)) || 1;
    pieces.push({
      ...cube(mover),
      vx: mover.axis === "x" ? side * 1.1 : 0,
      vy: 0.4,
      vz: mover.axis === "z" ? side * 1.1 : 0,
      angle: 0,
      spin: side * 0.02,
    });
    mover = null;
    status = "over";
    overAt = now;
    shake = calm ? 0 : 9;
    zoomTarget = fitZoom();
    anchorTarget = 0.42;
    sound.over();
    events.onOver(score);
  }

  function start() {
    sound.unlock();
    reset(false);
    status = "playing";
    zoomTarget = 1;
    anchorTarget = 0.6;
    events.onStart();
  }

  function update(dt: number, now: number) {
    if (mover && (status === "playing" || (status === "idle" && !calm)))
      slide((status === "idle" ? 0.9 : mover.speed) * dt);
    const ease = (rate: number) => Math.min(1, rate * dt);
    camY += (camTarget() - camY) * ease(0.12);
    zoom += (zoomTarget - zoom) * ease(0.07);
    anchor += (anchorTarget - anchor) * ease(0.08);
    shake *= Math.pow(0.82, dt);
    if (shake < 0.2) shake = 0;
    flash = Math.max(0, flash - 0.05 * dt);
    const floor = camY - height / (scale * zoom);
    pieces = pieces.filter((piece) => {
      piece.vy -= 0.42 * dt;
      piece.x += piece.vx * dt;
      piece.y += piece.vy * dt;
      piece.z += piece.vz * dt;
      piece.angle += piece.spin * dt;
      return piece.y > floor;
    });
    sparks = sparks.filter((spark) => {
      spark.vy -= 0.12 * dt;
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.z += spark.vz * dt;
      return now - spark.born < 0.9;
    });
    pops = pops.filter((pop) => now - pop.born < 1);
    rings = rings.filter((ring) => now - ring.born < 0.6);
  }

  const busy = () =>
    status === "playing" ||
    (status === "idle" && !calm) ||
    pieces.length > 0 ||
    sparks.length > 0 ||
    pops.length > 0 ||
    rings.length > 0 ||
    shake > 0 ||
    flash > 0 ||
    Math.abs(camTarget() - camY) > 0.05 ||
    Math.abs(zoomTarget - zoom) > 0.001 ||
    Math.abs(anchorTarget - anchor) > 0.001;

  function project(x: number, y: number, z: number): [number, number] {
    const s = scale * zoom;
    return [
      width / 2 + (x - z) * C30 * s + jitterX,
      height * anchor + (x + z) * S30 * s - (y - camY) * s + jitterY,
    ];
  }

  function polygon(points: [number, number][], fill: string) {
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.stroke();
  }

  // The label is painted onto the left face: the transform maps world units
  // along x and down y onto that face, so the text shears with it.
  function paintLabel(b: Block, color: string) {
    const s = scale * zoom;
    const room = b.w - 12;
    let size = Math.min(10, b.h * 0.5);
    if (room < 16 || size * s < 5) return;
    const [ox, oy] = project(b.x - b.w / 2, b.y + b.h, b.z + b.d / 2);
    ctx.save();
    ctx.setTransform(
      dpr * C30 * s,
      dpr * S30 * s,
      0,
      dpr * s,
      dpr * ox,
      dpr * oy,
    );
    ctx.font = `900 ${size}px ${font}`;
    const measured = ctx.measureText(b.label).width;
    if (measured > room) {
      size *= room / measured;
      ctx.font = `900 ${size}px ${font}`;
    }
    if (size * s >= 5) {
      ctx.fillStyle = color;
      ctx.textBaseline = "middle";
      ctx.fillText(b.label, 6, b.h / 2 + 0.5);
    }
    ctx.restore();
  }

  function drawBlock(
    b: Block,
    palette: readonly [string, string, string],
    labelColor: string | null,
  ) {
    const x0 = b.x - b.w / 2;
    const x1 = b.x + b.w / 2;
    const z0 = b.z - b.d / 2;
    const z1 = b.z + b.d / 2;
    const y0 = b.y;
    const y1 = b.y + b.h;
    polygon(
      [
        project(x0, y1, z1),
        project(x1, y1, z1),
        project(x1, y0, z1),
        project(x0, y0, z1),
      ],
      palette[1],
    );
    polygon(
      [
        project(x1, y1, z0),
        project(x1, y1, z1),
        project(x1, y0, z1),
        project(x1, y0, z0),
      ],
      palette[2],
    );
    polygon(
      [
        project(x0, y1, z0),
        project(x1, y1, z0),
        project(x1, y1, z1),
        project(x0, y1, z1),
      ],
      palette[0],
    );
    if (labelColor) paintLabel(b, labelColor);
  }

  const paletteOf = (b: Block) => (b.tone < 0 ? pedestal : faces[b.tone]);

  function onScreen(b: Block) {
    const highest = project(b.x - b.w / 2, b.y + b.h, b.z - b.d / 2)[1];
    const lowest = project(b.x + b.w / 2, b.y, b.z + b.d / 2)[1];
    return lowest > -20 && highest < height + 20;
  }

  function drawPiece(piece: Piece) {
    const [cx, cy] = project(piece.x, piece.y + piece.h / 2, piece.z);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(piece.angle);
    ctx.translate(-cx, -cy);
    drawBlock(piece, paletteOf(piece), null);
    ctx.restore();
  }

  // Blue panel with halftone dots swelling towards the bottom, painted once
  // per size.
  function paintBackdrop() {
    const layer = document.createElement("canvas");
    layer.width = canvas.width;
    layer.height = canvas.height;
    const g = layer.getContext("2d");
    if (!g) {
      backdrop = null;
      return;
    }
    g.fillStyle = blue;
    g.fillRect(0, 0, layer.width, layer.height);
    const fade = g.createLinearGradient(0, 0, 0, layer.height);
    fade.addColorStop(0, tint(ink, 0));
    fade.addColorStop(1, tint(ink, 0.32));
    g.fillStyle = fade;
    g.fillRect(0, 0, layer.width, layer.height);
    g.fillStyle = tint(white, 0.08);
    const step = 16 * dpr;
    for (
      let row = 0, y = step / 2;
      y < layer.height;
      row++, y += step * 0.866
    ) {
      const r = (y / layer.height) ** 2 * step * 0.34;
      if (r < 0.4) continue;
      g.beginPath();
      for (let x = row % 2 ? step : step / 2; x < layer.width; x += step) {
        g.moveTo(x + r, y);
        g.arc(x, y, r, 0, TAU);
      }
      g.fill();
    }
    backdrop = layer;
  }

  function draw(now: number) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (backdrop) ctx.drawImage(backdrop, 0, 0);
    else {
      ctx.fillStyle = blue;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    jitterX = shake ? (Math.random() * 2 - 1) * shake : 0;
    jitterY = shake ? (Math.random() * 2 - 1) * shake : 0;
    ctx.lineJoin = "round";
    ctx.lineWidth = 2;
    ctx.strokeStyle = ink;

    // Soft shadow where the pedestal meets the ground.
    const ground = -LAYER * 3;
    const shadow = [
      project(-BASE * 0.62, ground, -BASE * 0.62),
      project(BASE * 0.75, ground, -BASE * 0.62),
      project(BASE * 0.75, ground, BASE * 0.75),
      project(-BASE * 0.62, ground, BASE * 0.75),
    ];
    ctx.save();
    ctx.fillStyle = tint(ink, 0.28);
    ctx.beginPath();
    shadow.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.fill();
    ctx.restore();

    const peak = top();
    const behind = (piece: Piece) => piece.x + piece.z < peak.x + peak.z;
    pieces.filter(behind).forEach(drawPiece);
    for (const b of tower)
      if (onScreen(b)) drawBlock(b, paletteOf(b), b.tone < 0 ? white : ink);
    if (flash > 0 && peak.tone >= 0) {
      const y1 = peak.y + peak.h;
      ctx.save();
      ctx.fillStyle = tint(white, flash * 0.75);
      ctx.beginPath();
      [
        project(peak.x - peak.w / 2, y1, peak.z - peak.d / 2),
        project(peak.x + peak.w / 2, y1, peak.z - peak.d / 2),
        project(peak.x + peak.w / 2, y1, peak.z + peak.d / 2),
        project(peak.x - peak.w / 2, y1, peak.z + peak.d / 2),
      ].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.fill();
      ctx.restore();
    }
    if (mover) drawBlock(mover, faces[mover.tone], ink);
    pieces.filter((piece) => !behind(piece)).forEach(drawPiece);

    // Perfect drops: a ring spreads over the top face, sparks fly off and
    // a comic caption pops up.
    for (const ring of rings) {
      const age = (now - ring.born) / 0.6;
      const b = ring.block;
      const grow = 1 + age * 0.5;
      const hw = (b.w / 2) * grow;
      const hd = (b.d / 2) * grow;
      const y1 = b.y + b.h;
      ctx.globalAlpha = Math.max(0, 1 - age);
      ctx.strokeStyle = white;
      ctx.lineWidth = 3;
      ctx.beginPath();
      [
        project(b.x - hw, y1, b.z - hd),
        project(b.x + hw, y1, b.z - hd),
        project(b.x + hw, y1, b.z + hd),
        project(b.x - hw, y1, b.z + hd),
      ].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = ink;
    for (const spark of sparks) {
      const [x, y] = project(spark.x, spark.y, spark.z);
      const life = 1 - (now - spark.born) / 0.9;
      ctx.fillStyle = spark.light ? white : yellow;
      ctx.beginPath();
      ctx.arc(x, y, 2 + life * 2.5, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    for (const pop of pops) {
      const age = now - pop.born;
      const b = pop.block;
      const [x, y] = project(b.x, b.y + b.h, b.z);
      const bounce =
        age < 0.12
          ? 0.6 + (age / 0.12) * 0.55
          : age < 0.22
            ? 1.15 - ((age - 0.12) / 0.1) * 0.15
            : 1;
      ctx.save();
      ctx.globalAlpha = age < 0.7 ? 1 : Math.max(0, 1 - (age - 0.7) / 0.3);
      ctx.translate(x, y - 34 - age * 40);
      ctx.rotate(-0.07);
      ctx.scale(bounce, bounce);
      ctx.font = `900 ${Math.round(clamp(width / 18, 18, 30))}px ${font}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.lineWidth = 6;
      ctx.strokeStyle = ink;
      ctx.strokeText(pop.text, 0, 0);
      ctx.fillStyle = yellow;
      ctx.fillText(pop.text, 0, 0);
      ctx.restore();
    }
  }

  function tick(now: number) {
    frame = 0;
    if (!width) return;
    const dt = last ? clamp((now - last) / (1000 / 60), 0.25, 2.5) : 1;
    last = now;
    update(dt, now / 1000);
    draw(now / 1000);
    if (running && !document.hidden && busy())
      frame = requestAnimationFrame(tick);
  }
  function wake() {
    if (!running || frame || document.hidden || !width) return;
    last = 0;
    frame = requestAnimationFrame(tick);
  }
  function sleep() {
    cancelAnimationFrame(frame);
    frame = 0;
  }

  function layout() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    if (!width || !height) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    // Keep the whole slide (the block's centre ±RANGE) inside the panel.
    scale = Math.min(width / 450, height / 520);
    if (status === "over") {
      zoomTarget = fitZoom();
      zoom = zoomTarget;
    }
    paintBackdrop();
    draw(performance.now() / 1000);
  }

  reset(true);
  camY = camTarget();
  const resizer = new ResizeObserver(() => {
    layout();
    wake();
  });
  resizer.observe(canvas);
  layout();
  const onVisibility = () => (document.hidden ? sleep() : wake());
  document.addEventListener("visibilitychange", onVisibility);

  return {
    press() {
      const now = performance.now() / 1000;
      if (status === "playing") drop(now);
      else if (status === "idle" || now - overAt > RESTART_DELAY) start();
      wake();
    },
    setSound(on) {
      sound.enable(on);
    },
    run(on) {
      running = on;
      if (on) wake();
      else sleep();
    },
    destroy() {
      sleep();
      resizer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      sound.close();
    },
  };
}

const storage = {
  get(key: string) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Private mode or blocked storage: the game still works, it just
      // forgets the best score.
    }
  },
};

// Game state for the HTML around the canvas: status, score, the best score
// and sound preference kept in this browser, and the lion's reactions.
export function useStackGame(labels: readonly string[]) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lionRef = useRef<HTMLImageElement>(null);
  const gameRef = useRef<StackGame | null>(null);
  const [status, setStatus] = useState<StackStatus>("idle");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [sound, setSound] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (
      !stage ||
      !canvas ||
      !("ResizeObserver" in window) ||
      !("IntersectionObserver" in window)
    )
      return;
    let record = Number(storage.get("lp-stack-best")) || 0;
    const soundOn = storage.get("lp-stack-sound") !== "off";
    setBest(record);
    setSound(soundOn);
    const react = (mood: "cheer" | "oops") => {
      const lion = lionRef.current;
      if (!lion) return;
      lion.classList.remove("is-cheer", "is-oops");
      void lion.offsetWidth; // restart the CSS animation
      lion.classList.add(`is-${mood}`);
    };
    const game = createStackGame(canvas, labels, {
      onStart() {
        setStatus("playing");
        setScore(0);
      },
      onPlace(next, perfect) {
        setScore(next);
        if (perfect) react("cheer");
      },
      onOver(final) {
        setStatus("over");
        react("oops");
        if (final > record) {
          record = final;
          setBest(final);
          storage.set("lp-stack-best", String(final));
        }
      },
    });
    if (!game) return;
    game.setSound(soundOn);
    gameRef.current = game;
    setReady(true);
    const observer = new IntersectionObserver((entries) =>
      game.run(entries[entries.length - 1].isIntersecting),
    );
    observer.observe(stage);
    return () => {
      observer.disconnect();
      game.destroy();
      gameRef.current = null;
      setReady(false);
    };
  }, [labels]);

  const press = useCallback(() => gameRef.current?.press(), []);
  const toggleSound = useCallback(() => {
    const next = !sound;
    setSound(next);
    gameRef.current?.setSound(next);
    storage.set("lp-stack-sound", next ? "on" : "off");
  }, [sound]);

  return {
    stageRef,
    canvasRef,
    lionRef,
    status,
    score,
    best,
    sound,
    ready,
    press,
    toggleSound,
  };
}
