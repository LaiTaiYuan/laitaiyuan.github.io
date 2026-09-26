import { useCallback, useEffect, useRef, useState } from "react";

// Halftone story: a canvas of comic-print dots that gathers into one big
// glyph per chapter as the section scrolls, scatters away from the pointer and
// bursts on a click or tap. The chapter copy stays plain HTML (the canvas is
// decoration); the dots only animate while the stage is on screen, and never
// under reduced motion, where the CSS shows static halftone glyphs instead.

const TAU = Math.PI * 2;
const DUST = 255;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

// Lays a glyph onto a hexagonal halftone screen: one target per cell with a
// radius from its ink coverage, so edges and the lighter corner of the
// diagonal shading get smaller dots, like a printed comic panel. Returns
// [x, y, radius] triples in canvas pixels.
function sampleGlyph(
  glyph: string,
  box: DOMRect,
  stage: DOMRect,
  step: number,
  family: string,
) {
  const w = Math.max(1, Math.round(box.width));
  const h = Math.max(1, Math.round(box.height));
  const scratch = document.createElement("canvas");
  scratch.width = w;
  scratch.height = h;
  const g = scratch.getContext("2d", { willReadFrequently: true });
  if (!g) return new Float32Array(0);
  const measure = (size: number) => {
    g.font = `900 ${size}px ${family}`;
    const m = g.measureText(glyph);
    return {
      m,
      bw: m.actualBoundingBoxLeft + m.actualBoundingBoxRight || 1,
      bh: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent || 1,
    };
  };
  const first = measure(Math.min(w, h));
  const { m, bw, bh } = measure(
    Math.min(w, h) * Math.min((w * 0.96) / first.bw, (h * 0.96) / first.bh),
  );
  const shade = g.createLinearGradient(0, h, w, 0);
  shade.addColorStop(0, "#000");
  shade.addColorStop(1, "rgba(0, 0, 0, 0.28)");
  g.fillStyle = shade;
  g.fillText(
    glyph,
    (w - bw) / 2 + m.actualBoundingBoxLeft,
    (h - bh) / 2 + m.actualBoundingBoxAscent,
  );
  const ink = g.getImageData(0, 0, w, h).data;
  const alpha = (x: number, y: number) =>
    ink[
      (clamp(Math.round(y), 0, h - 1) * w + clamp(Math.round(x), 0, w - 1)) *
        4 +
        3
    ];
  const points: number[] = [];
  const offsetX = box.left - stage.left;
  const offsetY = box.top - stage.top;
  const rowStep = step * 0.866;
  const reach = step * 0.3;
  for (let row = 0, y = rowStep / 2; y < h; row++, y += rowStep) {
    for (let x = row % 2 ? step : step / 2; x < w; x += step) {
      let sum = 0;
      for (let sy = -1; sy <= 1; sy++)
        for (let sx = -1; sx <= 1; sx++)
          sum += alpha(x + sx * reach, y + sy * reach);
      const cover = sum / (9 * 255);
      if (cover > 0.12)
        points.push(offsetX + x, offsetY + y, step * 0.5 * Math.sqrt(cover));
    }
  }
  return Float32Array.from(points);
}

function shuffled(count: number) {
  const order = new Uint32Array(count);
  for (let i = 0; i < count; i++) order[i] = i;
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = order[i];
    order[i] = order[j];
    order[j] = swap;
  }
  return order;
}

export type StoryDots = {
  // Gather the dots into a chapter's glyph (morphing from the current one).
  show(chapter: number): void;
  // Drop back to loose dust at once, so the next show() gathers from scratch.
  scatter(): void;
  // Animate only while the stage is visible.
  run(on: boolean): void;
  destroy(): void;
};

export function createStoryDots(
  canvas: HTMLCanvasElement,
  glyphBox: HTMLElement,
  glyphs: readonly string[],
): StoryDots | null {
  const context = canvas.getContext("2d");
  const stage = canvas.parentElement;
  if (!context || !stage) return null;
  const ctx: CanvasRenderingContext2D = context;
  const styles = getComputedStyle(canvas);
  const token = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;
  const tones = glyphs.map((_, i) => token(`--dot-${i}`, "#ffbe23"));
  const spark = token("--dot-spark", "#ffffff");
  const shadow = token("--dot-shadow", "#405ada");
  const dust = token("--dot-dust", "#8bc8f4");

  // Particle state in flat arrays: position, velocity, target, radius, a
  // start delay (frames), a per-dot phase, the radius drawn this frame and
  // the tone (chapter or DUST).
  let n = 0;
  let x = new Float32Array(0);
  let y = new Float32Array(0);
  let vx = new Float32Array(0);
  let vy = new Float32Array(0);
  let tx = new Float32Array(0);
  let ty = new Float32Array(0);
  let tr = new Float32Array(0);
  let r = new Float32Array(0);
  let wait = new Float32Array(0);
  let phase = new Float32Array(0);
  let size = new Float32Array(0);
  let tone = new Uint8Array(0);

  let width = 0;
  let height = 0;
  let dpr = 1;
  let step = 8;
  let sizeKey = "";
  let centerX = 0;
  let centerY = 0;
  let targets: Float32Array[] = [];
  let chapter: number | null = null;
  let pending: number | null = null;
  let order = new Uint32Array(0);
  const rings: { x: number; y: number; born: number }[] = [];
  const pointer = { x: 0, y: 0, on: false };
  let frame = 0;
  let last = 0;
  let running = false;

  function toDust(i: number, jump: boolean) {
    tone[i] = DUST;
    tx[i] = Math.random() * width;
    ty[i] = Math.random() * height;
    tr[i] = 0.5 + Math.random() * 1.1;
    wait[i] = 0;
    if (!jump) return;
    x[i] = tx[i];
    y[i] = ty[i];
    r[i] = tr[i];
    vx[i] = 0;
    vy[i] = 0;
  }

  function grow(count: number) {
    if (count <= n) return;
    const more = (a: Float32Array) => {
      const b = new Float32Array(count);
      b.set(a);
      return b;
    };
    x = more(x);
    y = more(y);
    vx = more(vx);
    vy = more(vy);
    tx = more(tx);
    ty = more(ty);
    tr = more(tr);
    r = more(r);
    wait = more(wait);
    phase = more(phase);
    size = more(size);
    const grown = new Uint8Array(count);
    grown.set(tone);
    tone = grown;
    for (let i = n; i < count; i++) {
      phase[i] = Math.random() * TAU;
      toDust(i, true);
    }
    n = count;
  }

  // Aim every dot at the chapter's glyph; the rest drift around as dust.
  // `order` pairs dots with targets and is kept on relayout, so a resize
  // reshapes the glyph smoothly instead of reshuffling it.
  function assign(next: number, morph: boolean, keepOrder = false) {
    const from = chapter;
    chapter = next;
    const glyph = targets[next];
    const count = Math.min(n, glyph.length / 3);
    if (!keepOrder || order.length !== n) order = shuffled(n);
    for (let k = 0; k < n; k++) {
      const i = order[k];
      if (k >= count) {
        if (tone[i] !== DUST) toDust(i, false);
        continue;
      }
      tx[i] = glyph[k * 3];
      ty[i] = glyph[k * 3 + 1];
      tr[i] = glyph[k * 3 + 2];
      if (keepOrder) {
        tone[i] = next;
        continue;
      }
      if (from === null) {
        // The first gathering blooms out from the middle of the glyph.
        wait[i] =
          Math.hypot(tx[i] - centerX, ty[i] - centerY) * 0.09 +
          Math.random() * 10;
      } else {
        wait[i] = Math.random() * 12;
        if (morph && tone[i] !== DUST) {
          // Burst outwards with a twist, then swirl into the new glyph.
          const dx = x[i] - centerX;
          const dy = y[i] - centerY;
          const d = Math.hypot(dx, dy) || 1;
          const kick = 2 + Math.random() * 4.5;
          vx[i] += (dx / d) * kick - (dy / d) * 2.6;
          vy[i] += (dy / d) * kick + (dx / d) * 2.6;
        }
      }
      tone[i] = next;
    }
  }

  function layout(force = false) {
    const stageRect = canvas.getBoundingClientRect();
    // The glyph fills the box's content area; its padding stays clear (the
    // hint sits there).
    const box = glyphBox.getBoundingClientRect();
    const style = getComputedStyle(glyphBox);
    const pad = (side: string) =>
      parseFloat(style.getPropertyValue(`padding-${side}`)) || 0;
    const boxRect = new DOMRect(
      box.left + pad("left"),
      box.top + pad("top"),
      Math.max(0, box.width - pad("left") - pad("right")),
      Math.max(0, box.height - pad("top") - pad("bottom")),
    );
    const key = [
      stageRect.width,
      stageRect.height,
      boxRect.left - stageRect.left,
      boxRect.top - stageRect.top,
      boxRect.width,
      boxRect.height,
      window.devicePixelRatio,
    ].join();
    if (!force && key === sizeKey) return;
    sizeKey = key;
    width = stageRect.width;
    height = stageRect.height;
    if (!width || !height || !boxRect.width || !boxRect.height) {
      width = 0;
      return;
    }
    // Sharp on retina screens, but at most ~8 megapixels on very large ones.
    dpr = Math.min(
      window.devicePixelRatio || 1,
      2,
      Math.sqrt(8e6 / (width * height)),
    );
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    step = clamp(Math.min(boxRect.width, boxRect.height) / 52, 6, 11);
    centerX = boxRect.left - stageRect.left + boxRect.width / 2;
    centerY = boxRect.top - stageRect.top + boxRect.height / 2;
    const family = style.fontFamily;
    targets = glyphs.map((glyph) =>
      sampleGlyph(glyph, boxRect, stageRect, step, family),
    );
    const spare = Math.round(clamp((width * height) / 2400, 120, 480));
    grow(Math.max(...targets.map((glyph) => glyph.length / 3)) + spare);
    if (pending !== null) {
      const next = pending;
      pending = null;
      assign(next, false);
    } else if (chapter !== null) {
      assign(chapter, false, true);
    } else {
      for (let i = 0; i < n; i++) toDust(i, true);
    }
  }

  function burst(px: number, py: number, now: number) {
    const reach = Math.max(width, height) * 0.3;
    for (let i = 0; i < n; i++) {
      const dx = x[i] - px;
      const dy = y[i] - py;
      const d = Math.hypot(dx, dy);
      if (d >= reach || d < 0.01) continue;
      const force = (1 - d / reach) ** 1.6 * 15;
      vx[i] += (dx / d) * force;
      vy[i] += (dy / d) * force;
    }
    rings.push({ x: px, y: py, born: now });
  }

  function physics(dt: number, time: number) {
    const reach = Math.max(70, Math.min(width, height) * 0.13);
    const reach2 = reach * reach;
    const inkDamping = Math.pow(0.86, dt);
    const dustDamping = Math.pow(0.95, dt);
    const settle = Math.min(1, 0.12 * dt);
    for (let i = 0; i < n; i++) {
      const loose = tone[i] === DUST;
      let ax = 0;
      let ay = 0;
      if (wait[i] > 0) {
        wait[i] -= dt;
      } else {
        const dx = tx[i] - x[i];
        const dy = ty[i] - y[i];
        const pull = loose ? 0.004 : 0.022;
        ax = dx * pull;
        ay = dy * pull;
        // Curl the paths while travelling; fades out near the target.
        const far = loose
          ? 0
          : Math.min(1, (Math.abs(dx) + Math.abs(dy)) / 180);
        if (far > 0.02) {
          ax += Math.sin(y[i] * 0.012 + time * 1.3 + phase[i]) * 0.55 * far;
          ay += Math.cos(x[i] * 0.012 + time * 1.1 + phase[i]) * 0.55 * far;
        }
        r[i] += (tr[i] - r[i]) * settle;
      }
      if (loose) {
        ax += Math.sin(time * 0.7 + phase[i]) * 0.02;
        ay += Math.cos(time * 0.6 + phase[i] * 1.3) * 0.02;
      }
      if (pointer.on) {
        const dx = x[i] - pointer.x;
        const dy = y[i] - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < reach2 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const push = (1 - d / reach) ** 2 * 2.8;
          ax += (dx / d) * push;
          ay += (dy / d) * push;
        }
      }
      const damping = loose ? dustDamping : inkDamping;
      vx[i] = (vx[i] + ax * dt) * damping;
      vy[i] = (vy[i] + ay * dt) * damping;
      x[i] += vx[i] * dt;
      y[i] += vy[i] * dt;
      // A slow shimmer runs across the inked dots.
      size[i] = loose
        ? r[i]
        : r[i] * (1 + 0.1 * Math.sin(time * 2.6 - (x[i] + y[i]) * 0.018));
    }
  }

  function draw(time: number) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    // One path per colour, each dot added once: dust, inked dots by chapter
    // tone, and dots moving fast as white sparks.
    const inks = tones.map(() => new Path2D());
    const sparks = new Path2D();
    const motes = new Path2D();
    for (let i = 0; i < n; i++) {
      const path =
        tone[i] === DUST
          ? motes
          : vx[i] * vx[i] + vy[i] * vy[i] > 6
            ? sparks
            : inks[tone[i]];
      path.moveTo(x[i] + size[i], y[i]);
      path.arc(x[i], y[i], size[i], 0, TAU);
    }
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = dust;
    ctx.fill(motes);
    ctx.globalAlpha = 1;
    // Blue misregistration under the inked dots, like an off-register print.
    const offset = Math.max(1.5, step * 0.24);
    ctx.translate(offset, offset);
    ctx.fillStyle = shadow;
    for (const path of inks) ctx.fill(path);
    ctx.fill(sparks);
    ctx.translate(-offset, -offset);
    inks.forEach((path, c) => {
      ctx.fillStyle = tones[c];
      ctx.fill(path);
    });
    ctx.fillStyle = spark;
    ctx.fill(sparks);
    const reach = Math.max(width, height) * 0.3;
    ctx.strokeStyle = spark;
    for (let k = rings.length - 1; k >= 0; k--) {
      const age = (time - rings[k].born) / 0.7;
      if (age >= 1 || age < 0) {
        rings.splice(k, 1);
        continue;
      }
      ctx.globalAlpha = 0.85 * (1 - age);
      ctx.lineWidth = 1.5 + 3 * (1 - age);
      ctx.beginPath();
      ctx.arc(
        rings[k].x,
        rings[k].y,
        12 + (1 - (1 - age) ** 3) * reach,
        0,
        TAU,
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function tick(now: number) {
    frame = 0;
    if (!width) return;
    const dt = last ? clamp((now - last) / (1000 / 60), 0.25, 2.5) : 1;
    last = now;
    physics(dt, now / 1000);
    draw(now / 1000);
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

  let resizeTimer = 0;
  const resizer = new ResizeObserver(() => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      layout();
      wake();
    }, 120);
  });
  resizer.observe(canvas);
  resizer.observe(glyphBox);
  layout(true);
  // Sample again once the display face has loaded (the first pass may use a
  // fallback font); the dots simply reshape into the real glyph.
  document.fonts
    ?.load(`900 64px ${getComputedStyle(glyphBox).fontFamily}`, glyphs.join(""))
    .then(() => layout(true))
    .catch(() => {});

  const locate = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
  };
  const onMove = (event: PointerEvent) => {
    locate(event);
    pointer.on = true;
  };
  const onLeave = () => {
    pointer.on = false;
  };
  const onUp = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") pointer.on = false;
  };
  const onDown = (event: PointerEvent) => {
    if ((event.target as Element).closest("a, button")) return;
    locate(event);
    burst(pointer.x, pointer.y, performance.now() / 1000);
    wake();
  };
  const onVisibility = () => (document.hidden ? sleep() : wake());
  stage.addEventListener("pointermove", onMove, { passive: true });
  stage.addEventListener("pointerdown", onDown, { passive: true });
  stage.addEventListener("pointerup", onUp, { passive: true });
  stage.addEventListener("pointerleave", onLeave);
  stage.addEventListener("pointercancel", onLeave);
  document.addEventListener("visibilitychange", onVisibility);

  return {
    show(next) {
      if (next === chapter) return;
      if (!targets.length || !width) {
        pending = next;
        return;
      }
      assign(next, chapter !== null);
      wake();
    },
    scatter() {
      chapter = null;
      pending = null;
      rings.length = 0;
      for (let i = 0; i < n; i++) toDust(i, true);
    },
    run(on) {
      running = on;
      if (on) wake();
      else sleep();
    },
    destroy() {
      sleep();
      window.clearTimeout(resizeTimer);
      resizer.disconnect();
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("pointerup", onUp);
      stage.removeEventListener("pointerleave", onLeave);
      stage.removeEventListener("pointercancel", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    },
  };
}

// Pins the story stage while the section scrolls past: scroll progress picks
// the chapter (and --story-progress for the progress bar), the dots gather
// once the stage is a third on screen and scatter again once it has left.
export function useStoryDots(glyphs: readonly string[]) {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glyphRef = useRef<HTMLDivElement>(null);
  const [chapter, setChapter] = useState(0);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    const glyphBox = glyphRef.current;
    const stage = canvas?.parentElement;
    if (
      !section ||
      !canvas ||
      !glyphBox ||
      !stage ||
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    // Chapters follow the scroll even if the canvas cannot run; the CSS
    // halftone glyph then stands in for the dots.
    const dots =
      "ResizeObserver" in window
        ? createStoryDots(canvas, glyphBox, glyphs)
        : null;
    if (dots) setLive(true);
    let current = 0;
    let gathered = false;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = section.getBoundingClientRect();
        const travel = rect.height - window.innerHeight;
        const progress = travel > 0 ? clamp(-rect.top / travel, 0, 1) : 0;
        section.style.setProperty("--story-progress", progress.toFixed(4));
        const next = Math.min(
          glyphs.length - 1,
          Math.floor(progress * glyphs.length),
        );
        if (next === current) return;
        current = next;
        setChapter(next);
        if (gathered) dots?.show(next);
      });
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (!dots) return;
        const entry = entries[entries.length - 1];
        if (!entry.isIntersecting) {
          dots.run(false);
          dots.scatter();
          gathered = false;
          return;
        }
        dots.run(true);
        if (!gathered && entry.intersectionRatio >= 0.34) {
          gathered = true;
          dots.show(current);
        }
      },
      { threshold: [0, 0.35] },
    );
    observer.observe(stage);
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      dots?.destroy();
      setLive(false);
    };
  }, [glyphs]);

  // Scroll to the middle of a chapter's stretch of the pinned section.
  const goTo = useCallback(
    (index: number) => {
      const section = sectionRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      if (travel <= 0) return;
      window.scrollTo({
        top:
          window.scrollY + rect.top + ((index + 0.5) / glyphs.length) * travel,
        behavior: "smooth",
      });
    },
    [glyphs.length],
  );

  return { sectionRef, canvasRef, glyphRef, chapter, live, goTo };
}
