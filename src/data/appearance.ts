import { useEffect, useSyncExternalStore } from "react";
import { DEFAULT_LOOK, accentFromPalette, savedLook, storeLook, type Look } from "../domain/appearance";

let current: Look = DEFAULT_LOOK;
const listeners = new Set<() => void>();

/** Puts a look on the page. The look's colours and fonts are CSS keyed on `data-look`; nothing else about the app changes. */
export function applyLook(look: Look, remember = true) {
  current = look;
  document.documentElement.dataset.look = look;
  if (remember) storeLook(look);
  listeners.forEach((l) => l());
}

/** Called once at start-up with the remembered look, before the first paint of the app. */
export function startLook() { applyLook(savedLook(), false); }

export function useLook(): { look: Look; setLook: (look: Look) => void } {
  const look = useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => current);
  return { look, setLook: applyLook };
}

/** In the Cinematic look the accent comes from the project's style palette; in the other looks (or with no colour in the palette) the look's own accent is used. */
export function useProjectAccent(look: Look, palette: string[]) {
  useEffect(() => {
    const root = document.documentElement;
    const accent = look === "cinematic" ? accentFromPalette(palette) : null;
    if (accent) root.style.setProperty("--accent-project", accent); else root.style.removeProperty("--accent-project");
  }, [look, palette.join("|")]);
}
