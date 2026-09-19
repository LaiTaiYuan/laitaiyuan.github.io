import { useSyncExternalStore } from "react";
import { useHeroParallax, useReveal } from "./motion";
import type { CSSProperties, ReactNode } from "react";
import catalog from "./data/toolbox.json";
import snapshot from "./data/toolboxReleases.json";
import scene from "./data/toolboxScene.json";

type Tool = (typeof catalog)[number];
type Release = {
  version: string | null;
  publishedAt: string | null;
  releaseUrl: string;
  highlights: string[];
  summaryLanguage: string;
  checkedAt: string | null;
  status: string;
};
type IconName =
  | "arrow"
  | "down"
  | "box"
  | "video"
  | "slides"
  | "spark"
  | "book"
  | "clock"
  | "check"
  | "code"
  | "map";
type StyleVars = CSSProperties & Record<`--${string}`, string | number>;
type SceneLayer = keyof typeof scene.layers;
const releases: Record<string, Release> = snapshot.tools;
const publicBase = import.meta.env.BASE_URL;
const categories = [
  { id: "all", label: "全部工具", icon: "box" as const },
  { id: "video", label: "影片與動畫", icon: "video" as const },
  { id: "slides", label: "簡報與表達", icon: "slides" as const },
  { id: "code", label: "程式與 AI", icon: "code" as const },
  { id: "map", label: "地圖與資料", icon: "map" as const },
];

function categoryIcon(category: string): IconName {
  if (category === "video" || category === "code" || category === "map")
    return category;
  return "slides";
}

function Icon({
  name,
  className = "",
}: {
  name: IconName;
  className?: string;
}) {
  const paths: Record<IconName, ReactNode> = {
    arrow: <path d="M6 18 18 6M6 6h12v12" />,
    down: <path d="M12 4v16m-6-6 6 6 6-6" />,
    box: (
      <>
        <rect x="3" y="7" width="18" height="14" rx="3" />
        <path d="M8 7V3h8v4M3 12h18m-11 0v3h4v-3" />
      </>
    ),
    video: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="m10 8 6 4-6 4Z" />
      </>
    ),
    slides: (
      <>
        <rect x="3" y="3" width="18" height="14" rx="2" />
        <path d="m8 22 4-5 4 5M7 8h10M7 12h6" />
      </>
    ),
    spark: <path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" />,
    book: (
      <>
        <path d="M12 5v16M3 3h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5v16h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3Z" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    code: <path d="m7 7-5 5 5 5m10-10 5 5-5 5m-3-14-4 18" />,
    map: (
      <>
        <path d="M12 21.5s-7-6.3-7-11.6a7 7 0 0 1 14 0c0 5.3-7 11.6-7 11.6Z" />
        <circle cx="12" cy="9.8" r="2.6" />
      </>
    ),
  };
  return (
    <svg
      className={`toolbox-icon ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function ExternalLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
      <Icon name="arrow" />
      <span className="toolbox-sr-only">（另開分頁）</span>
    </a>
  );
}

function dateLabel(value: string | null) {
  if (!value) return "尚未確認";
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function isStale(release: Release, now: number) {
  return (
    release.status !== "ok" ||
    !release.checkedAt ||
    now - Date.parse(release.checkedAt) > 3 * 24 * 60 * 60 * 1000
  );
}

function subscribeFreshness(onChange: () => void) {
  const timer = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(timer);
}

// Every scene layer is cut from maker-street.png by
// scripts/build-toolbox-scene.py and laid back over the untouched base image
// at the same spot, so the motion only has to be small: breathing scales from
// the feet, a spinning reel, lamp glows and whiteboard ripples. Coordinates
// below are source pixels of the 2172 × 724 illustration.
const sceneBulbs = [
  [290, 317],
  [352, 314],
  [405, 309],
  [481, 300],
  [547, 292],
  [597, 289],
];
const sceneLamps = [
  [875, 258, 150],
  [1025, 298, 120],
  [1162, 300, 120],
  [2010, 372, 110],
];
const sceneNodes = [
  { x: 1635, y: 377, r: 21, color: "#2b63d9" },
  { x: 1707, y: 358, r: 16, color: "#ff7900" },
  { x: 1753, y: 398, r: 21, color: "#ffbe23" },
  { x: 1680, y: 441, r: 21, color: "#409c42" },
  { x: 1758, y: 463, r: 16, color: "#ffbe23" },
];
const sceneClouds = [
  { w: 9, top: 5, dur: 150, delay: -40 },
  { w: 5.5, top: 15, dur: 110, delay: -75 },
  { w: 7, top: 23, dur: 190, delay: -130 },
];

function pct(value: number, total: number) {
  return `${((value / total) * 100).toFixed(3)}%`;
}

function layerStyle(name: SceneLayer): CSSProperties {
  const box = scene.layers[name];
  return { left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%` };
}

function spotStyle(x: number, y: number, size: number): CSSProperties {
  return {
    left: pct(x, scene.width),
    top: pct(y, scene.height),
    width: pct(size, scene.width),
  };
}

function rectStyle(x0: number, y0: number, x1: number, y1: number) {
  return {
    left: pct(x0, scene.width),
    top: pct(y0, scene.height),
    width: pct(x1 - x0, scene.width),
    height: pct(y1 - y0, scene.height),
  } satisfies CSSProperties;
}

function Actor({ name, children }: { name: SceneLayer; children?: ReactNode }) {
  return (
    <div
      className={`toolbox-actor toolbox-actor--${name}`}
      style={layerStyle(name)}
    >
      <img
        src={`${publicBase}tools/scene/${name}.webp`}
        alt=""
        decoding="async"
      />
      {children}
    </div>
  );
}

function ToolboxScene() {
  return (
    <div
      className="toolbox-scene"
      style={{ aspectRatio: `${scene.width} / ${scene.height}` }}
    >
      <div className="toolbox-sky">
        {sceneClouds.map((cloud, index) => (
          <svg
            key={index}
            className="toolbox-cloud"
            viewBox="0 0 120 56"
            style={
              {
                width: `${cloud.w}%`,
                top: `${cloud.top}%`,
                "--travel": `${Math.round(((100 + cloud.w * 2) / cloud.w) * 100)}%`,
                "--dur": `${cloud.dur}s`,
                "--delay": `${cloud.delay}s`,
              } as StyleVars
            }
          >
            <path d="M16 46C4 46 2 30 16 28 14 14 34 8 42 20 48 4 74 4 78 20 92 12 108 24 100 36 112 38 110 48 96 46Z" />
          </svg>
        ))}
      </div>
      <div className="toolbox-scene-art">
        <picture>
          <source
            type="image/avif"
            srcSet={`${publicBase}tools/maker-street-1086.avif 1086w, ${publicBase}tools/maker-street-2172.avif 2172w`}
            sizes="(max-width: 1260px) 100vw, 1260px"
          />
          <source
            type="image/webp"
            srcSet={`${publicBase}tools/maker-street-1086.webp 1086w, ${publicBase}tools/maker-street-2172.webp 2172w`}
            sizes="(max-width: 1260px) 100vw, 1260px"
          />
          <img
            className="toolbox-hero-art"
            src={`${publicBase}tools/maker-street.png`}
            width={scene.width}
            height={scene.height}
            alt=""
            fetchPriority="high"
          />
        </picture>
        <img
          className="toolbox-scene-reel"
          src={`${publicBase}tools/scene/reel.webp`}
          alt=""
          decoding="async"
          style={layerStyle("reel")}
        />
        <Actor name="beaver" />
        <img
          className="toolbox-scene-prop"
          src={`${publicBase}tools/scene/laptop.webp`}
          alt=""
          decoding="async"
          style={layerStyle("laptop")}
        />
        <Actor name="cat">
          <span className="toolbox-rec" />
        </Actor>
        <Actor name="bird" />
        <Actor name="raccoon">
          <span className="toolbox-sparkle" />
        </Actor>
        <div className="toolbox-fx">
          <span
            className="toolbox-beam"
            style={rectStyle(178, 218, 340, 352)}
          />
          {sceneBulbs.map(([x, y], index) => (
            <span
              key={index}
              className="toolbox-glow toolbox-glow--bulb"
              style={
                {
                  ...spotStyle(x, y, 66),
                  "--delay": `${index * -0.47}s`,
                } as StyleVars
              }
            />
          ))}
          {sceneLamps.map(([x, y, size], index) => (
            <span
              key={index}
              className="toolbox-glow toolbox-glow--lamp"
              style={
                {
                  ...spotStyle(x, y, size),
                  "--delay": `${index * -1.3}s`,
                } as StyleVars
              }
            />
          ))}
          <span
            className="toolbox-shine"
            style={rectStyle(362, 339, 543, 458)}
          />
          <span
            className="toolbox-glow toolbox-glow--play"
            style={spotStyle(462, 398, 150)}
          />
          {sceneNodes.map((node, index) => (
            <span
              key={index}
              className="toolbox-ring"
              style={
                {
                  ...spotStyle(node.x, node.y, node.r * 2 + 8),
                  "--ring": node.color,
                  "--delay": `${index * 0.6}s`,
                } as StyleVars
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ToolPreview({ tool }: { tool: Tool }) {
  return (
    <div
      className={`toolbox-preview toolbox-preview--${tool.category}`}
      aria-hidden="true"
    >
      <span className="toolbox-preview-label">
        {tool.id === "remotion"
          ? "CODE. ANIMATE. CREATE."
          : tool.id === "gitnexus"
            ? "CONNECT THE CODE."
            : tool.id === "maplibre-gl-js"
              ? "YOUR DATA, ON THE MAP."
              : "YOUR IDEAS, ON SLIDES."}
      </span>
      {tool.id === "remotion" ? (
        <div className="toolbox-video-demo">
          <div className="toolbox-window-dots">
            <i />
            <i />
            <i />
            <span>my-first-video.tsx</span>
          </div>
          <div className="toolbox-video-scene">
            <span className="toolbox-scene-orbit" />
            <span className="toolbox-scene-sun" />
            <span className="toolbox-scene-play">
              <Icon name="video" />
            </span>
            <span className="toolbox-code-sticker">&lt;Hello, world /&gt;</span>
          </div>
          <div className="toolbox-timeline">
            <span />
            <span />
            <i />
            <b>00:00 / 00:10</b>
          </div>
        </div>
      ) : tool.id === "gitnexus" ? (
        <div className="toolbox-graph-demo">
          <svg viewBox="0 0 290 170" fill="none" aria-hidden="true">
            <path
              d="m144 85-84-42m84 42 76-49m-76 49 96 42m-96-42-76 53m76-53-6 69M60 43l8 95m152-102 20 91"
              stroke="var(--tb-ink)"
              strokeWidth="3"
            />
            <path
              className="toolbox-graph-flow"
              d="m144 85-84-42m84 42 76-49m-76 49 96 42m-96-42-76 53m76-53-6 69M60 43l8 95m152-102 20 91"
              stroke="var(--tb-yellow)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <g className="toolbox-graph-hub">
              <rect
                x="108"
                y="52"
                width="71"
                height="66"
                rx="15"
                fill="var(--tb-ink)"
                transform="translate(4 5)"
              />
              <rect
                x="108"
                y="52"
                width="71"
                height="66"
                rx="15"
                fill="var(--tb-yellow)"
                stroke="var(--tb-ink)"
                strokeWidth="3"
              />
              <path
                d="m133 73-10 12 10 11m22-23 10 12-10 11"
                stroke="var(--tb-ink)"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </g>
            <circle
              className="toolbox-graph-node"
              style={{ "--i": 0 } as StyleVars}
              cx="60"
              cy="43"
              r="19"
              fill="var(--tb-white)"
              stroke="var(--tb-ink)"
              strokeWidth="3"
            />
            <circle
              className="toolbox-graph-node"
              style={{ "--i": 1 } as StyleVars}
              cx="220"
              cy="36"
              r="20"
              fill="var(--tb-coral)"
              stroke="var(--tb-ink)"
              strokeWidth="3"
            />
            <circle
              className="toolbox-graph-node"
              style={{ "--i": 2 } as StyleVars}
              cx="240"
              cy="127"
              r="22"
              fill="var(--tb-white)"
              stroke="var(--tb-ink)"
              strokeWidth="3"
            />
            <circle
              className="toolbox-graph-node"
              style={{ "--i": 3 } as StyleVars}
              cx="68"
              cy="138"
              r="19"
              fill="var(--tb-blue-light)"
              stroke="var(--tb-ink)"
              strokeWidth="3"
            />
            <circle
              className="toolbox-graph-node"
              style={{ "--i": 4 } as StyleVars}
              cx="138"
              cy="154"
              r="10"
              fill="var(--tb-coral)"
              stroke="var(--tb-ink)"
              strokeWidth="3"
            />
            <path
              d="M52 39h16m-16 7h11m180 75h16m-16 8h10"
              stroke="var(--tb-ink)"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          <span className="toolbox-graph-sticker">FOLLOW THE CONNECTIONS</span>
        </div>
      ) : tool.id === "maplibre-gl-js" ? (
        <div className="toolbox-map-demo">
          <svg viewBox="0 0 290 170" fill="none" aria-hidden="true">
            <rect
              x="10"
              y="10"
              width="270"
              height="150"
              rx="10"
              fill="var(--tb-paper)"
              stroke="var(--tb-ink)"
              strokeWidth="3"
            />
            <g clipPath="url(#toolbox-map-clip)">
              <path
                className="toolbox-map-river"
                d="M228 8c-22 30 12 52-8 80s-4 48 22 74"
                stroke="var(--tb-sky)"
                strokeWidth="22"
              />
              <rect
                x="32"
                y="96"
                width="66"
                height="46"
                rx="8"
                fill="var(--tb-green)"
                stroke="var(--tb-ink)"
                strokeWidth="2.5"
              />
              <circle cx="50" cy="114" r="6" fill="var(--tb-green-light)" />
              <circle cx="78" cy="126" r="7" fill="var(--tb-green-light)" />
              <path
                d="M10 62h196M120 10v150M104 128h140"
                stroke="var(--tb-ink)"
                strokeWidth="14"
              />
              <path
                d="M10 62h196M120 10v150M104 128h140"
                stroke="var(--tb-white)"
                strokeWidth="9"
              />
              <path
                className="toolbox-map-route"
                d="M52 62h68v66h64"
                stroke="var(--tb-coral)"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </g>
            <clipPath id="toolbox-map-clip">
              <rect x="11" y="11" width="268" height="148" rx="9" />
            </clipPath>
            <g className="toolbox-map-pin">
              <path
                d="M52 34c-9 0-15 7-15 15 0 11 15 24 15 24s15-13 15-24c0-8-6-15-15-15Z"
                fill="var(--tb-yellow)"
                stroke="var(--tb-ink)"
                strokeWidth="3"
              />
              <circle cx="52" cy="49" r="5" fill="var(--tb-ink)" />
            </g>
            <g className="toolbox-map-pin toolbox-map-pin--end">
              <path
                d="M184 100c-9 0-15 7-15 15 0 11 15 24 15 24s15-13 15-24c0-8-6-15-15-15Z"
                fill="var(--tb-coral)"
                stroke="var(--tb-ink)"
                strokeWidth="3"
              />
              <circle cx="184" cy="115" r="5" fill="var(--tb-ink)" />
            </g>
            <rect
              x="246"
              y="24"
              width="22"
              height="44"
              rx="5"
              fill="var(--tb-white)"
              stroke="var(--tb-ink)"
              strokeWidth="2.5"
            />
            <path
              d="M251 36h12m-6-6v12m-6 16h12M246 46h22"
              stroke="var(--tb-ink)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
          <span className="toolbox-map-sticker">ZOOM 12.5 · 25.03°N</span>
        </div>
      ) : (
        <div className="toolbox-slides-demo">
          <div className="toolbox-slide-back" />
          <div className="toolbox-slide-sheet">
            <span>MY NEXT BIG IDEA</span>
            <strong>
              想法，
              <br />
              登場！
              <Icon name="spark" />
            </strong>
            <div>
              <i />
              <i />
              <i />
            </div>
            <small>01 / 03</small>
          </div>
          <span className="toolbox-slide-sticker">
            <Icon name="spark" /> Made with AI
          </span>
        </div>
      )}
    </div>
  );
}

function ToolCard({ tool }: { tool: Tool }) {
  const release = releases[tool.id];
  return (
    <article
      className={`toolbox-card toolbox-card--${tool.category}`}
      id={`tool-${tool.id}`}
      aria-labelledby={`title-${tool.id}`}
      data-reveal=""
    >
      <ToolPreview tool={tool} />
      <div className="toolbox-card-content">
        <div className="toolbox-card-meta">
          <span className="toolbox-category-label">
            <Icon name={categoryIcon(tool.category)} />
            {tool.categoryLabel}
          </span>
          <a className="toolbox-version" href={`#update-${tool.id}`}>
            {release?.version ? `v${release.version}` : "版本待確認"}
            <Icon name="down" />
          </a>
        </div>
        <h3 id={`title-${tool.id}`}>{tool.name}</h3>
        <p className="toolbox-card-eyebrow">{tool.eyebrow}</p>
        <p className="toolbox-card-description">{tool.description}</p>
        <div className="toolbox-tags">
          {tool.useCases.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        <div className="toolbox-pick">
          <span className="toolbox-pick-label">
            <Icon name="spark" />
            值得試試的理由
          </span>
          <p>{tool.recommendation}</p>
        </div>
        <details className="toolbox-learn">
          <summary>
            <Icon name="book" />
            <span>從這裡開始玩</span>
            <Icon name="down" />
          </summary>
          <div className="toolbox-learn-body">
            <p className="toolbox-prerequisite">{tool.prerequisite}</p>
            <p>{tool.firstStep}</p>
            <ol>
              {tool.links.map((link) => (
                <li key={link.url}>
                  <ExternalLink href={link.url}>{link.label}</ExternalLink>
                </li>
              ))}
            </ol>
          </div>
        </details>
        <div className="toolbox-card-actions">
          <ExternalLink
            href={tool.website}
            className="toolbox-button toolbox-button--small"
          >
            {tool.websiteLabel}
          </ExternalLink>
          <ExternalLink
            href={`https://github.com/${tool.repository}`}
            className="toolbox-source-link"
          >
            <Icon name="code" />
            原始碼
          </ExternalLink>
        </div>
        <div className="toolbox-license">
          <a href={tool.licenseUrl} target="_blank" rel="noopener noreferrer">
            {tool.licenseLabel}
            <span className="toolbox-sr-only">（另開分頁）</span>
          </a>
          <span>{tool.licenseNote}</span>
        </div>
      </div>
    </article>
  );
}

function ReleaseNote({ tool }: { tool: Tool }) {
  const release = releases[tool.id];
  const stale = useSyncExternalStore(
    subscribeFreshness,
    () => !release || isStale(release, Date.now()),
    () => !release || isStale(release, Date.parse(snapshot.generatedAt)),
  );
  return (
    <article
      className="toolbox-update"
      id={`update-${tool.id}`}
      aria-labelledby={`update-title-${tool.id}`}
      data-reveal=""
    >
      <div
        className={`toolbox-update-icon toolbox-update-icon--${tool.category}`}
      >
        <Icon name={categoryIcon(tool.category)} />
      </div>
      <div className="toolbox-update-heading">
        <p>{stale ? "已收錄版本" : "最新正式版"}</p>
        <h3 id={`update-title-${tool.id}`}>{tool.name}</h3>
        <span className="toolbox-release-version">
          {release?.version ? `v${release.version}` : "尚未取得版本"}
        </span>
        <span className="toolbox-published">
          發布於 {dateLabel(release?.publishedAt ?? null)}
        </span>
      </div>
      <div className="toolbox-update-content">
        <p className="toolbox-update-caption">
          {release?.summaryLanguage === "zh-Hant"
            ? "這次更新了什麼"
            : "官方更新摘要（原文）"}
        </p>
        {release?.highlights.length ? (
          <ul>
            {release.highlights.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : (
          <p>目前沒有可顯示的摘要，請前往官方發布頁閱讀。</p>
        )}
        <div className="toolbox-update-source">
          <span>
            <Icon name="check" />
            上次確認 {dateLabel(release?.checkedAt ?? null)}
          </span>
          <ExternalLink
            href={
              release?.releaseUrl ??
              `https://github.com/${tool.repository}/releases`
            }
          >
            完整更新內容
          </ExternalLink>
        </div>
        {stale && (
          <p className="toolbox-stale">
            版本資料待重新確認，最新消息請以官方發布頁為準。
          </p>
        )}
      </div>
    </article>
  );
}

function readCategory() {
  const category = new URLSearchParams(window.location.search).get("category");
  return categories.some((item) => item.id === category) ? category! : "all";
}

function subscribeCategory(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

export default function Toolbox() {
  const category = useSyncExternalStore(
    subscribeCategory,
    readCategory,
    () => "all",
  );
  useReveal(category);
  const heroRef = useHeroParallax<HTMLElement>();
  const visibleTools = catalog.filter(
    (tool) => category === "all" || tool.category === category,
  );
  function changeCategory(next: string) {
    const url = new URL(window.location.href);
    if (next === "all") url.searchParams.delete("category");
    else url.searchParams.set("category", next);
    window.history.pushState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
  return (
    <div className="toolbox-page" id="top">
      <a className="toolbox-skip" href="#collection">
        跳至工具收藏
      </a>
      <header className="toolbox-header">
        <div className="toolbox-container toolbox-header-inner">
          <a
            className="toolbox-brand"
            href={`${publicBase}tools/`}
            aria-label="Leonard 的工具小舖首頁"
          >
            <span className="toolbox-brand-icon">
              <Icon name="box" />
            </span>
            <span>
              <small>LEONARD’S</small>
              <strong>工具小舖</strong>
            </span>
          </a>
          <nav aria-label="工具小舖導覽">
            <a href={publicBase} aria-label="賴泰元 Leonard Lai 個人首頁">
              個人首頁
            </a>
            <a href="#collection">工具收藏</a>
            <a href="#updates">更新小報</a>
            <a href="#about">關於這裡</a>
          </nav>
          <span className="toolbox-open-sign">
            <span />
            好奇心營業中
          </span>
        </div>
      </header>

      <main>
        <section
          className="toolbox-hero"
          aria-labelledby="toolbox-title"
          ref={heroRef}
        >
          <div className="toolbox-container toolbox-hero-inner">
            <div className="toolbox-hero-copy">
              <span className="toolbox-eyebrow">
                <Icon name="spark" />
                給喜歡動手做的你
              </span>
              <h1 id="toolbox-title">
                <span className="toolbox-title-gold">好工具</span>
                <span className="toolbox-title-rule"> — </span>
                <span className="toolbox-title-white">一起玩！</span>
              </h1>
              <p>
                嗨，我是賴泰元 Leonard，把用過的好工具分享給你。
                <br />
                做影片、玩簡報、探索程式碼，從這一站出發！
              </p>
              <div className="toolbox-hero-actions">
                <a className="toolbox-button" href="#collection">
                  開始逛工具
                  <Icon name="down" />
                </a>
                <a className="toolbox-hero-note" href="#updates">
                  工具最近更新了什麼？
                  <Icon name="arrow" />
                </a>
              </div>
            </div>
          </div>
          <div className="toolbox-hero-visual" aria-hidden="true">
            <ToolboxScene />
          </div>
        </section>

        <div className="toolbox-ribbon">
          <div className="toolbox-container">
            <span>
              <Icon name="check" />
              親自用過，才想分享
            </span>
            <Icon name="spark" />
            <span>從一個小作品開始</span>
            <Icon name="spark" />
            <span>慢慢收集，持續更新</span>
          </div>
        </div>

        <section
          className="toolbox-collection toolbox-container"
          id="collection"
          tabIndex={-1}
          aria-labelledby="collection-title"
        >
          <div className="toolbox-section-heading" data-reveal="">
            <div>
              <span className="toolbox-kicker">THE COLLECTION</span>
              <h2 id="collection-title">
                你的下一個好工具<span className="toolbox-heading-dot">.</span>
              </h2>
              <p>挑一個感興趣的，讓創作開始發生。</p>
            </div>
            <span className="toolbox-count-note">
              小舖目前收藏 <strong>{catalog.length}</strong> 個好工具
            </span>
          </div>
          <div className="toolbox-filter-bar" data-reveal="">
            <div
              className="toolbox-filters"
              role="group"
              aria-label="依工具用途分類"
            >
              {categories.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  aria-pressed={category === item.id}
                  onClick={() => changeCategory(item.id)}
                >
                  <Icon name={item.icon} />
                  {item.label}
                  <span>
                    {item.id === "all"
                      ? catalog.length
                      : catalog.filter((tool) => tool.category === item.id)
                          .length}
                  </span>
                </button>
              ))}
            </div>
            <span
              className="toolbox-filter-hint"
              role="status"
              aria-live="polite"
              key={visibleTools.length}
            >
              顯示 {visibleTools.length} 個工具
            </span>
          </div>
          <div className="toolbox-card-grid">
            {visibleTools.map((tool) => (
              <ToolCard key={`${category}:${tool.id}`} tool={tool} />
            ))}
          </div>
        </section>

        <section
          className="toolbox-updates-section"
          id="updates"
          aria-labelledby="updates-title"
        >
          <div className="toolbox-container">
            <div className="toolbox-section-heading" data-reveal="">
              <div>
                <span className="toolbox-kicker">FRESH FROM THE PROJECTS</span>
                <h2 id="updates-title">
                  工具有新消息！
                  <Icon name="spark" />
                </h2>
                <p>版本往前走，這裡也幫你記一筆。</p>
              </div>
              <span className="toolbox-update-frequency">
                <Icon name="clock" />
                每日查看官方更新
              </span>
            </div>
            <div className="toolbox-update-list">
              {catalog.map((tool) => (
                <ReleaseNote key={tool.id} tool={tool} />
              ))}
            </div>
            <p className="toolbox-update-footnote" data-reveal="">
              追蹤官方正式版本；Open Slide
              以核心套件為準。更新重點附原始來源，新版本尚未整理中文時會先顯示官方原文。
            </p>
          </div>
        </section>

        <section
          className="toolbox-about toolbox-container"
          id="about"
          aria-labelledby="about-title"
        >
          <div className="toolbox-about-note" data-reveal="">
            <span className="toolbox-note-tape" aria-hidden="true" />
            <span className="toolbox-kicker">A NOTE FROM LEONARD</span>
            <h2 id="about-title">
              好用的東西，
              <br />
              值得一起分享。
            </h2>
            <p>
              這裡是我的工具收藏，也是留給你的創作起點。
              <br />
              有些幫我把想法變成影片，有些讓表達更有趣。
            </p>
            <p>
              我會慢慢把喜歡的工具放進來，整理用途、入門資源與更新。希望你逛完，也找到一個想試試的新玩具。
            </p>
            <p>
              想多認識我的作品與故事，歡迎到
              <a href={publicBase}>賴泰元 Leonard Lai 的個人首頁</a>。
            </p>
            <span className="toolbox-signature">
              Leonard{" "}
              <svg viewBox="0 0 88 22" aria-hidden="true">
                <path d="M2 12q35-15 81-1M27 20q31-9 51-3" />
              </svg>
            </span>
          </div>
          <div className="toolbox-start-note" data-reveal="">
            <span className="toolbox-kicker">
              A SMALL START IS A GOOD START
            </span>
            <h3>
              不用一次學會所有。
              <br />
              先做一個小作品就好。
            </h3>
            <ol>
              <li>
                <span>1</span>
                <div>
                  <strong>挑一個想做的東西</strong>
                  <p>一段動畫、一份簡報，從你的好奇心出發。</p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>跟著入門資源試一次</strong>
                  <p>打開工具卡片的「從這裡開始玩」，找到第一步。</p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>改成自己的樣子</strong>
                  <p>換上自己的內容，讓學到的東西真的派上用場。</p>
                </div>
              </li>
            </ol>
            <a href="#collection" className="toolbox-back-link">
              好，來挑個工具
              <Icon name="arrow" />
            </a>
          </div>
        </section>
      </main>

      <footer className="toolbox-footer">
        <div className="toolbox-container">
          <a href="#top" className="toolbox-footer-brand">
            <Icon name="box" />
            Leonard 的工具小舖
          </a>
          <p>保持好奇，也記得動手玩。</p>
          <a href="#top" className="toolbox-to-top">
            回到頂端
            <Icon name="arrow" />
          </a>
        </div>
      </footer>
    </div>
  );
}
