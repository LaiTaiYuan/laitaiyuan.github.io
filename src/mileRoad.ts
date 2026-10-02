import { useCallback, useEffect, useRef, useState } from "react";
import type { MileStop } from "./data/lastMile";

// 「我的人生最後一哩路」: the last mile is a road made of a music staff, five
// lines running to the horizon. Everyone on Leonard's list stands beside it:
// songs already written are a sculpture of glowing notes, one note head per
// song; people still waiting for theirs are a rest. Scrolling drives the camera
// in from the title, holds while the prologue is read, then stops at each
// person long enough to read their card, and the road ends in a sunrise.
// Canvas decoration only: the words are HTML, and without JavaScript or under
// reduced motion the page lays them out as cards with the same glyphs drawn
// in SVG (MileGlyph.tsx).

const TAU = Math.PI * 2;
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const ramp = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------------------
// Glyphs, in world units: origin on the ground under the glyph, y pointing
// down, about 3 units tall. Shared by the canvas and the static SVG.
// ---------------------------------------------------------------------------

export const HEAD = { rx: 0.34, ry: 0.25, tilt: -22 };

export function noteGlyph(songs: number) {
  const count = Math.max(1, songs);
  const lift = [0, 0.3, 0.12, 0.42];
  const heads = Array.from({ length: count }, (_, j) => ({
    x: (j - (count - 1) / 2) * 0.82 - 0.16,
    y: -(0.42 + (count > 1 ? lift[j % 4] : 0)),
  }));
  const stemX = heads.map((head) => head.x + 0.3);
  const top = (x: number) => -2.45 - (x - stemX[0]) * 0.1;
  const r = (v: number) => Math.round(v * 1000) / 1000;
  let body = heads
    .map((head, j) => {
      const x = stemX[j];
      const y = count > 1 ? top(x) : -2.35;
      return `M${r(x - 0.06)} ${r(y)}H${r(x + 0.06)}V${r(head.y - 0.02)}H${r(x - 0.06)}Z`;
    })
    .join("");
  if (count === 1) {
    const x = stemX[0] + 0.06;
    body += `M${r(x)} -2.35C${r(x + 0.06)} -1.9 ${r(x + 0.62)} -1.82 ${r(x + 0.5)} -1.1C${r(x + 0.44)} -1.5 ${r(x + 0.2)} -1.66 ${r(x)} -1.72Z`;
  } else {
    const x1 = stemX[0] - 0.06;
    const x2 = stemX[count - 1] + 0.06;
    for (const dy of count >= 4 ? [0, 0.4] : [0]) {
      const y1 = top(x1) + dy;
      const y2 = top(x2) + dy;
      body += `M${r(x1)} ${r(y1)}L${r(x2)} ${r(y2)}L${r(x2)} ${r(y2 + 0.24)}L${r(x1)} ${r(y1 + 0.24)}Z`;
    }
  }
  return { heads, body };
}

// A quarter rest standing on the ground.
export const REST =
  "M-0.34 -2.92L0.34 -2.08Q0.02 -1.84 -0.08 -1.58L0.4 -1.02Q-0.24 -1.12 -0.18 -0.64Q-0.14 -0.32 0.14 -0.02Q-0.52 -0.2 -0.56 -0.66Q-0.6 -1.22 0 -1.24L-0.44 -1.72Q-0.16 -1.98 -0.1 -2.24Z";

// ---------------------------------------------------------------------------
// The road
// ---------------------------------------------------------------------------

const GAP = 9; // world units between stops
const AHEAD = 6.2; // a stop sits this far ahead of the camera while it holds
const LEAD_IN = 20; // the title shot starts this much further back
const SUNRISE_VIEW = 12; // the last shot looks this far down to the road's end
const EYE = 1.3; // camera height
const NEAR = 0.6;
const FAR = 64;
const BAR = 3; // bar lines across the staff
const STAFF = [-2, -1, 0, 1, 2];

// The film's scenes, in scroll order: the title, the prologue (spoken while
// the camera flies in), one scene per stop, then the sunrise.
export const TITLE = 0;
export const PROLOGUE = 1;
export const sceneOfStop = (stop: number) => stop + 1;
export const sunriseScene = (stops: number) => stops + 2;

// Scroll progress (0..1) → position along the scenes (0..stops + 2). Each
// whole number holds the camera for half of its share of the scroll, long
// enough to read that scene.
export function scenePosition(progress: number, stops: number) {
  const last = sunriseScene(stops);
  const x = clamp(progress, 0, 1) * last;
  const whole = Math.min(Math.floor(x), last - 1);
  return whole + ramp(0.25, 0.75, x - whole);
}

type Mote = { x: number; y: number; z: number; phase: number };

export type MileRoad = {
  // Animate only while the film is on screen.
  run(on: boolean): void;
  // Scroll progress through the pinned film, 0..1.
  aim(progress: number): void;
  // Light up a stop's notes one after another.
  sing(stop: number): void;
  destroy(): void;
};

export function createMileRoad(
  canvas: HTMLCanvasElement,
  stops: readonly MileStop[],
): MileRoad | null {
  const context = canvas.getContext("2d");
  const stage = canvas.parentElement;
  if (!context || !stage) return null;
  const ctx: CanvasRenderingContext2D = context;
  const styles = getComputedStyle(canvas);
  const token = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;
  const tone = {
    note: token("--mile-note", "#ffbe23"),
    ink: token("--mile-ink", "#141414"),
    rest: token("--mile-rest", "#8bc8f4"),
    line: token("--mile-line", "#ffffff"),
    glow: token("--mile-glow", "255, 190, 35"),
    label: token("--mile-label", "#fff9eb"),
    font: token("--tb-body", "sans-serif"),
  };
  const glyphs = stops.map((stop) => {
    if (!stop.songs) return null;
    const { heads, body } = noteGlyph(stop.songs);
    return { heads, body: new Path2D(body) };
  });
  const rest = new Path2D(REST);
  const sunrise = sunriseScene(stops.length);
  // The road ends in the sunrise one stop past the last one.
  const end = (stops.length + 2) * GAP;
  // Where the camera holds in each scene: the title LEAD_IN back, the
  // prologue halfway in, each stop AHEAD before it, the sunrise well short of
  // the road's end so the finish line stays clear of the closing words.
  const holds = [
    -AHEAD - LEAD_IN,
    -AHEAD - LEAD_IN / 2,
    ...stops.map((_, i) => (i + 1) * GAP - AHEAD),
    end - SUNRISE_VIEW,
  ];

  let width = 0;
  let height = 0;
  let dpr = 1;
  let horizon = 0;
  let focal = 0;
  let lane = 1.45;
  let drift = 0.28;
  let portrait = false;
  const stars = Array.from({ length: 140 }, () => ({
    x: Math.random(),
    y: Math.random() ** 1.6,
    size: 0.5 + Math.random() * 1.3,
    phase: Math.random() * TAU,
  }));
  const motes: Mote[] = Array.from({ length: 70 }, () => ({
    x: (Math.random() - 0.5) * 9,
    y: Math.random() * 3.2,
    z: Math.random() * 34,
    phase: Math.random() * TAU,
  }));
  const singing = new Map<number, number>();
  let target = 0;
  let scene = 0; // eased position along the scenes
  let glide = 0; // the camera's sideways drift, before its gentle sway
  let camX = 0;
  let camVX = 0;
  let clock = 0;
  let frame = 0;
  let then = 0;
  let dawn = -1;
  let running = false;

  function layout() {
    const rect = stage!.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    portrait = height > width * 1.1;
    horizon = height * (portrait ? 0.4 : 0.44);
    focal = portrait ? width * 1.5 : height * 1.25;
    lane = portrait ? 0.5 : 1.45;
    drift = portrait ? 0.18 : 0.28;
    stage!.style.setProperty(
      "--mile-horizon",
      `${((horizon / height) * 100).toFixed(2)}%`,
    );
  }

  const side = (stop: number) => (stop % 2 ? 1 : -1);
  // The title shot starts LEAD_IN back, the prologue holds halfway in, and
  // from then on each scene is one stop further down the road.
  const camZ = () => {
    const at = clamp(scene, 0, holds.length - 1);
    const whole = Math.min(Math.floor(at), holds.length - 2);
    return holds[whole] + (holds[whole + 1] - holds[whole]) * (at - whole);
  };
  // World → screen; null when behind the near plane.
  function project(x: number, y: number, z: number) {
    const depth = z - camZ();
    if (depth < NEAR) return null;
    const scale = focal / depth;
    return {
      x: width / 2 + (x - camX) * scale,
      y: horizon + (EYE - y) * scale,
      scale,
      depth,
    };
  }
  const fog = (depth: number) =>
    ramp(NEAR, NEAR + 1.6, depth) * (1 - ramp(FAR * 0.5, FAR, depth));

  function drawStars(t: number) {
    ctx.fillStyle = tone.line;
    for (const star of stars) {
      const twinkle = 0.55 + 0.45 * Math.sin(t * 1.3 + star.phase);
      ctx.globalAlpha = 0.25 + 0.6 * twinkle * (1 - star.y * 0.6);
      const x = star.x * width - camX * 6;
      const y = star.y * horizon * 0.92;
      ctx.fillRect(x, y, star.size, star.size);
    }
    ctx.globalAlpha = 1;
  }

  // A strip painted flat on the road, x1..x2 across and z1..z2 along it;
  // leaves the path open for the caller to fill.
  function strip(x1: number, x2: number, z1: number, z2: number) {
    const a = project(x1, 0, z1);
    const b = project(x2, 0, z1);
    const c = project(x2, 0, z2);
    const d = project(x1, 0, z2);
    if (!a || !b || !c || !d) return null;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    return { near: a, far: d };
  }

  function drawStaff() {
    const cz = camZ();
    // Start where the road leaves the bottom of the screen.
    const near =
      cz + Math.max(NEAR + 0.05, ((EYE * focal) / (height - horizon)) * 0.9);
    const far = Math.min(cz + FAR, end);
    if (far <= near) return;
    for (const x of STAFF) {
      const path = strip(x - 0.035, x + 0.035, near, far);
      if (!path) continue;
      const gradient = ctx.createLinearGradient(
        path.near.x,
        path.near.y,
        path.far.x,
        path.far.y,
      );
      gradient.addColorStop(0, "rgba(255, 255, 255, 0.8)");
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = gradient;
      ctx.fill();
    }
    // Bar lines sweep towards the camera; every fourth one is a little
    // brighter, like the start of a phrase.
    ctx.fillStyle = tone.line;
    for (let k = Math.ceil(near / BAR); k * BAR < far; k++) {
      const z = k * BAR;
      ctx.globalAlpha = fog(z - cz) * (k % 4 ? 0.3 : 0.6);
      if (strip(-2.04, 2.04, z - 0.04, z + 0.04)) ctx.fill();
    }
    // The double bar where the road meets the sunrise.
    if (end - cz < FAR && end - 0.6 > near) {
      ctx.globalAlpha = fog(end - cz);
      if (strip(-2.04, 2.04, end - 0.6, end - 0.52)) ctx.fill();
      ctx.fillStyle = tone.note;
      if (strip(-2.04, 2.04, end - 0.34, end)) ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawNotes(index: number, t: number, alpha: number, active: boolean) {
    const glyph = glyphs[index];
    if (!glyph) return;
    // Halo behind the sculpture, brighter for the stop being read.
    ctx.globalCompositeOperation = "lighter";
    const halo = ctx.createRadialGradient(0, -1.5, 0.2, 0, -1.5, 2.6);
    const strength = (active ? 0.5 : 0.26) * alpha;
    halo.addColorStop(0, `rgba(${tone.glow}, ${strength})`);
    halo.addColorStop(1, `rgba(${tone.glow}, 0)`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, -1.5, 2.6, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 0.07;
    ctx.lineJoin = "round";
    ctx.strokeStyle = tone.ink;
    ctx.fillStyle = tone.note;
    ctx.fill(glyph.body);
    ctx.stroke(glyph.body);
    const sang = singing.get(index + 1);
    glyph.heads.forEach((head, j) => {
      const flash =
        sang === undefined
          ? 0
          : Math.max(0, 1 - Math.abs(t - sang - j * 0.18 - 0.08) / 0.16);
      const grow = 1 + flash * 0.18;
      ctx.beginPath();
      ctx.ellipse(
        head.x,
        head.y,
        HEAD.rx * grow,
        HEAD.ry * grow,
        (HEAD.tilt * Math.PI) / 180,
        0,
        TAU,
      );
      ctx.fillStyle = flash > 0.05 ? "#ffffff" : tone.note;
      ctx.fill();
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  function drawRest(t: number, alpha: number, active: boolean) {
    const breath = active ? 0.75 + 0.25 * Math.sin(t * 2.2) : 0.55;
    ctx.globalAlpha = alpha * breath;
    ctx.lineWidth = 0.07;
    ctx.lineJoin = "round";
    ctx.strokeStyle = tone.rest;
    ctx.fillStyle = "rgba(139, 200, 244, 0.14)";
    ctx.fill(rest);
    ctx.stroke(rest);
    ctx.globalAlpha = 1;
  }

  function drawStops(t: number, active: number, reading: number) {
    // Far to near, so nearer sculptures cover farther ones.
    for (let i = stops.length; i >= 1; i--) {
      const z = i * GAP;
      const base = project(side(i) * lane, 0, z);
      if (!base || base.depth > FAR) continue;
      // Dimmer while the prologue is being read over them.
      const alpha =
        fog(base.depth) *
        (0.4 + 0.6 * ramp(PROLOGUE + 0.3, PROLOGUE + 0.8, scene));
      if (alpha <= 0.01) continue;
      // Sculptures rise out of the road as they come within reach.
      const rise = ramp(FAR * 0.95, FAR * 0.55, base.depth);
      ctx.save();
      ctx.translate(base.x, base.y);
      ctx.scale(base.scale, base.scale * rise);
      if (stops[i - 1].songs) drawNotes(i - 1, t, alpha, i === active);
      else drawRest(t, alpha, i === active);
      ctx.restore();
      // A small name under every stop but the one whose card is up.
      if (scene > PROLOGUE + 0.7 && i !== reading && base.depth > AHEAD + 1.5) {
        const size = clamp(0.34 * base.scale, 0, 24);
        if (size >= 9) {
          ctx.globalAlpha = alpha * 0.8;
          ctx.font = `700 ${size.toFixed(1)}px ${tone.font}`;
          ctx.textAlign = "center";
          ctx.fillStyle = tone.label;
          ctx.fillText(stops[i - 1].who, base.x, base.y + size * 1.4);
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  function drawMotes(t: number, dt: number) {
    const cz = camZ();
    ctx.fillStyle = tone.note;
    for (const mote of motes) {
      mote.y += dt * 0.22;
      if (mote.y > 3.4) mote.y -= 3.4;
      while (mote.z < cz + NEAR) mote.z += 34;
      while (mote.z > cz + 34 + NEAR) mote.z -= 34;
      const point = project(mote.x, mote.y, mote.z);
      if (!point) continue;
      const twinkle = 0.5 + 0.5 * Math.sin(t * 2.4 + mote.phase);
      ctx.globalAlpha = fog(point.depth) * (0.25 + 0.55 * twinkle);
      const radius = clamp(0.03 * point.scale, 0.7, 12);
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function draw(dt: number) {
    const t = clock;
    // The camera eases after the scroll, glides towards the side of the
    // nearest stop and banks a touch while it does.
    scene += (target - scene) * (1 - Math.exp(-dt * 5));
    const reading = Math.round(scene) - 1; // the stop whose card is up
    const toX =
      reading >= 1 && reading <= stops.length ? side(reading) * drift : 0;
    const nextGlide = glide + (toX - glide) * (1 - Math.exp(-dt * 2.2));
    camVX = dt > 0 ? (nextGlide - glide) / dt : 0;
    glide = nextGlide;
    camX = glide + Math.sin(t * 0.6) * 0.04;
    const active = Math.abs(scene - Math.round(scene)) < 0.3 ? reading : -1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(width / 2, horizon);
    ctx.rotate(clamp(-camVX * 0.05, -0.035, 0.035));
    ctx.translate(-width / 2, -horizon);
    drawStars(t);
    drawStaff();
    drawStops(t, active, reading);
    drawMotes(t, dt);
    ctx.restore();
    // The sky behind the canvas brightens into the sunrise near the end.
    const glow = Math.round(ramp(sunrise - 1.4, sunrise, scene) * 200) / 200;
    if (glow !== dawn) {
      dawn = glow;
      stage!.style.setProperty("--mile-dawn", String(glow));
    }
  }

  function tick(now: number) {
    frame = 0;
    const dt = then ? clamp((now - then) / 1000, 0, 1 / 20) : 0;
    then = now;
    clock += dt;
    draw(dt);
    frame = requestAnimationFrame(tick);
  }
  function wake() {
    if (!running || frame || document.hidden) return;
    then = 0;
    frame = requestAnimationFrame(tick);
  }
  function sleep() {
    cancelAnimationFrame(frame);
    frame = 0;
  }

  let resizeTimer = 0;
  const resizer = new ResizeObserver(() => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      layout();
      draw(0);
    }, 120);
  });
  resizer.observe(stage);
  const onVisibility = () => (document.hidden ? sleep() : wake());
  document.addEventListener("visibilitychange", onVisibility);
  layout();

  return {
    run(on) {
      running = on;
      if (on) wake();
      else sleep();
    },
    aim(progress) {
      target = scenePosition(progress, stops.length);
    },
    sing(stop) {
      singing.set(stop, clock);
    },
    destroy() {
      sleep();
      window.clearTimeout(resizeTimer);
      resizer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    },
  };
}

// ---------------------------------------------------------------------------
// Sound: a soft triangle-wave chime, only after the visitor turns it on.
// Each finished stop plays one note per song on a pentatonic scale; rests
// stay silent; the sunrise plays a chord.
// ---------------------------------------------------------------------------

const SCALE = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84];
const SHAPE = [0, 2, 1, 3];

function motif(stop: number, songs: number) {
  return Array.from(
    { length: songs },
    (_, j) => SCALE[(stop * 2 + SHAPE[j % 4]) % (SCALE.length - 3)],
  );
}

function createChime() {
  let audio: AudioContext | null = null;
  const pluck = (midi: number, at: number, level: number) => {
    if (!audio) return;
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(level, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.6);
    gain.connect(audio.destination);
    for (const [type, ratio, share] of [
      ["triangle", 1, 1],
      ["sine", 2, 0.3],
    ] as const) {
      const oscillator = audio.createOscillator();
      const blend = audio.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency * ratio;
      blend.gain.value = share;
      oscillator.connect(blend).connect(gain);
      oscillator.start(at);
      oscillator.stop(at + 1.7);
    }
  };
  return {
    enable() {
      audio ??= new AudioContext();
      void audio.resume();
    },
    disable() {
      void audio?.suspend();
    },
    play(notes: number[], gap = 0.18, level = 0.12) {
      if (!audio || audio.state !== "running") return;
      const start = audio.currentTime + 0.03;
      notes.forEach((midi, i) => pluck(midi, start + i * gap, level));
    },
    close() {
      void audio?.close();
      audio = null;
    },
  };
}

// Pins the film while it scrolls past: scroll progress moves the camera and
// picks the scene (title, prologue, each stop, sunrise); the odometer shows
// how much of the mile has been travelled.
export function useLastMile(stops: readonly MileStop[]) {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const odometerRef = useRef<HTMLElement>(null);
  const roadRef = useRef<MileRoad | null>(null);
  const chimeRef = useRef<ReturnType<typeof createChime> | null>(null);
  const soundRef = useRef(false);
  const [scene, setScene] = useState(TITLE);
  const [live, setLive] = useState(false);
  const [sound, setSound] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (
      !section ||
      !canvas ||
      !("IntersectionObserver" in window) ||
      !("ResizeObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const road = createMileRoad(canvas, stops);
    if (!road) return;
    roadRef.current = road;
    chimeRef.current = createChime();
    setLive(true);
    let current = 0;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = section.getBoundingClientRect();
        const travel = rect.height - window.innerHeight;
        const progress = travel > 0 ? clamp(-rect.top / travel, 0, 1) : 0;
        road.aim(progress);
        if (odometerRef.current)
          odometerRef.current.textContent = progress.toFixed(2);
        const next = Math.round(scenePosition(progress, stops.length));
        if (next === current) return;
        current = next;
        setScene(next);
        const stop = next - 1;
        if (stop >= 1 && stop <= stops.length) {
          road.sing(stop);
          if (soundRef.current && stops[stop - 1].songs)
            chimeRef.current?.play(motif(stop, stops[stop - 1].songs));
        } else if (next === sunriseScene(stops.length) && soundRef.current) {
          chimeRef.current?.play([60, 64, 67, 72, 76], 0.12, 0.09);
        }
      });
    };
    const observer = new IntersectionObserver((entries) =>
      road.run(entries[entries.length - 1].isIntersecting),
    );
    observer.observe(section);
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      road.destroy();
      roadRef.current = null;
      chimeRef.current?.close();
      chimeRef.current = null;
      setLive(false);
    };
  }, [stops]);

  // Scroll to where the camera holds at a scene.
  const goTo = useCallback(
    (index: number) => {
      const section = sectionRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      if (travel <= 0) return;
      window.scrollTo({
        top:
          window.scrollY +
          rect.top +
          (index / sunriseScene(stops.length)) * travel,
        behavior: "smooth",
      });
    },
    [stops.length],
  );

  const toggleSound = useCallback(() => {
    const on = !soundRef.current;
    soundRef.current = on;
    setSound(on);
    const chime = chimeRef.current;
    if (!chime) return;
    if (!on) return chime.disable();
    chime.enable();
    const stop = scene - 1;
    const here = stops[stop - 1];
    if (here?.songs) {
      // Let the context start before the first notes.
      window.setTimeout(() => chime.play(motif(stop, here.songs)), 60);
      roadRef.current?.sing(stop);
    }
  }, [scene, stops]);

  return {
    sectionRef,
    canvasRef,
    odometerRef,
    scene,
    live,
    sound,
    goTo,
    toggleSound,
  };
}
