import type { KeyboardEvent } from "react";

/**
 * Keyboard use of a row of tabs: Left and Right move to the previous or next tab (wrapping round), Home and End go to the first and last. Returns the tab to
 * open, or undefined when the key is not one of these. Only the open tab is reachable with the Tab key, so without this a keyboard user cannot change tab.
 */
export function nextTab(ids: string[], current: string, key: string): string | undefined {
  if (ids.length === 0) return undefined;
  const i = Math.max(0, ids.indexOf(current));
  if (key === "Home") return ids[0];
  if (key === "End") return ids[ids.length - 1];
  if (key === "ArrowRight") return ids[(i + 1) % ids.length];
  if (key === "ArrowLeft") return ids[(i - 1 + ids.length) % ids.length];
  return undefined;
}

/** A key handler for a tab list: opens the tab and moves focus to it. `idOf` gives the element id of a tab button. */
export function tabListKeys(ids: string[], current: string, open: (id: string) => void, idOf: (id: string) => string) {
  return (event: KeyboardEvent) => {
    const to = nextTab(ids, current, event.key);
    if (to === undefined) return;
    event.preventDefault();
    open(to);
    window.requestAnimationFrame(() => document.getElementById(idOf(to))?.focus());
  };
}
