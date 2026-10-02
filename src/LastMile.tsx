import type { CSSProperties } from "react";
import { BrandLogo } from "./BrandMark";
import {
  mileProlog,
  mileRests,
  mileSongs,
  mileStops,
  mileSubtitle,
  mileWish,
} from "./data/lastMile";
import { MileGlyph } from "./MileGlyph";
import {
  PROLOGUE,
  TITLE,
  sceneOfStop,
  sunriseScene,
  useLastMile,
} from "./mileRoad";

const base = import.meta.env.BASE_URL;
const two = (n: number) => String(n).padStart(2, "0");
const sunrise = sunriseScene(mileStops.length);
// Where on the mile each stop sits (the odometer reads the same number when
// the camera holds there).
const mileAt = (stop: number) => (sceneOfStop(stop) / sunrise).toFixed(2);

export default function LastMile() {
  const film = useLastMile(mileStops);
  return (
    <div className="mile-page" id="top">
      <a className="toolbox-skip" href="#main">
        跳至主要內容
      </a>
      <header className="mile-header">
        <div className="mile-container mile-header-inner">
          <a
            className="mile-brand"
            href={base}
            aria-label="賴泰元 Leonard Lai 個人網站首頁"
          >
            <span className="mile-monogram" aria-hidden="true">
              <BrandLogo />
            </span>
            <span>
              LEONARD LAI<small>賴泰元的創作基地</small>
            </span>
          </a>
          <nav aria-label="人生最後一哩路導覽">
            <a href={base}>個人首頁</a>
            <a href={`${base}#music`}>音樂</a>
            <a href="#credits">片尾名單</a>
          </nav>
        </div>
      </header>

      <main id="main">
        <section
          className={film.live ? "mile-film is-live" : "mile-film"}
          ref={film.sectionRef}
          aria-labelledby="mile-title"
          style={{ "--mile-stops": mileStops.length } as CSSProperties}
        >
          <div className="mile-stage">
            <div className="mile-sky" aria-hidden="true">
              <span className="mile-sun" />
            </div>
            <canvas
              className="mile-canvas"
              ref={film.canvasRef}
              aria-hidden="true"
            />
            <div className="mile-vignette" aria-hidden="true" />

            <div
              className={
                film.scene === TITLE ? "mile-intro is-active" : "mile-intro"
              }
            >
              <p className="mile-presents">賴泰元 LEONARD LAI 出品</p>
              <h1 id="mile-title">
                我的人生
                <br />
                最後一哩路
              </h1>
              <p className="mile-subtitle">
                <span>{mileSubtitle}</span>
              </p>
              <p className="mile-dream">
                <span>把身邊遇到的人、事、物，</span>
                <span>都寫成歌。</span>
              </p>
              <p className="mile-legend">
                <MileGlyph songs={1} />
                寫好的歌，是路邊發光的音符
                <MileGlyph songs={0} />
                還在等的，先留一個休止符
              </p>
              <p className="mile-tally">
                已完成 <b>{mileSongs}</b> 首 · 還有 <b>{mileRests}</b> 個休止符
              </p>
              <a
                className="mile-cue"
                href="#mile-prologue"
                onClick={(event) => {
                  if (!film.live) return;
                  event.preventDefault();
                  film.goTo(PROLOGUE);
                }}
              >
                往下捲，開始這一哩路 <span aria-hidden="true">↓</span>
              </a>
            </div>

            <div
              id="mile-prologue"
              className={
                film.scene === PROLOGUE
                  ? "mile-prologue is-active"
                  : "mile-prologue"
              }
            >
              <p className="mile-presents">PROLOGUE · 序</p>
              <p className="mile-prologue-lines">
                {mileProlog.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </p>
              <p className="mile-wish">{mileWish}</p>
            </div>

            <ol className="mile-stops">
              {mileStops.map((stop, index) => {
                const at = index + 1;
                const active = film.scene === sceneOfStop(at);
                return (
                  <li
                    key={stop.who}
                    id={`mile-stop-${at}`}
                    className={[
                      "mile-stop",
                      stop.songs ? "is-written" : "is-waiting",
                      active ? "is-active" : "",
                      at % 2 ? "on-left" : "on-right",
                    ].join(" ")}
                    aria-current={active ? "step" : undefined}
                  >
                    <p className="mile-stop-mark">
                      STOP {two(at)} · MILE {mileAt(at)}
                    </p>
                    <h2>{stop.who}</h2>
                    <p className="mile-stop-status">
                      <MileGlyph songs={stop.songs} />
                      {stop.songs
                        ? `已完成 ${stop.songs} 首`
                        : "還沒寫，先留一個休止符"}
                    </p>
                    <p className="mile-stop-story">{stop.story}</p>
                    {stop.note && <p className="mile-stop-note">{stop.note}</p>}
                  </li>
                );
              })}
            </ol>

            <div
              className={
                film.scene === sunrise ? "mile-finale is-active" : "mile-finale"
              }
            >
              <p className="mile-stop-mark">MILE 1.00 · SUNRISE</p>
              <h2>
                目前寫好 {mileSongs} 首，
                <br />
                還有 {mileRests} 個休止符在路上。
              </h2>
              <p>這一哩路，我想一首一首寫完。</p>
              <p className="mile-wish">
                願這些歌成為經典，一代一代，持續詠唱。
              </p>
              <a className="mile-button" href="#credits">
                看片尾名單 <span aria-hidden="true">↓</span>
              </a>
            </div>

            <div className="mile-hud">
              <p className="mile-odometer" aria-hidden="true">
                MILE <b ref={film.odometerRef}>0.00</b> / 1.00
              </p>
              <div
                className="mile-steps"
                role="group"
                aria-label="這一哩路上的每一站"
              >
                {mileStops.map((stop, index) => (
                  <button
                    type="button"
                    key={stop.who}
                    className={stop.songs ? "is-written" : "is-waiting"}
                    aria-label={`第 ${index + 1} 站：${stop.who}${
                      stop.songs ? `，已完成 ${stop.songs} 首` : "，還沒寫"
                    }`}
                    aria-current={
                      film.scene === sceneOfStop(index + 1) ? "step" : undefined
                    }
                    onClick={() => film.goTo(sceneOfStop(index + 1))}
                  >
                    <span />
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="mile-sound"
                aria-pressed={film.sound}
                onClick={film.toggleSound}
              >
                <span aria-hidden="true">♪</span>
                {film.sound ? "聲音開" : "聲音關"}
              </button>
            </div>
            <div className="mile-grain" aria-hidden="true" />
            <div className="mile-bars" aria-hidden="true" />
          </div>
        </section>

        <section
          className="mile-credits"
          id="credits"
          aria-labelledby="credits-title"
        >
          <div className="mile-container mile-credits-roll">
            <p className="mile-presents">END CREDITS</p>
            <h2 id="credits-title">片尾名單</h2>
            <p className="mile-credits-lead">
              這一路上的每一首歌，都寫給這些人。
            </p>
            <dl className="mile-credits-list">
              {mileStops.map((stop) => (
                <div
                  key={stop.who}
                  className={stop.songs ? "is-written" : "is-waiting"}
                >
                  <dt>{stop.who}</dt>
                  <dd>
                    {stop.songs ? `${stop.songs} 首` : "還在路上"}
                    {stop.note && <small>{stop.note}</small>}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mile-credits-thanks">
              以及這一路上，每一個讓我想寫歌的人。
            </p>
            <dl className="mile-credits-list mile-credits-author">
              <div>
                <dt>寫歌的人</dt>
                <dd>賴泰元 Leonard</dd>
              </div>
            </dl>
            <p className="mile-wish mile-credits-wish">{mileWish}</p>
            <p className="mile-tbc">
              未完待續<span>TO BE CONTINUED · 持續詠唱</span>
            </p>
            <div className="mile-credits-links">
              <a className="mile-button" href={`${base}#music`}>
                先聽已經發表的歌 <span aria-hidden="true">♪</span>
              </a>
              <a className="mile-text-link" href={`${base}#contact`}>
                你也在這條路上嗎？跟我聊聊我們的故事
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="mile-footer">
        <div className="mile-container">
          <p>© {new Date().getUTCFullYear()} 賴泰元 Leonard Lai</p>
          <span>ONE SONG AT A TIME.</span>
          <a href="#top">回到頂端 ↑</a>
        </div>
      </footer>
    </div>
  );
}
