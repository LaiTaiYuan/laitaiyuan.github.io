import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { brandLogo } from "./data/brandMark";
import {
  islandRoutes,
  islandSpotCount,
  islands,
  youIsland,
} from "./data/islands";
import type { IslandId } from "./data/islands";
import type { IslandWorld } from "./islandWorld";
import { useDaypart } from "./motion";
import type { Daypart } from "./motion";

const base = import.meta.env.BASE_URL;
const dayparts: readonly { id: Daypart; short: string; label: string }[] = [
  { id: "morning", short: "晨", label: "清晨" },
  { id: "day", short: "日", label: "白天" },
  { id: "evening", short: "昏", label: "黃昏" },
  { id: "night", short: "夜", label: "夜晚" },
];

// Loads the three.js world (src/islandWorld.ts) once the section is near, and
// runs it only while the section is on screen. Until then, and wherever WebGL
// is missing or software-only, the static map stays.
function useIslandWorld(pick: (id: IslandId | null) => void) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<IslandWorld | null>(null);
  const pickRef = useRef(pick);
  const [live, setLive] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    pickRef.current = pick;
  }, [pick]);

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
              pick: (id) => pickRef.current(id),
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

export function IslandsSection() {
  const [focus, setFocus] = useState<IslandId | null>(null);
  const [spot, setSpot] = useState<number | null>(null);
  // The landmark the camera has flown up to, within the focused island.
  const [look, setLook] = useState<number | null>(null);
  const [chosenTime, setChosenTime] = useState<Daypart | null>(null);
  const taipei = useDaypart();
  const time = chosenTime ?? taipei;
  const choose = useCallback((id: IslandId | null) => {
    setFocus(id);
    setSpot(null);
    setLook(null);
  }, []);
  const world = useIslandWorld(choose);
  const { worldRef, live } = world;

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

  const current = islands.find((island) => island.id === focus);
  const looking = look === null ? undefined : current?.spots[look];
  const toggleLook = (index: number) =>
    setLook((value) => (value === index ? null : index));
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    if (look !== null) setLook(null);
    else if (focus) choose(null);
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
            再點一座島，走進它的風景。
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
            <div className="isl-hud">
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
            </div>
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
                  looking?.name ??
                  current?.id ??
                  (world.revealed ? "up" : "low")
                }
              >
                {looking ? (
                  <>
                    <strong>{looking.name}</strong>
                    {current?.lion}
                  </>
                ) : current ? (
                  current.lion
                ) : world.revealed ? (
                  <>
                    <strong>從上面看，是 LAI 😎</strong>
                    點一座島，帶你飛過去
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
