import { useEffect, useState } from "react";

const cache = new Map<string, string>();

/** Shows a real saved file (inside the app's assets folder) or says plainly that there is none. Never shows stock art. */
export function RealImage({ path, label, empty }: { path?: string; label: string; empty: string }) {
  const [src, setSrc] = useState<string | null>(path ? (cache.get(path) ?? null) : null);
  useEffect(() => {
    if (!path) { setSrc(null); return; }
    if (cache.has(path)) { setSrc(cache.get(path)!); return; }
    if (!("__TAURI_INTERNALS__" in window)) return;
    let live = true;
    void import("@tauri-apps/api/core")
      .then(({ invoke }) => invoke<string>("image_preview", { path, maxEdge: 900 }))
      .then((url) => { cache.set(path, url); if (live) setSrc(url); })
      .catch(() => { if (live) setSrc(null); });
    return () => { live = false; };
  }, [path]);
  return src ? <img src={src} alt={label} /> : <div className="real-empty" role="img" aria-label={empty}>{empty}</div>;
}
