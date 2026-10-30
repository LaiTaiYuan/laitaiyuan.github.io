import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { track } from "./analytics";
import { brandLogo } from "./data/brandMark";
import { allEggsLine, islandEggs, playLines } from "./data/islandPlay";
import type { EggId, PlayAct, PlayId } from "./data/islandPlay";
import {
  islandRoutes,
  islandSpotCount,
  islands,
  youIsland,
} from "./data/islands";
import type { IslandId } from "./data/islands";
import type { IslandEvents, IslandWorld } from "./islandWorld";
import { useDaypart } from "./motion";
import type { Daypart } from "./motion";

const base = import.meta.env.BASE_URL;
const dayparts: readonly { id: Daypart; short: string; label: string }[] = [
  { id: "morning", short: "晨", label: "清晨" },
  { id: "day", short: "日", label: "白天" },
  { id: "evening", short: "昏", label: "黃昏" },
  { id: "night", short: "夜", label: "夜晚" },
];
const konami = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

type Handlers = Pick<IslandEvents, "pick" | "look" | "play" | "turned">;

// Loads the three.js world (src/islandWorld.ts) once the section is near, and
// runs it only while the section is on screen. Until then, and wherever WebGL
// is missing or software-only, the static map stays.
function useIslandWorld(handlers: Handlers) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<IslandWorld | null>(null);
  const handlersRef = useRef(handlers);
  const [live, setLive] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (
      !stage ||
      !canvas ||
      !("IntersectionObserver" in window) ||
      !("ResizeObserver" in window)
    )
      return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let world: IslandWorld | null = null;
    let visible = false;
    let cancelled = false;
    const drop = () => {
      world?.destroy();
      world = null;
      worldRef.current = null;
      setLive(false);
    };
    const start = () =>
      import("./islandWorld").then(
        ({ createIslandWorld }) => {
          if (cancelled) return;
          world = createIslandWorld(
            stage,
            canvas,
            {
              pick: (id) => handlersRef.current.pick(id),
              look: (index) => handlersRef.current.look(index),
              play: (id, act, eggs) => handlersRef.current.play(id, act, eggs),
              turned: (on) => handlersRef.current.turned(on),
              reveal: () => setRevealed(true),
              lost: drop,
            },
            still,
          );
          if (!world) return;
          worldRef.current = world;
          setLive(true);
          world.run(visible);
        },
        () => {}, // the chunk did not load: keep the static map
      );
    const near = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        near.disconnect();
        start();
      },
      { rootMargin: "120% 0px" },
    );
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      world?.run(visible);
    });
    near.observe(stage);
    seen.observe(stage);
    return () => {
      cancelled = true;
      near.disconnect();
      seen.disconnect();
      drop();
    };
  }, []);

  return { stageRef, canvasRef, worldRef, live, revealed };
}

// The archipelago drawn flat: what shows before the 3D world loads, without
// JavaScript, under WebGL that is missing or software-only.
function IslandMap({
  focus,
  pick,
}: {
  focus: IslandId | null;
  pick: (id: IslandId) => void;
}) {
  const { x, y, width, height } = brandLogo.i;
  const shape = (id: IslandId) => ({
    className: focus === id ? "isl-map-land is-focus" : "isl-map-land",
    onClick: () => pick(id),
  });
  return (
    <svg className="isl-map" viewBox="0 8 222 224" aria-hidden="true">
      <defs>
        <pattern
          id="isl-halftone"
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <circle cx="3" cy="3" r="1.3" />
        </pattern>
      </defs>
      <rect
        className="isl-map-sea"
        x="-400"
        y="-200"
        width="1022"
        height="640"
      />
      <rect
        x="-400"
        y="-200"
        width="1022"
        height="640"
        fill="url(#isl-halftone)"
      />
      <g {...shape("l")}>
        <polygon points={brandLogo.l} />
      </g>
      <g {...shape("a")}>
        <polygon points={brandLogo.aLeft} />
        <polygon className="isl-map-light" points={brandLogo.aRight} />
        <path className="isl-map-star" d={brandLogo.star} />
      </g>
      <g {...shape("i")}>
        <rect x={x} y={y} width={width} height={height} />
      </g>
      <g {...shape("you")}>
        <circle
          className="isl-map-blank"
          cx={youIsland.center[0]}
          cy={youIsland.center[1]}
          r={youIsland.radius}
        />
      </g>
      {islands.map((island) =>
        island.spots.map((spot, index) => (
          <circle
            key={`${island.id}-${index}`}
            className="isl-map-spot"
            cx={spot.at[0]}
            cy={spot.at[1]}
            r="3.2"
          />
        )),
      )}
    </svg>
  );
}

// The eggs found in this browser, kept between visits where storage works.
const eggStore = "lai-islands-eggs";
const storage = {
  get() {
    try {
      return window.localStorage.getItem(eggStore);
    } catch {
      return null;
    }
  },
  set(value: string) {
    try {
      window.localStorage.setItem(eggStore, value);
    } catch {
      // Private mode or blocked storage: the eggs are there to find again.
    }
  },
};

type Said = { key: number; name: string; line: string };

// What the islands say back (data/islandPlay.ts): the lion's bubble, the note
// when an easter egg turns up, and the eggs this browser has found.
function useIslandPlay() {
  const [say, setSay] = useState<Said | null>(null);
  const [toast, setToast] = useState<{ key: number; text: string } | null>(
    null,
  );
  const [found, setFound] = useState<ReadonlySet<EggId>>(() => new Set());
  const [heard, setHeard] = useState("");
  const foundRef = useRef(found);
  const told = useRef(new Map<string, number>());
  const count = useRef(0);
  const hints = useRef(0);
  // Set while a button speaks for the islands, so screen readers hear the
  // answer too (the bubble itself is decoration).
  const aloud = useRef(false);

  useEffect(() => {
    const saved = storage.get();
    if (!saved) return;
    try {
      const ids: unknown = JSON.parse(saved);
      if (!Array.isArray(ids)) return;
      const next = new Set(
        islandEggs.map((egg) => egg.id).filter((id) => ids.includes(id)),
      );
      foundRef.current = next;
      setFound(next);
    } catch {
      // Unreadable: start the hunt over.
    }
  }, []);
  useEffect(() => {
    if (!say) return;
    const timer = window.setTimeout(() => setSay(null), 5200);
    return () => window.clearTimeout(timer);
  }, [say]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const speak = useCallback((name: string, line: string) => {
    count.current += 1;
    setSay({ key: count.current, name, line });
    if (aloud.current)
      setHeard(`${name}：${line}${count.current % 2 ? " " : ""}`);
  }, []);
  const play = useCallback(
    (id: PlayId, act: PlayAct, eggs?: readonly EggId[]) => {
      const fresh = eggs?.find((egg) => !foundRef.current.has(egg));
      const egg = islandEggs.find((item) => item.id === fresh);
      if (egg) {
        const next = new Set(foundRef.current).add(egg.id);
        foundRef.current = next;
        setFound(next);
        storage.set(JSON.stringify([...next]));
        track(`island/egg/${egg.id}`, `彩蛋：${egg.name}`);
        if (next.size === islandEggs.length)
          track("island/egg/all", "彩蛋全部找到");
        speak(`彩蛋：${egg.name}`, egg.line);
        setToast({
          key: count.current,
          text:
            next.size === islandEggs.length
              ? allEggsLine
              : `找到彩蛋 ${next.size}/${islandEggs.length}：${egg.name}`,
        });
        return;
      }
      const entry = playLines[id];
      track(`island/play/${id}`, `玩：${entry.name}`);
      const lines = entry[act] ?? entry.poke;
      const key = `${id}.${act}`;
      const turn = told.current.get(key) ?? 0;
      told.current.set(key, turn + 1);
      speak(entry.name, lines[turn % lines.length]);
    },
    [speak],
  );
  // The counter's hint: the next egg still hidden, in turn.
  const hint = useCallback(() => {
    const left = islandEggs.filter((egg) => !foundRef.current.has(egg.id));
    if (!left.length) {
      speak("彩蛋", allEggsLine);
      return;
    }
    speak("提示", left[hints.current % left.length].hint);
    hints.current += 1;
  }, [speak]);
  const out = useCallback((act: () => void) => {
    aloud.current = true;
    act();
    aloud.current = false;
  }, []);
  return { say, toast, found, heard, play, hint, out };
}

export function IslandsSection() {
  const [focus, setFocus] = useState<IslandId | null>(null);
  const [spot, setSpot] = useState<number | null>(null);
  // The landmark the camera has flown up to, within the focused island.
  const [look, setLook] = useState<number | null>(null);
  // The visitor has dragged the view away from its framing.
  const [turned, setTurned] = useState(false);
  const [chosenTime, setChosenTime] = useState<Daypart | null>(null);
  const taipei = useDaypart();
  const time = chosenTime ?? taipei;
  const choose = useCallback((id: IslandId | null) => {
    setFocus(id);
    setSpot(null);
    setLook(null);
  }, []);
  const fun = useIslandPlay();
  const { play } = fun;
  const world = useIslandWorld({
    pick: choose,
    look: setLook,
    play,
    turned: setTurned,
  });
  const { worldRef, live, stageRef } = world;

  // ↑↑↓↓←→←→BA while the islands are on screen: everyone parties.
  useEffect(() => {
    let at = 0;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest("input, textarea, select, [contenteditable]")
      )
        return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      at = key === konami[at] ? at + 1 : key === konami[0] ? 1 : 0;
      if (at < konami.length) return;
      at = 0;
      const rect = stageRef.current?.getBoundingClientRect();
      if (!rect || rect.bottom < 0 || rect.top > window.innerHeight) return;
      worldRef.current?.party();
      play("konami", "poke", ["konami"]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [play, stageRef, worldRef]);

  useEffect(() => {
    worldRef.current?.focus(focus);
  }, [focus, live, worldRef]);
  useEffect(() => {
    worldRef.current?.light(time);
  }, [time, live, worldRef]);
  useEffect(() => {
    worldRef.current?.spot(spot);
  }, [spot, live, worldRef]);
  useEffect(() => {
    worldRef.current?.look(look);
  }, [look, focus, live, worldRef]);

  const hudRef = useRef<HTMLDivElement>(null);
  const current = islands.find((island) => island.id === focus);
  const looking = look === null ? undefined : current?.spots[look];
  // Which islands, and which stories on them, people open.
  useEffect(() => {
    if (current) track(`island/visit/${current.id}`, `上島：${current.name}`);
  }, [current]);
  useEffect(() => {
    if (current && looking)
      track(`island/look/${current.id}${look}`, `看：${looking.name}`);
  }, [current, look, looking]);
  const toggleLook = (index: number) =>
    setLook((value) => (value === index ? null : index));
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    const fromHud =
      event.target instanceof Node && hudRef.current?.contains(event.target);
    if (look !== null) setLook(null);
    else if (focus) choose(null);
    else return;
    // The HUD button that had focus may be gone now (「戳一下」, or the back
    // button itself); keep keyboard focus close by so Escape keeps working.
    if (fromHud)
      window.requestAnimationFrame(() => {
        if (document.activeElement !== document.body) return;
        (
          hudRef.current?.querySelector<HTMLButtonElement>(".isl-back") ??
          document.querySelector<HTMLButtonElement>(
            `.isl-entry[data-island="${focus}"] h3 button`,
          )
        )?.focus();
      });
  };

  return (
    <section
      className="lp-section lp-islands"
      id="islands"
      aria-labelledby="islands-title"
      onKeyDown={onKeyDown}
    >
      <div className="lp-container">
        <div className="lp-section-heading">
          <div data-reveal="blur">
            <p className="lp-eyebrow">LAI ISLANDS</p>
            <h2 id="islands-title">
              這片群島，
              <br />
              藏著一個<span className="lp-underline">名字。</span>
            </h2>
          </div>
          <p data-reveal="">
            每座島是一段故事：寫程式的、做 AI 的、唱歌的，
            <br />
            還有一座留給你。等鏡頭從海面飛上天空，
            <br />
            再點一座島，走進它的風景。拖曳可以轉動群島、
            <br />
            抱起島上的動物，還藏著 {islandEggs.length} 個彩蛋。
          </p>
        </div>
        <div className="isl-board" data-live={live ? "" : undefined}>
          <div
            className="isl-stage"
            ref={world.stageRef}
            data-live={live ? "" : undefined}
            data-focus={focus ?? undefined}
            data-spot={spot ?? undefined}
            data-look={look ?? undefined}
            data-time={time}
          >
            <IslandMap focus={focus} pick={choose} />
            <canvas
              className="isl-canvas"
              ref={world.canvasRef}
              aria-hidden="true"
            />
            <div className="isl-tags" aria-hidden="true">
              {islands.map((island) => (
                <button
                  type="button"
                  tabIndex={-1}
                  key={island.id}
                  className="isl-tag"
                  data-isl-tag=""
                  data-island={island.id}
                  onClick={() => choose(island.id)}
                >
                  <span>
                    <b>{island.letter}</b>
                    {island.name}
                  </span>
                </button>
              ))}
            </div>
            <div className="isl-pins" aria-hidden="true">
              {islands.map((island) =>
                island.spots.map((item, index) => (
                  <button
                    type="button"
                    tabIndex={-1}
                    key={`${island.id}-${index}`}
                    className="isl-pin"
                    data-isl-pin=""
                    data-island={island.id}
                    data-spot={index}
                    onClick={() => focus === island.id && toggleLook(index)}
                  >
                    <span>{index + 1}</span>
                  </button>
                )),
              )}
            </div>
            <div className="isl-hud" ref={hudRef}>
              <div className="isl-hud-main">
                {focus && (
                  <button
                    type="button"
                    className="isl-back"
                    onClick={() => (looking ? setLook(null) : choose(null))}
                  >
                    <span aria-hidden="true">←</span>{" "}
                    {looking ? `回到${current?.name}` : "回到群島"}
                  </button>
                )}
                {looking && (
                  <button
                    type="button"
                    className="isl-back isl-poke"
                    onClick={() => fun.out(() => worldRef.current?.poke())}
                  >
                    <span aria-hidden="true">👆</span> 戳一下
                  </button>
                )}
                {turned && (
                  <button
                    type="button"
                    className="isl-back"
                    onClick={() => worldRef.current?.straighten()}
                  >
                    <span aria-hidden="true">↺</span> 轉回正面
                  </button>
                )}
              </div>
              <div className="isl-hud-side">
                <div className="isl-time" role="group" aria-label="群島的時間">
                  {dayparts.map((part) => (
                    <button
                      type="button"
                      key={part.id}
                      aria-pressed={time === part.id}
                      aria-label={part.label}
                      title={part.label}
                      onClick={() =>
                        setChosenTime(part.id === taipei ? null : part.id)
                      }
                    >
                      {part.short}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="isl-eggs"
                  aria-label={`彩蛋：找到 ${fun.found.size} 個，共 ${islandEggs.length} 個。聽一個提示`}
                  title="彩蛋提示"
                  data-track="island/hint"
                  data-track-title="聽彩蛋提示"
                  onClick={() => fun.out(fun.hint)}
                >
                  <span aria-hidden="true">🥚</span>
                  <span>
                    <b>{fun.found.size}</b>/{islandEggs.length}
                  </span>
                </button>
              </div>
            </div>
            <p className="isl-toast" role="status">
              {fun.toast && (
                <span key={fun.toast.key}>
                  <span aria-hidden="true">🥚 </span>
                  {fun.toast.text}
                </span>
              )}
            </p>
            <p className="toolbox-sr-only" aria-live="polite">
              {fun.heard}
            </p>
            <p className="isl-lion" aria-hidden="true">
              <img
                src={`${base}images/lion/head.webp`}
                alt=""
                width="303"
                height="384"
                loading="lazy"
                decoding="async"
              />
              <span
                key={
                  fun.say
                    ? `say-${fun.say.key}`
                    : (looking?.name ??
                      current?.id ??
                      (world.revealed ? "up" : "low"))
                }
              >
                {fun.say ? (
                  <>
                    <strong>{fun.say.name}</strong>
                    {fun.say.line}
                  </>
                ) : looking ? (
                  <>
                    <strong>{looking.name}</strong>
                    {current?.lion}
                  </>
                ) : current ? (
                  current.lion
                ) : world.revealed ? (
                  <>
                    <strong>從上面看，是 LAI 😎</strong>
                    點島飛過去，拖曳可以轉一圈
                  </>
                ) : (
                  "抓好，要起飛囉 ✈️"
                )}
              </span>
            </p>
          </div>

          <div className="isl-index">
            <p className="isl-index-head">
              <b>島嶼導覽</b>
              {islands.length} 座島 ／ {islandSpotCount} 個地標
            </p>
            <ol className="isl-list">
              {islands.map((island) => {
                const open = focus === island.id;
                return (
                  <li
                    key={island.id}
                    className={open ? "isl-entry is-open" : "isl-entry"}
                    data-island={island.id}
                  >
                    <h3>
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-controls={`isl-${island.id}`}
                        onClick={() => choose(open ? null : island.id)}
                      >
                        <span className="isl-letter" aria-hidden="true">
                          {island.letter}
                        </span>
                        <span className="isl-name">
                          {island.letter === "你"
                            ? island.name
                            : `${island.letter}・${island.name}`}
                          <small>{island.spots.length} 個地標</small>
                        </span>
                      </button>
                    </h3>
                    <div className="isl-detail" id={`isl-${island.id}`}>
                      <p className="isl-line">{island.line}</p>
                      <ol className="isl-spots">
                        {island.spots.map((item, index) => (
                          <li
                            key={item.name}
                            className={
                              open && look === index ? "is-looking" : undefined
                            }
                            onPointerEnter={() => open && setSpot(index)}
                            onPointerLeave={() => setSpot(null)}
                            onFocus={() => open && setSpot(index)}
                            onBlur={() => setSpot(null)}
                          >
                            <b className="isl-num" aria-hidden="true">
                              {index + 1}
                            </b>
                            <div>
                              <h4>
                                <button
                                  type="button"
                                  aria-pressed={open && look === index}
                                  onClick={() => open && toggleLook(index)}
                                >
                                  {item.name}
                                  <span className="isl-zoom" aria-hidden="true">
                                    近看
                                  </span>
                                  <span className="toolbox-sr-only">
                                    ，在群島上近看
                                  </span>
                                </button>
                              </h4>
                              <p>{item.text}</p>
                              <a
                                href={item.link.href}
                                {...(item.link.external
                                  ? {
                                      target: "_blank",
                                      rel: "noopener noreferrer",
                                    }
                                  : {})}
                              >
                                {item.link.label}
                                {item.link.external && (
                                  <span className="toolbox-sr-only">
                                    （另開分頁）
                                  </span>
                                )}{" "}
                                <span aria-hidden="true">→</span>
                              </a>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="isl-routes">
              <p>島上的動物在搬什麼？</p>
              <ul>
                {islandRoutes.map((route) => (
                  <li key={route.id} data-route={route.id}>
                    <b aria-hidden="true">{route.verb}</b>
                    <span>
                      <strong>{route.animal}</strong>
                      {route.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
