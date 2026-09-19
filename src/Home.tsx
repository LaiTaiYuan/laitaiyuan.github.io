import { useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import lion from "./data/lionScene.json";
import { profile, tracks } from "./data/profile";
import {
  useCursorBadge,
  useDaypart,
  useHeroParallax,
  useMagnetic,
  useReveal,
  useScrollProgress,
  useScrollSpy,
  useScrolled,
  useTilt,
} from "./motion";

const base = import.meta.env.BASE_URL;
const links = profile.links;
const navSections = ["work", "about", "music"] as const;
const interests = [
  ["軟體工程", "code"],
  ["AI 實作", "spark"],
  ["音樂創作", "music"],
  ["好工具分享", "tools"],
] as const;
const heroSizes = "(max-width: 760px) 100vw, (max-width: 1400px) 55vw, 720px";
const portraitSizes =
  "(max-width: 760px) 100vw, (max-width: 1400px) 45vw, 600px";
const streetSizes = "(max-width: 760px) 100vw, (max-width: 1400px) 60vw, 800px";

// Responsive encodes produced by scripts/build-images.py and
// scripts/build-lion-scene.py; the original file stays as the <img> fallback.
function Picture({
  stem,
  widths,
  sizes,
  children,
}: {
  stem: string;
  widths: number[];
  sizes: string;
  children: ReactNode;
}) {
  const set = (ext: string) =>
    widths.map((w) => `${base}${stem}-${w}.${ext} ${w}w`).join(", ");
  return (
    <picture>
      <source type="image/avif" srcSet={set("avif")} sizes={sizes} />
      <source type="image/webp" srcSet={set("webp")} sizes={sizes} />
      {children}
    </picture>
  );
}

// Studio scene layers are cut from the lion illustration by
// scripts/build-lion-scene.py and laid back over the base at the same spot
// (see docs/lion-art.md). Boxes and pivots are percentages of the scene.
type LionLayer = keyof typeof lion.layers;

function pct(value: number, total: number) {
  return `${((value / total) * 100).toFixed(3)}%`;
}

function sceneRect(x0: number, y0: number, x1: number, y1: number) {
  return {
    left: pct(x0, lion.width),
    top: pct(y0, lion.height),
    width: pct(x1 - x0, lion.width),
    height: pct(y1 - y0, lion.height),
  } satisfies CSSProperties;
}

function sceneSpot(x: number, y: number, size: number): CSSProperties {
  return {
    left: pct(x - size / 2, lion.width),
    top: pct(y - size / 2, lion.height),
    width: pct(size, lion.width),
  };
}

function SceneLayer({
  name,
  children,
}: {
  name: LionLayer;
  children?: ReactNode;
}) {
  const box = lion.layers[name];
  return (
    <div
      className={`lp-layer lp-layer--${name}`}
      style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%` }}
    >
      <img
        src={`${base}images/lion/${name}.webp`}
        alt=""
        decoding="async"
        fetchPriority="low"
        style={{ transformOrigin: `${box.ox}% ${box.oy}%` }}
      />
      {children}
    </div>
  );
}

function Note({ index }: { index: number }) {
  return (
    <svg
      className="lp-note"
      viewBox="0 0 24 32"
      style={{ "--i": index } as CSSProperties}
      aria-hidden="true"
    >
      <path d="M9 2v20.5a5.5 5.5 0 1 1-3-4.9V8l14-4v13.5a5.5 5.5 0 1 1-3-4.9V9.4L12 11.6" />
    </svg>
  );
}

function Sparkle({
  x,
  y,
  size,
  delay,
}: {
  x: number;
  y: number;
  size: number;
  delay: number;
}) {
  return (
    <svg
      className="lp-sparkle"
      viewBox="0 0 24 24"
      style={
        { ...sceneSpot(x, y, size), "--delay": `${delay}s` } as CSSProperties
      }
      aria-hidden="true"
    >
      <path d="M12 0c1 7 5 11 12 12-7 1-11 5-12 12-1-7-5-11-12-12 7-1 11-5 12-12Z" />
    </svg>
  );
}

function LionScene() {
  return (
    <div
      className="lp-hero-scene"
      style={{ aspectRatio: `${lion.width} / ${lion.height}` }}
    >
      <Picture stem="images/lion/base" widths={[768, 1536]} sizes={heroSizes}>
        <img
          className="lp-scene-base"
          src={`${base}images/lion/base.png`}
          alt="戴眼鏡與耳機的獅子 Leonard，在程式與音樂工作桌前創作"
          width={lion.width}
          height={lion.height}
          fetchPriority="high"
        />
      </Picture>
      <div className="lp-scene-layers" aria-hidden="true">
        <span
          className="lp-fx lp-fx-lamp"
          style={sceneRect(150, 150, 560, 640)}
        />
        <span
          className="lp-fx lp-fx-screen"
          style={sceneRect(245, 200, 545, 420)}
        />
        <span className="lp-fx lp-fx-bulb" style={sceneSpot(1058, 195, 330)} />
        <SceneLayer name="plant-left" />
        <SceneLayer name="plant-right" />
        <SceneLayer name="tail" />
        <SceneLayer name="head">
          <div className="lp-notes">
            <Note index={0} />
            <Note index={1} />
            <Note index={2} />
          </div>
        </SceneLayer>
        <SceneLayer name="pupil-left" />
        <SceneLayer name="pupil-right" />
        <SceneLayer name="bulb" />
        <Sparkle x={1150} y={128} size={30} delay={0} />
        <Sparkle x={982} y={252} size={22} delay={0.9} />
        <Sparkle x={1132} y={262} size={18} delay={1.7} />
      </div>
    </div>
  );
}

function Arrow({ down = false }: { down?: boolean }) {
  return (
    <svg
      className={down ? "lp-arrow lp-arrow-down" : "lp-arrow"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d={down ? "M12 4v16m-6-6 6 6 6-6" : "M5 19 19 5M5 5h14v14"} />
    </svg>
  );
}

function External({
  href,
  children,
  className = "lp-text-link",
  ...rest
}: {
  href: string;
  children: ReactNode;
  className?: string;
  "data-reveal"?: string;
  "data-cursor"?: string;
  "data-magnet"?: string;
}) {
  return (
    <a
      href={href}
      className={className}
      target="_blank"
      rel="noopener noreferrer"
      {...rest}
    >
      {children}
      <Arrow />
      <span className="toolbox-sr-only">（另開分頁）</span>
    </a>
  );
}

function SkillIcon({ kind }: { kind: "code" | "spark" | "music" | "tools" }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === "code" ? (
        <>
          <rect x="4" y="8" width="40" height="32" rx="5" pathLength={1} />
          <path
            d="M4 17h40m-26 7-5 5 5 5m12-10 5 5-5 5m-7 0 2-10"
            pathLength={1}
          />
        </>
      ) : kind === "spark" ? (
        <>
          <path d="m24 5 5 13 13 6-13 5-5 14-5-14-13-5 13-6Z" pathLength={1} />
          <path d="m38 3 1 5 5 1m-39 29 4 1 1 5" pathLength={1} />
        </>
      ) : kind === "music" ? (
        <>
          <path d="M20 34V12l20-5v22M20 20l20-5" pathLength={1} />
          <ellipse cx="13" cy="36" rx="7" ry="5" pathLength={1} />
          <ellipse cx="33" cy="31" rx="7" ry="5" pathLength={1} />
        </>
      ) : (
        <>
          <path d="M6 20h36v20a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3Z" pathLength={1} />
          <path
            d="M17 20v-6a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v6M6 29h36"
            pathLength={1}
          />
          <path d="M20 26v6m8-6v6" pathLength={1} />
        </>
      )}
    </svg>
  );
}

function InterestGroup({ hidden = false }: { hidden?: boolean }) {
  return (
    <ul className="lp-marquee-group" aria-hidden={hidden || undefined}>
      {interests.map(([item, icon]) => (
        <li key={item}>
          <SkillIcon kind={icon} />
          {item}
          <b aria-hidden="true">✦</b>
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  const [showPlayer, setShowPlayer] = useState(false);
  const heroRef = useHeroParallax<HTMLElement>();
  const scrolled = useScrolled(24);
  const activeSection = useScrollSpy(navSections);
  const cursorRef = useRef<HTMLDivElement>(null);
  const daypart = useDaypart();
  useScrollProgress(heroRef);
  useReveal(null);
  useTilt(6);
  useMagnetic();
  useCursorBadge(cursorRef);
  return (
    <div className="portfolio-page" id="top">
      <div className="lp-cursor" ref={cursorRef} aria-hidden="true" />
      <a className="toolbox-skip" href="#main">
        跳至主要內容
      </a>
      <header className={scrolled ? "lp-header is-scrolled" : "lp-header"}>
        <div className="lp-container lp-header-inner">
          <a
            className="lp-brand"
            href={base}
            aria-label="Leonard Lai 個人網站首頁"
          >
            <span className="lp-monogram" aria-hidden="true">
              L.
            </span>
            <span>
              LEONARD LAI<small>賴泰元的創作基地</small>
            </span>
          </a>
          <nav aria-label="主要導覽">
            <a
              href="#work"
              aria-current={activeSection === "work" ? "location" : undefined}
            >
              作品
            </a>
            <a
              href="#about"
              aria-current={activeSection === "about" ? "location" : undefined}
            >
              關於我
            </a>
            <a
              href="#music"
              aria-current={activeSection === "music" ? "location" : undefined}
            >
              音樂
            </a>
            <a className="lp-nav-tools" href={`${base}tools/`}>
              工具小舖 <Arrow />
            </a>
          </nav>
        </div>
      </header>

      <main id="main">
        <section
          className="lp-hero"
          aria-labelledby="hero-title"
          ref={heroRef}
          data-daypart={daypart}
        >
          <div className="lp-hero-stage">
            <div className="lp-container lp-hero-grid">
              <div className="lp-hero-copy">
                <p className="lp-eyebrow lp-hero-eyebrow">
                  <span /> SOFTWARE × AI × MUSIC
                </p>
                <h1 id="hero-title">
                  Leonard Lai<span>賴泰元</span>
                </h1>
                <p className="lp-hero-statement">
                  <span className="lp-line">
                    <span>聽故事、寫故事，</span>
                  </span>
                  <span className="lp-line">
                    <span>一起創造故事。</span>
                  </span>
                </p>
                <p className="lp-hero-intro">
                  我是賴泰元 Leonard，一名軟體工程師，也是一個喜歡故事的人。
                  <br className="lp-desktop-break" />
                  用技術與音樂，把聽見的需要，變成能一起完成的作品。
                </p>
                <div className="lp-actions">
                  <a href="#work" className="lp-button" data-magnet="">
                    看看故事與作品 <Arrow down />
                  </a>
                  <a href="#contact" className="lp-hero-link">
                    分享你的故事 <Arrow down />
                  </a>
                </div>
              </div>
              <div className="lp-hero-art">
                <span className="lp-art-note">好奇心，持續開工！</span>
                <div className="lp-hero-figure">
                  <LionScene />
                </div>
                <span className="lp-art-caption">
                  LEONARD’S LITTLE BIG IDEAS
                </span>
              </div>
            </div>
          </div>
          <div className="lp-interest-strip" aria-label="創作領域">
            <div className="lp-marquee">
              <div className="lp-marquee-track">
                {[0, 1, 2, 3, 4, 5].map((copy) => (
                  <InterestGroup key={copy} hidden={copy > 0} />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          className="lp-section lp-work"
          id="work"
          aria-labelledby="work-title"
        >
          <div className="lp-container">
            <div className="lp-section-heading">
              <div data-reveal="blur">
                <p className="lp-eyebrow">SELECTED WORK</p>
                <h2 id="work-title">
                  讓想法，<span className="lp-underline">真正派上用場。</span>
                </h2>
              </div>
              <p data-reveal="">
                從家庭財務到醫療現場，
                <br />
                把技術放進真實的問題裡。
              </p>
            </div>
            <article className="lp-featured-project" data-reveal="scale">
              <div className="lp-project-art" aria-hidden="true">
                <span className="lp-project-sticker">2025 IT MATTERS</span>
                <div className="lp-browser-card" data-tilt="">
                  <div className="lp-browser-bar">
                    <i />
                    <i />
                    <i />
                    <span>familyfinhealth.com</span>
                  </div>
                  <div className="lp-family-mark">
                    <svg
                      viewBox="0 0 120 96"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="5"
                    >
                      <path
                        d="m16 45 44-32 44 32M28 38v45h64V38M49 83V59h22v24"
                        pathLength={1}
                      />
                      <path
                        d="M71 31c-9-14-26-3-20 8l20 17 20-17c6-11-11-22-20-8Z"
                        fill="var(--tb-coral)"
                        strokeWidth="3"
                        pathLength={1}
                      />
                    </svg>
                    <strong>好理家在</strong>
                    <span>財務健檢網</span>
                  </div>
                  <div className="lp-mini-chips">
                    <span>認識財務現況</span>
                    <span>找到下一步</span>
                  </div>
                </div>
                <span className="lp-award-ribbon">
                  AI Selected 社會影響力獎
                </span>
              </div>
              <div className="lp-project-copy">
                <p className="lp-eyebrow">AI 應用 ／ 系統開發與營運</p>
                <h3>
                  好理家在<span>財務健檢網</span>
                </h3>
                <p>
                  讓家庭更容易了解自己的財務狀況，並找到合適的協助。以 AI
                  協作推進系統開發與營運，將專業服務轉化成能實際使用的線上產品。
                </p>
                <p className="lp-project-credit">
                  專案獲 2025 IT Matters「AI Selected
                  社會影響力獎」。輔大資管系報導記錄了我在系統開發及營運上的投入。
                </p>
                <div className="lp-tags">
                  <span>產品落地</span>
                  <span>AI 協作開發</span>
                  <span>社會影響力</span>
                </div>
                <div className="lp-project-links">
                  <External
                    href={links.family}
                    className="lp-button lp-button-small"
                  >
                    前往好理家在
                  </External>
                  <External href={links.university}>閱讀系友報導</External>
                </div>
              </div>
            </article>

            <article className="lp-medical-project" data-reveal="">
              <div className="lp-medical-symbol" aria-hidden="true">
                <svg
                  viewBox="0 0 100 100"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                >
                  <rect x="20" y="27" width="60" height="52" rx="14" />
                  <path d="M50 13v14m-6-14h12M10 46v15m80-15v15m-52 5c6 5 18 5 24 0" />
                  <circle cx="37" cy="47" r="4" fill="currentColor" />
                  <circle cx="63" cy="47" r="4" fill="currentColor" />
                </svg>
                <span>TECH WITH CARE</span>
              </div>
              <div className="lp-medical-copy">
                <p className="lp-eyebrow">AI 應用 ／ 專業技術指導</p>
                <h3>讓 AI 走進有溫度的醫療現場</h3>
                <p>
                  協助台大癌醫乳房外科團隊探索 AI
                  智慧機器人應用，提供專業技術指導。團隊榮獲台灣專科護理師學會「AI
                  賦能健康進行式」銅獎。
                </p>
                <p className="lp-source-note">
                  2026.04.23 台大癌醫官方消息 · 團隊獲獎紀錄
                </p>
              </div>
              <External
                href={links.hospital}
                className="lp-button lp-button-small lp-button-white"
              >
                閱讀醫院報導
              </External>
            </article>
          </div>
        </section>

        <section
          className="lp-section lp-about"
          id="about"
          aria-labelledby="about-title"
        >
          <div className="lp-container">
            <div className="lp-about-grid">
              <figure className="lp-portrait" data-reveal="tilt">
                <Picture
                  stem="images/leonard-it-matters-2025"
                  widths={[800, 1200, 1600]}
                  sizes={portraitSizes}
                >
                  <img
                    src={`${base}images/leonard-it-matters-2025.jpg`}
                    alt="Leonard Lai 賴泰元於 2025 IT Matters Awards 頒獎典禮現場"
                    width="7656"
                    height="5366"
                    loading="lazy"
                  />
                </Picture>
                <figcaption>
                  <span>HELLO, I’M LEONARD.</span>
                  <span>IT Matters Awards · 2025</span>
                </figcaption>
              </figure>
              <div className="lp-about-copy">
                <p className="lp-eyebrow" data-reveal="">
                  ABOUT ME
                </p>
                <h2 id="about-title" data-reveal="blur">
                  先聽懂一個人，
                  <br />
                  再一起寫下一段。
                </h2>
                <p data-reveal="">
                  我是賴泰元，英文名字是 Leonard
                  Lai。我喜歡聽故事、寫故事、創造故事。
                  每個人的經歷、每個團隊正在面對的問題，都有值得被理解的脈絡；對我來說，好的作品從願意傾聽開始。
                </p>
                <p data-reveal="">
                  我以 Java 後端開發為基礎，投入雲端架構與 AI 應用，也以
                  LeonardLai 的名字發表音樂。
                  聽懂需要之後，用程式把想法做出來，用文字與旋律留下感受，和不同的人一起創造接下來的故事。
                </p>
                <p className="lp-alumni" data-reveal="">
                  輔仁大學資訊管理學系 · 第 32 屆系友
                </p>
                <div className="lp-actions" data-reveal="">
                  <External
                    href={links.linkedin}
                    className="lp-button lp-button-small"
                  >
                    在 LinkedIn 認識我
                  </External>
                  <External href={links.github}>GitHub</External>
                </div>
              </div>
            </div>
            <div className="lp-current-work" data-reveal="">
              <div>
                <p className="lp-eyebrow">CURRENT WORK</p>
                <h3>目前工作 · eGroupAI</h3>
              </div>
              <p>
                公司以 AI Sandbox 企業地端 AI
                平台為核心，協助企業整理知識、運用專業經驗並推進工作流程，同時讓資料與權限掌握在企業手中。
              </p>
              <External href={links.company}>了解目前工作的業務</External>
            </div>
            <div className="lp-skills" aria-label="能力與專長">
              <div data-reveal="">
                <SkillIcon kind="code" />
                <h3>從後端到雲端</h3>
                <p>
                  Java、Spring Boot、RESTful API
                  與資料庫設計，建立產品背後的系統基礎。
                </p>
                <span>SOFTWARE ENGINEERING</span>
              </div>
              <div data-reveal="">
                <SkillIcon kind="spark" />
                <h3>把 AI 放進流程</h3>
                <p>
                  從協作開發、實際應用到 LLM 模型送測，讓 AI
                  的能力與使用情境一起被檢視。
                </p>
                <span>APPLIED AI</span>
              </div>
              <div data-reveal="">
                <SkillIcon kind="music" />
                <h3>為日常留下聲音</h3>
                <p>
                  以 LeonardLai 發表音樂，從旋律到節奏，記錄生活裡想說的故事。
                </p>
                <span>MUSIC & CREATION</span>
              </div>
            </div>
            <div className="lp-values-grid">
              <section
                className="lp-values"
                aria-labelledby="values-title"
                data-reveal=""
              >
                <p className="lp-eyebrow">ROOTED IN TAIWAN</p>
                <h3 id="values-title">
                  立足台灣，
                  <br />
                  讓每個故事都有自己的聲音。
                </h3>
                <p>
                  我珍惜台灣的自由民主、多元與人情味，也重視每個人表達、選擇與被理解的空間。願意聽見不同的聲音，是我理解人、也理解問題的起點。
                </p>
                <p>
                  做科技，也要懂這片土地的語言、文化與生活情境。從繁體中文、在地需求到資料自主，讓技術貼近人，讓信任慢慢累積。
                </p>
                <ul className="lp-value-words" aria-label="我重視的價值">
                  <li>自由民主</li>
                  <li>尊重多元</li>
                  <li>以人為本</li>
                  <li>在地信任</li>
                </ul>
              </section>
              <article
                className="lp-evaluation"
                aria-labelledby="evaluation-title"
                data-reveal="scale"
              >
                <p className="lp-eyebrow">TRUSTWORTHY AI · 實務經驗</p>
                <h3 id="evaluation-title">
                  AIEC 大型語言模型
                  <br />
                  送測經驗
                </h3>
                <p>
                  參與 AIEC（AI 產品與系統評測中心）LLM
                  模型送測，工作涵蓋送測準備與流程協調、模型調校與測試、結果分析、報告整理與檢視。
                </p>
                <p>
                  除了模型能做什麼，我也關心回答是否可信、如何面對使用風險，以及能否理解台灣的語言與生活脈絡。
                </p>
                <ol className="lp-evaluation-flow" aria-label="送測參與範圍">
                  <li>準備與協調</li>
                  <li>調校與測試</li>
                  <li>分析與檢視</li>
                </ol>
                <External href={links.aiec}>了解 AIEC 評測</External>
              </article>
            </div>
          </div>
        </section>

        <section
          className="lp-section lp-journey"
          aria-labelledby="journey-title"
        >
          <div className="lp-container lp-journey-grid">
            <div>
              <div data-reveal="blur">
                <p className="lp-eyebrow">MILESTONES & CREDENTIAL</p>
                <h2 id="journey-title">
                  沿路累積的
                  <br />
                  <span className="lp-underline">實作與經歷。</span>
                </h2>
              </div>
              <ol className="lp-timeline">
                <li data-reveal="">
                  <time dateTime="2026-04">2026.04</time>
                  <div>
                    <h3>醫療 AI 專業技術指導</h3>
                    <p>
                      台大癌醫官方報導記錄技術指導貢獻；乳房外科團隊獲「AI
                      賦能健康進行式」銅獎。
                    </p>
                  </div>
                </li>
                <li data-reveal="">
                  <time dateTime="2025-12">2025.12</time>
                  <div>
                    <h3>好理家在 · 社會影響力獎</h3>
                    <p>
                      投入系統開發與營運，專案獲 IT Matters AI Selected
                      社會影響力獎，並獲輔大資管系報導。
                    </p>
                  </div>
                </li>
                <li data-reveal="">
                  <time dateTime="2024-04">2024.04</time>
                  <div>
                    <h3>取得 AWS 雲端架構認證</h3>
                    <p>
                      通過 AWS Certified Solutions Architect – Associate 認證。
                    </p>
                  </div>
                </li>
                <li data-reveal="">
                  <time dateTime="2024">2024 起</time>
                  <div>
                    <h3>以 LeonardLai 發表音樂</h3>
                    <p>參與〈歡迎光臨，小孩〉，持續發表個人與合作作品。</p>
                  </div>
                </li>
              </ol>
            </div>
            <aside
              className="lp-certificate"
              aria-labelledby="certificate-title"
              data-reveal="scale"
              data-tilt=""
            >
              <span className="lp-cert-label">CLOUD ARCHITECTURE</span>
              <img
                src="https://images.credly.com/size/340x340/images/0e284c3f-5164-4b21-8660-0d84737941bc/image.png"
                alt="AWS Certified Solutions Architect Associate 認證徽章"
                width="200"
                height="200"
                loading="lazy"
              />
              <h3 id="certificate-title">
                AWS Certified
                <br />
                Solutions Architect<span>Associate</span>
              </h3>
              <p>雲端架構、安全性、韌性與可擴充性。</p>
              <dl>
                <div>
                  <dt>持證人</dt>
                  <dd>Leonard Lai</dd>
                </div>
                <div>
                  <dt>核發日期</dt>
                  <dd>
                    <time dateTime="2024-04-15">2024.04.15</time>
                  </dd>
                </div>
                <div>
                  <dt>有效期限</dt>
                  <dd>
                    <time dateTime="2027-04-15">2027.04.15</time>
                  </dd>
                </div>
              </dl>
              <External
                href={links.credly}
                className="lp-button lp-button-small lp-button-white"
              >
                在 Credly 驗證證照
              </External>
            </aside>
          </div>
        </section>

        <section
          className="lp-section lp-music"
          id="music"
          aria-labelledby="music-title"
        >
          <div className="lp-container">
            <div className="lp-section-heading">
              <div data-reveal="blur">
                <p className="lp-eyebrow">ON A DIFFERENT FREQUENCY</p>
                <h2 id="music-title">
                  程式之外，
                  <br className="lp-mobile-break" />
                  還有我的<span>播放清單。</span>
                </h2>
              </div>
              <p data-reveal="">
                另一種創作語言，
                <br />
                在音樂平台上搜尋 LeonardLai。
              </p>
            </div>
            <div className="lp-records">
              {tracks.map((track) => (
                <article
                  className="lp-record"
                  key={track.id}
                  data-reveal="scale"
                >
                  <a
                    className="lp-record-cover"
                    href={`https://open.spotify.com/track/${track.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`在 Spotify 聆聽 ${track.title}（另開分頁）`}
                    data-cursor="▶ PLAY"
                  >
                    <span className="lp-vinyl" aria-hidden="true">
                      <span />
                    </span>
                    <span className="lp-record-sleeve">
                      <img
                        src={track.image}
                        alt={`${track.title} 單曲封面`}
                        width="300"
                        height="300"
                        loading="lazy"
                      />
                      <span className="lp-play" aria-hidden="true">
                        ▶
                      </span>
                    </span>
                  </a>
                  <div className="lp-record-meta">
                    <time>{track.year}</time>
                    <span>{track.duration}</span>
                  </div>
                  <h3>{track.title}</h3>
                  <p>{track.artist}</p>
                </article>
              ))}
            </div>
            <div className="lp-music-links" data-reveal="">
              <span>選一個喜歡的平台</span>
              <External href={links.spotify}>Spotify</External>
              <External href={links.apple}>Apple Music</External>
              <External href={links.youtubeMusic}>YouTube Music</External>
              <External href={links.amazon}>Amazon Music</External>
            </div>
            <div className="lp-channel-link" data-reveal="">
              <span>更多影音與創作紀錄</span>
              <External href={links.youtube}>賴泰元的 YouTube 頻道</External>
            </div>
            <div className="lp-player-area" data-reveal="">
              {showPlayer ? (
                <div className="lp-player-frame">
                  <iframe
                    title="LeonardLai 的 Spotify 音樂播放器"
                    src="https://open.spotify.com/embed/artist/4Spm3n5CXCuQGDG1Gg76QG?utm_source=generator&theme=0"
                    width="100%"
                    height="352"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                  />
                  <p>
                    播放器無法顯示時，可直接前往{" "}
                    <External href={links.spotify}>Spotify 聆聽</External>。
                  </p>
                </div>
              ) : (
                <button
                  className="lp-button lp-button-small"
                  onClick={() => setShowPlayer(true)}
                  aria-expanded="false"
                >
                  在這裡開啟 Spotify 播放器 <span aria-hidden="true">▶</span>
                </button>
              )}
            </div>
          </div>
        </section>

        <section
          className="lp-section lp-toolbox"
          aria-labelledby="tools-title"
        >
          <div className="lp-container lp-toolbox-grid">
            <div>
              <div data-reveal="blur">
                <p className="lp-eyebrow">LEONARD’S TOOLBOX</p>
                <h2 id="tools-title">
                  好工具，
                  <br />
                  <span className="lp-underline">一起玩！</span>
                </h2>
              </div>
              <p data-reveal="">
                做影片、玩簡報、探索程式碼與地圖。
                <br />
                把用過的好工具，放進你的創作口袋。
              </p>
              <a
                className="lp-button"
                href={`${base}tools/`}
                data-reveal=""
                data-magnet=""
              >
                逛逛工具小舖 <Arrow />
              </a>
            </div>
            <div className="lp-toolbox-preview">
              <a
                className="lp-toolbox-preview-link"
                href={`${base}tools/`}
                aria-label="前往工具小舖"
                data-cursor="逛逛 ↗"
              >
                <Picture
                  stem="tools/maker-street"
                  widths={[1086, 2172]}
                  sizes={streetSizes}
                >
                  <img
                    data-reveal="scale"
                    src={`${base}tools/maker-street.png`}
                    alt="Leonard 工具小舖的漫畫創作街景"
                    width="2172"
                    height="724"
                    loading="lazy"
                  />
                </Picture>
              </a>
              <div className="lp-tool-tags">
                <a
                  href={`${base}tools/?category=video#collection`}
                  data-reveal=""
                >
                  影片與動畫
                </a>
                <a
                  href={`${base}tools/?category=slides#collection`}
                  data-reveal=""
                >
                  簡報與表達
                </a>
                <a
                  href={`${base}tools/?category=code#collection`}
                  data-reveal=""
                >
                  程式與 AI
                </a>
                <a
                  href={`${base}tools/?category=map#collection`}
                  data-reveal=""
                >
                  地圖與資料
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-section lp-press" aria-labelledby="press-title">
          <div className="lp-container">
            <div className="lp-section-heading">
              <div data-reveal="blur">
                <p className="lp-eyebrow">IN THE NEWS</p>
                <h2 id="press-title">作品背後的紀錄</h2>
              </div>
            </div>
            <div className="lp-press-list">
              <External
                href={links.university}
                className="lp-press-row"
                data-reveal=""
                data-cursor="READ ↗"
              >
                <span>輔仁大學資管系</span>
                <strong>系友投入好理家在開發，團隊獲 AI 社會影響力獎</strong>
                <time dateTime="2025-12-10">2025.12</time>
              </External>
              <External
                href={links.award}
                className="lp-press-row"
                data-reveal=""
                data-cursor="READ ↗"
              >
                <span>好理家在・馴錢師</span>
                <strong>2025 IT Matters Awards 獲獎消息</strong>
                <time dateTime="2025-12-09">2025.12</time>
              </External>
              <External
                href={links.hospital}
                className="lp-press-row"
                data-reveal=""
                data-cursor="READ ↗"
              >
                <span>台大癌醫中心分院</span>
                <strong>乳房外科團隊獲「AI 賦能健康進行式」銅獎</strong>
                <time dateTime="2026-04-23">2026.04</time>
              </External>
            </div>
            <p className="lp-press-footnote" data-reveal="">
              也可閱讀輔大資管系的{" "}
              <External href={links.facebook}>Facebook 報導</External>。
            </p>
          </div>
        </section>

        <section
          className="lp-contact"
          id="contact"
          aria-labelledby="contact-title"
        >
          <div className="lp-container">
            <div data-reveal="blur">
              <p className="lp-eyebrow">EVERY STORY STARTS WITH A HELLO</p>
              <h2 id="contact-title">
                你的故事，
                <br />
                我也想聽。
              </h2>
            </div>
            <div data-reveal="">
              <p>
                一段正在經歷的日常、一個想解決的問題，
                <br />
                或還在醞釀的點子，都歡迎和我分享。
                <br />
                不必先有完整的計畫，從一個故事開始就好。
              </p>
              <a
                href={links.linkedin}
                className="lp-button lp-button-plane"
                target="_blank"
                rel="noopener noreferrer"
                data-magnet=""
              >
                在 LinkedIn 分享故事
                <span className="lp-plane-slot" aria-hidden="true">
                  <Arrow />
                  <svg className="lp-plane" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M3 11.5 21 3l-5 18-4.5-7.5L3 11.5Zm8.5 2L21 3"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinejoin="round"
                      fill="var(--tb-white)"
                    />
                  </svg>
                </span>
                <span className="toolbox-sr-only">（另開分頁）</span>
              </a>
            </div>
          </div>
        </section>
      </main>
      <footer className="lp-footer">
        <div className="lp-container">
          <p>© {new Date().getUTCFullYear()} 賴泰元 Leonard Lai</p>
          <span>KEEP CURIOUS. KEEP CREATING.</span>
          <a href="#top">回到頂端 ↑</a>
        </div>
      </footer>
    </div>
  );
}
