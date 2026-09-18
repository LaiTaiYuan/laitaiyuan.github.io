import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

// Shared motion hooks for both public pages. Everything here only writes
// classes and CSS custom properties; the CSS decides what (if anything) moves,
// and prefers-reduced-motion switches all of it off there.

const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = () =>
  window.matchMedia("(hover: hover) and (pointer: fine)").matches;

// Reveal on scroll: elements marked data-reveal fade up the first time they
// enter the viewport; those arriving together stagger a little.
export function useReveal(key: unknown) {
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    document.documentElement.classList.add("tb-js");
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-in)"),
    );
    if (!targets.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let order = 0;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const element = entry.target as HTMLElement;
          element.style.setProperty(
            "--reveal-delay",
            `${Math.min(order++, 6) * 85}ms`,
          );
          element.classList.add("is-in");
          observer.unobserve(element);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    targets.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [key]);
}

// Pointer parallax on a hero: layers drift a few pixels towards the cursor
// through --tb-px / --tb-py in -1..1 (fine pointers only, off under reduced
// motion).
export function useHeroParallax<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const hero = ref.current;
    if (!hero || !finePointer()) return;
    let frame = 0;
    const set = (x: number, y: number) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        hero.style.setProperty("--tb-px", x.toFixed(3));
        hero.style.setProperty("--tb-py", y.toFixed(3));
      });
    };
    const move = (event: PointerEvent) => {
      if (reducedMotion()) return;
      const rect = hero.getBoundingClientRect();
      set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        ((event.clientY - rect.top) / rect.height) * 2 - 1,
      );
    };
    const leave = () => set(0, 0);
    hero.addEventListener("pointermove", move);
    hero.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(frame);
      hero.removeEventListener("pointermove", move);
      hero.removeEventListener("pointerleave", leave);
    };
  }, []);
  return ref;
}

// Scroll parallax fallback: browsers without CSS scroll-driven animations get
// --lp-scroll (0..1 across the first viewport) written from a passive scroll
// listener; everything else is handled by animation-timeline in CSS.
export function useScrollProgress(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const target = ref.current;
    if (!target || CSS.supports("animation-timeline: scroll()")) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const progress = Math.min(
          window.scrollY / Math.max(window.innerHeight * 0.9, 1),
          1,
        );
        target.style.setProperty("--lp-scroll", progress.toFixed(4));
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [ref]);
}

// True once the page has scrolled past `threshold` pixels (header compaction).
export function useScrolled(threshold = 24) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        setScrolled(window.scrollY > threshold),
      );
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
    };
  }, [threshold]);
  return scrolled;
}

// Which of the given section ids currently sits around the middle of the
// viewport, for highlighting the matching nav link.
export function useScrollSpy(ids: readonly string[]) {
  const [active, setActive] = useState("");
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        setActive(ids.find((id) => visible.has(id)) ?? "");
      },
      { rootMargin: "-35% 0px -55% 0px" },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [ids]);
  return active;
}

// 3D tilt: elements marked data-tilt lean towards the cursor through
// --lp-rx / --lp-ry (degrees), easing back when the pointer leaves.
export function useTilt(maxDegrees = 6) {
  useEffect(() => {
    if (!finePointer()) return;
    const cleanups = Array.from(
      document.querySelectorAll<HTMLElement>("[data-tilt]"),
    ).map((element) => {
      let frame = 0;
      const set = (x: number, y: number) => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          element.style.setProperty(
            "--lp-rx",
            `${(-y * maxDegrees).toFixed(2)}deg`,
          );
          element.style.setProperty(
            "--lp-ry",
            `${(x * maxDegrees).toFixed(2)}deg`,
          );
        });
      };
      const move = (event: PointerEvent) => {
        if (reducedMotion()) return;
        const rect = element.getBoundingClientRect();
        set(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          ((event.clientY - rect.top) / rect.height) * 2 - 1,
        );
      };
      const leave = () => set(0, 0);
      element.addEventListener("pointermove", move);
      element.addEventListener("pointerleave", leave);
      return () => {
        cancelAnimationFrame(frame);
        element.removeEventListener("pointermove", move);
        element.removeEventListener("pointerleave", leave);
      };
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [maxDegrees]);
}
