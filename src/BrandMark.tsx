import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { brandMark, brandMarkSmall } from "./data/brandMark";
import type { BrandMarkPaths } from "./data/brandMark";

/** 靜態品牌符號：頁首徽章、停用 JavaScript 與減少動態效果時的完成畫面。 */
export function BrandSymbol({
  small = false,
  className,
}: {
  small?: boolean;
  className?: string;
}) {
  const m = small ? brandMarkSmall : brandMark;
  return (
    <svg
      className={className}
      viewBox={m.viewBox.join(" ")}
      aria-hidden="true"
      focusable="false"
    >
      <path className="lm-mountain" d={m.mountain} />
      <path className="lm-face" d={m.face} />
      <path className="lm-l" d={m.l} />
      <path className="lm-wand" d={m.wand} />
      <path className="lm-star" d={m.star} />
      {m.spark && <path className="lm-star" d={m.spark} />}
    </svg>
  );
}

type Part = "l" | "mountain" | "wand" | "star";

/** 拆解說明旁的小圖示：只畫出符號的其中一個部件。 */
function PartIcon({ part }: { part: Part }) {
  const m = brandMark;
  return (
    <svg
      className="lp-mark-part-icon"
      viewBox={m.boxes[part].join(" ")}
      aria-hidden="true"
      focusable="false"
    >
      {part === "l" && <path className="lm-l" d={m.l} />}
      {part === "mountain" && (
        <>
          <path className="lm-mountain" d={m.mountain} />
          <path className="lm-face" d={m.face} />
        </>
      )}
      {part === "wand" && <path className="lm-wand" d={m.wand} />}
      {part === "star" && (
        <>
          <path className="lm-star" d={m.star} />
          <path className="lm-star" d={m.spark} />
        </>
      )}
    </svg>
  );
}

const parts: { part: Part; name: string; text: string }[] = [
  {
    part: "l",
    name: "L",
    text: "賴，也是 Leonard。中文姓和英文名都從 L 開始，它從下方托住整個舞台。",
  },
  {
    part: "mountain",
    name: "山",
    text: "泰山的「泰」，也是 A。山腳留一條路，讓想法能落地。",
  },
  {
    part: "wand",
    name: "魔法棒",
    text: "I，也是「我」。小時候想當導演，相信揮一下，故事就會開演。",
  },
  {
    part: "star",
    name: "星",
    text: "i 的那一點，也是「元」：第一道光。旁邊的小光，是 AI 放大能力時迸出的火花。",
  },
];

/** 揮棒時從星星噴出的碎星：方向與距離固定，伺服器與瀏覽器輸出一致。 */
function burstPieces(m: BrandMarkPaths) {
  const [cx, cy] = m.starCenter;
  return Array.from({ length: 10 }, (_, i) => {
    const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const distance = i % 2 ? 54 : 78;
    const r = i % 2 ? 4.5 : 7;
    const c = r * 0.2;
    return {
      d: `M${cx} ${cy - r}C${cx + c} ${cy - c} ${cx + c} ${cy - c} ${cx + r} ${cy}C${cx + c} ${cy + c} ${cx + c} ${cy + c} ${cx} ${cy + r}C${cx - c} ${cy + c} ${cx - c} ${cy + c} ${cx - r} ${cy}C${cx - c} ${cy - c} ${cx - c} ${cy - c} ${cx} ${cy - r}Z`,
      style: {
        "--dx": `${Math.round(Math.cos(angle) * distance)}px`,
        "--dy": `${Math.round(Math.sin(angle) * distance)}px`,
        "--delay": `${(i % 3) * 0.04}s`,
      } as CSSProperties,
      gold: i % 3 !== 1,
    };
  });
}

// 漫畫爆炸框：12 個尖角，中心在 (cx, cy)
function burstShape(cx: number, cy: number, outer: number, inner: number) {
  const points = Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * Math.PI * 2;
    const r = i % 2 ? inner : outer * (i % 4 === 0 ? 1 : 0.9);
    return `${Math.round((cx + Math.cos(angle) * r * 1.6) * 10) / 10},${Math.round((cy + Math.sin(angle) * r) * 10) / 10}`;
  });
  return points.join(" ");
}

type Phase = "static" | "armed" | "playing" | "done";

// 整段演出約 4.2 秒；之後只剩星星偶爾眨眼、魔法棒輕輕晃。
const SHOW_MS = 4300;

export function BrandStorySection() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("static");
  const [run, setRun] = useState(0);
  const [inView, setInView] = useState(false);
  const m = brandMark;
  const [vx, vy, vw, vh] = m.viewBox;

  // 進入畫面才開演；減少動態效果或不支援時保留靜態完成畫面
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !("IntersectionObserver" in window)) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setPhase("armed");
    let started = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (!started && entry.intersectionRatio >= 0.45) {
          started = true;
          setPhase("playing");
        }
      },
      { threshold: [0, 0.45] },
    );
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    const timer = window.setTimeout(() => setPhase("done"), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [phase, run]);

  const replay = () => {
    setRun((value) => value + 1);
    setPhase("playing");
  };

  // 舞台比符號大：上方留給爆炸框與碎星，四周留給跳躍與揮棒
  const pad = 70;
  const viewBox = `${vx - pad} ${vy - pad - 30} ${vw + pad * 2} ${vh + pad * 2 + 10}`;
  const [sx, sy] = m.starCenter;
  const pieces = burstPieces(m);

  return (
    <section
      className="lp-section lp-mark"
      id="mark"
      aria-labelledby="mark-title"
    >
      <div className="lp-container lp-mark-grid">
        <div className="lp-mark-copy">
          <div data-reveal="blur">
            <p className="lp-eyebrow">BRAND MARK · L + A + I</p>
            <h2 id="mark-title">
              一個 L、一座山、
              <br />
              一根魔法棒，
              <br />
              就是 <span className="lp-underline">LAI。</span>
            </h2>
          </div>
          <p data-reveal="">
            小時候，我想當導演。現在用程式、AI
            和音樂說故事，其實還在揮那根魔法棒。這個符號就是我的名字
            LAI，也把賴、泰、元三個字收在一起。
          </p>
          <dl className="lp-mark-parts" data-reveal="">
            {parts.map((item) => (
              <div key={item.part}>
                <dt>
                  <PartIcon part={item.part} />
                  {item.name}
                </dt>
                <dd>{item.text}</dd>
              </div>
            ))}
          </dl>
          <p className="lp-mark-tagline" data-reveal="">
            AI 放大能力，故事留下溫度。
          </p>
        </div>
        <div
          className="lp-mark-stage"
          ref={stageRef}
          data-phase={phase}
          data-inview={inView || undefined}
        >
          <div className="lp-mark-spot" aria-hidden="true" />
          <svg
            key={run}
            className="lp-mark-svg"
            viewBox={viewBox}
            role="img"
            aria-label="賴泰元的品牌符號：L、一座山、一根魔法棒和棒尖的星，拼成 LAI"
          >
            <ellipse
              className="lm-floor"
              cx={vx + vw / 2}
              cy={vy + vh + 14}
              rx={vw * 0.62}
              ry="9"
            />
            <g className="lm-hop lm-hop-l">
              <g className="lm-part lm-l-in">
                <path className="lm-l" d={m.l} />
              </g>
            </g>
            <g className="lm-hop lm-hop-mountain">
              <g className="lm-part lm-mountain-in">
                <path className="lm-mountain" d={m.mountain} />
                <path className="lm-face" d={m.face} />
              </g>
            </g>
            <g className="lm-sway">
              <g className="lm-part lm-wand-in">
                <path className="lm-wand" d={m.wand} />
              </g>
            </g>
            <g className="lm-burst" aria-hidden="true">
              {pieces.map((piece, i) => (
                <path
                  key={i}
                  className={piece.gold ? "lm-star" : "lm-white"}
                  d={piece.d}
                  style={piece.style}
                />
              ))}
            </g>
            <g className="lm-twinkle lm-twinkle-star">
              <g className="lm-part lm-star-in">
                <path className="lm-star" d={m.star} />
              </g>
            </g>
            <g className="lm-twinkle lm-twinkle-spark">
              <g className="lm-part lm-spark-in">
                <path className="lm-star" d={m.spark} />
              </g>
            </g>
            <g className="lm-action" aria-hidden="true">
              <polygon points={burstShape(sx - 116, sy - 58, 31, 22)} />
              <text x={sx - 116} y={sy - 53}>
                ACTION!
              </text>
            </g>
          </svg>
          <button
            type="button"
            className="lp-button lp-button-small lp-mark-replay"
            onClick={replay}
          >
            再演一次 <span aria-hidden="true">↻</span>
          </button>
        </div>
      </div>
    </section>
  );
}
