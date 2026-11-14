import { useEffect, useState } from "react";

export interface SectionLink { id: string; label: string }

/** Sticky in-page navigation for long screens: jumps to a section and follows the reader as they scroll. */
export function SectionNav({ sections, label = "On this page" }: { sections: SectionLink[]; label?: string }) {
  const [current, setCurrent] = useState(sections[0]?.id ?? "");
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const seen = new Map<string, number>();
    const observer = new IntersectionObserver((entries) => {
      for (const e of entries) seen.set(e.target.id, e.isIntersecting ? e.boundingClientRect.top : Number.POSITIVE_INFINITY);
      const top = [...seen.entries()].filter(([, y]) => Number.isFinite(y)).sort((a, b) => Math.abs(a[1]) - Math.abs(b[1]))[0];
      if (top) setCurrent(top[0]);
    }, { rootMargin: "-90px 0px -55% 0px", threshold: [0, 0.1] });
    sections.forEach((s) => { const el = document.getElementById(s.id); if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [sections]);
  const go = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
    setCurrent(id);
  };
  return (
    <nav className="section-nav" aria-label={label}>
      {sections.map((s) => (
        <button key={s.id} type="button" className={current === s.id ? "on" : ""} aria-current={current === s.id ? "location" : undefined} onClick={() => go(s.id)}>{s.label}</button>
      ))}
    </nav>
  );
}
