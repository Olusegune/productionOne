import { useState } from "react";
import type { EngineOption } from "../domain/imageCatalog";

/**
 * On a view that failed or is waiting: choose which engine makes it, then press Use. Nothing is sent by choosing; the button is the confirming click
 * (the spending limit still applies). Engines that are not ready say why, and one that cannot hold the character's identity says so.
 */
export function EngineSwitch({ options, current, onUse }: { options: EngineOption[]; current: { provider: string; model: string }; onUse: (option: EngineOption) => void }) {
  const choices = options.filter((o) => !(o.provider === current.provider && o.model === current.model));
  const firstReady = choices.find((o) => o.available && o.model);
  const [key, setKey] = useState<string>("");
  const picked = choices.find((o) => o.key === key) ?? firstReady;
  if (!choices.length) return null;
  return (
    <div className="engine-switch">
      <label>
        <span className="sr-only">Make this view with</span>
        <select value={picked?.key ?? ""} onChange={(e) => setKey(e.target.value)} aria-label="Make this view with">
          {choices.map((o) => (
            <option key={o.key} value={o.key} disabled={!o.available || !o.model}>{o.label}{o.note ? ` (${o.note})` : ""}</option>
          ))}
        </select>
      </label>
      <button className="secondary" disabled={!picked || !picked.available || !picked.model} onClick={() => picked && onUse(picked)}>Use {picked?.label.replace(/^On this computer: /, "") ?? "this engine"}</button>
      {picked?.note && picked.available && <small className="engine-note">{picked.note}</small>}
    </div>
  );
}
