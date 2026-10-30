// Visit counts on GoatCounter (https://leonardlai.goatcounter.com), the
// open-source counter that sets no cookies and keeps no personal data.
// count.js records each page view with where the visitor came from; track()
// adds named events for what people do here. Each event counts once per page
// load, so the dashboard reads "how many visits did this", not how many times
// one person clicked.
const endpoint = "https://leonardlai.goatcounter.com/count";

type Hit = { path: string; title: string; event: true };

declare global {
  interface Window {
    goatcounter?: { count?: (hit: Hit) => void };
  }
}

const sent = new Set<string>();
const waiting: Hit[] = [];

export function track(path: string, title: string) {
  if (typeof window === "undefined" || sent.has(path)) return;
  sent.add(path);
  const hit: Hit = { path, title: title.slice(0, 100), event: true };
  if (window.goatcounter?.count) window.goatcounter.count(hit);
  else waiting.push(hit);
}

// What a visitor would call the element: its label, else its text, without
// the screen-reader note that a link opens a new tab.
function nameOf(element: Element) {
  return (element.getAttribute("aria-label") ?? element.textContent ?? "")
    .replace("（另開分頁）", "")
    .replace(/\s+/g, " ")
    .trim();
}

// Clicks on anything marked data-track (data-track-title names it when its
// label would not), and on links that leave the site: Spotify, the tools'
// homes, LinkedIn. A middle click opens a link too.
function onClick(event: MouseEvent) {
  if (event.type === "auxclick" && event.button !== 1) return;
  if (!(event.target instanceof Element)) return;
  const marked = event.target.closest<HTMLElement>("[data-track]");
  if (marked?.dataset.track) {
    track(marked.dataset.track, marked.dataset.trackTitle ?? nameOf(marked));
    return;
  }
  const link = event.target.closest("a[href]");
  if (
    !(link instanceof HTMLAnchorElement) ||
    !link.protocol.startsWith("http") ||
    link.host === window.location.host
  )
    return;
  let path = `${link.host}${link.pathname}`.replace(/\/$/, "");
  try {
    path = decodeURIComponent(path);
  } catch {
    // Not valid percent-encoding: keep it as written.
  }
  track(`out/${path}`, nameOf(link));
}

// How far people read: a section counts once it has stayed in view for two
// seconds (40% of it, or 40% of the screen when it is taller), so scrolling
// straight past does not, and the short last section still can.
function watchSections() {
  if (!("IntersectionObserver" in window)) return;
  const page = window.location.pathname.replace(/^\/|\/$/g, "") || "home";
  const timers = new Map<Element, number>();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const { target } = entry;
        if (
          entry.intersectionRatio < 0.4 &&
          entry.intersectionRect.height < window.innerHeight * 0.4
        ) {
          window.clearTimeout(timers.get(target));
          timers.delete(target);
          continue;
        }
        if (timers.has(target)) continue;
        const timer = window.setTimeout(() => {
          observer.unobserve(target);
          const heading = document.getElementById(
            target.getAttribute("aria-labelledby") ?? "",
          );
          track(
            `read/${page}/${target.id}`,
            `看到：${nameOf(heading ?? target)}`,
          );
        }, 2000);
        timers.set(target, timer);
      }
    },
    { threshold: Array.from({ length: 11 }, (_, step) => step / 10) },
  );
  for (const section of document.querySelectorAll("main section[id]"))
    observer.observe(section);
}

// Loads count.js as GoatCounter's own snippet does. It skips localhost, and
// `npm run dev` does not load it at all, so local work stays out of the numbers.
export function startAnalytics() {
  if (import.meta.env.DEV) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://gc.zgo.at/count.js";
  script.dataset.goatcounter = endpoint;
  script.addEventListener("load", () => {
    for (const hit of waiting.splice(0)) window.goatcounter?.count?.(hit);
  });
  document.head.append(script);
  document.addEventListener("click", onClick, true);
  document.addEventListener("auxclick", onClick, true);
  watchSections();
}
