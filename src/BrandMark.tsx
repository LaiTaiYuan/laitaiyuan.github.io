import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { brandLogo } from "./data/brandMark";

const base = import.meta.env.BASE_URL;

/** 品牌標誌原檔：淺色底用 lai-logo.svg，深色底用 lai-logo-reversed.svg。 */
export function BrandLogo({
  reversed = false,
  className,
}: {
  reversed?: boolean;
  className?: string;
}) {
  return (
    <img
      className={className}
      src={`${base}brand/${reversed ? "lai-logo-reversed" : "lai-logo"}.svg`}
      alt=""
      width="190"
      height="148"
      decoding="async"
    />
  );
}

type Part = "l" | "a" | "i" | "star";

/** 拆解說明旁的小圖示：只畫出標誌的其中一個部件。 */
function PartIcon({ part }: { part: Part }) {
  const m = brandLogo;
  return (
    <svg
      className="lp-mark-part-icon"
      viewBox={m.boxes[part].join(" ")}
      aria-hidden="true"
      focusable="false"
    >
      {part === "l" && <polygon className="lm-l" points={m.l} />}
      {part === "a" && (
        <>
          <polygon className="lm-a-left" points={m.aLeft} />
          <polygon className="lm-a-right" points={m.aRight} />
        </>
      )}
      {part === "i" && <rect className="lm-i" {...m.i} />}
      {part === "star" && <path className="lm-star" d={m.star} />}
    </svg>
  );
}

const parts: { part: Part; name: string; text: string }[] = [
  {
    part: "l",
    name: "L",
    text: "賴，也是 Leonard。腳斜切，角度跟 A 的左斜邊平行。",
  },
  {
    part: "a",
    name: "A",
    text: "左右雙色的實心金字塔：亮藍在左、淺藍在右。",
  },
  {
    part: "star",
    name: "星",
    text: "A 中間原本的三角形挖空，換成一顆琥珀色四芒星，代表 AI 的核心。",
  },
  {
    part: "i",
    name: "I",
    text: "一根深藍直筆，也是「我」。",
  },
];

/** 核心點亮時噴出的碎星：方向與距離固定，伺服器與瀏覽器輸出一致。 */
function burstPieces() {
  const [cx, cy] = brandLogo.starCenter;
  return Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const distance = i % 2 ? 58 : 88;
    const r = i % 2 ? 4.5 : 7;
    const c = r * 0.2;
    return {
      d: `M${cx} ${cy - r}C${cx + c} ${cy - c} ${cx + c} ${cy - c} ${cx + r} ${cy}C${cx + c} ${cy + c} ${cx + c} ${cy + c} ${cx} ${cy + r}C${cx - c} ${cy + c} ${cx - c} ${cy + c} ${cx - r} ${cy}C${cx - c} ${cy - c} ${cx - c} ${cy - c} ${cx} ${cy - r}Z`,
      style: {
        "--dx": `${Math.round(Math.cos(angle) * distance)}px`,
        "--dy": `${Math.round(Math.sin(angle) * distance)}px`,
        "--delay": `${(i % 3) * 0.04}s`,
      } as CSSProperties,
      amber: i % 3 !== 1,
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

// 整段演出約 4.3 秒；之後只剩核心的星偶爾眨眼。
const SHOW_MS = 4400;

export function BrandStorySection() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("static");
  const [run, setRun] = useState(0);
  const [inView, setInView] = useState(false);
  const m = brandLogo;
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

  // 舞台比標誌大：上方留給爆炸框與碎星，兩側留給 A 的左右半邊飛進來
  const viewBox = `${vx - 70} ${vy - 90} ${vw + 140} ${vh + 130}`;
  const pieces = burstPieces();

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
              L、A、I，
              <br />
              中間亮著
              <br />
              <span className="lp-underline">AI 的核心。</span>
            </h2>
          </div>
          <p data-reveal="">
            我的名字 LAI 就是這三個字母。A
            是左右雙色的實心金字塔，中間原本的三角形挖空，換成一顆琥珀色四芒星；L
            的腳斜切，角度跟 A 的左斜邊平行。
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
            aria-label="賴泰元的品牌標誌 LAI：L、左右雙色的金字塔 A 與 I，A 的中間是一顆琥珀色四芒星"
          >
            <ellipse
              className="lm-floor"
              cx={vx + vw / 2}
              cy={vy + vh + 12}
              rx={vw * 0.62}
              ry="9"
            />
            <g className="lm-hop lm-hop-l">
              <g className="lm-part lm-l-in">
                <polygon className="lm-l" points={m.l} />
              </g>
            </g>
            <g className="lm-hop lm-hop-a">
              <g className="lm-a-clap">
                <g className="lm-part lm-a-left-in">
                  <polygon className="lm-a-left" points={m.aLeft} />
                </g>
                <g className="lm-part lm-a-right-in">
                  <polygon className="lm-a-right" points={m.aRight} />
                </g>
              </g>
            </g>
            <g className="lm-hop lm-hop-i">
              <g className="lm-part lm-i-in">
                <rect className="lm-i" {...m.i} />
              </g>
            </g>
            <g className="lm-burst" aria-hidden="true">
              {pieces.map((piece, i) => (
                <path
                  key={i}
                  className={piece.amber ? "lm-star" : "lm-white"}
                  d={piece.d}
                  style={piece.style}
                />
              ))}
            </g>
            <g className="lm-twinkle">
              <g className="lm-part lm-star-in">
                <path className="lm-star" d={m.star} />
              </g>
            </g>
            <g className="lm-action" aria-hidden="true">
              <polygon points={burstShape(62, -14, 31, 22)} />
              <text x="62" y="-9">
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
