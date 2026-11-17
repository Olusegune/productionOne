import { useId, useState } from "react";
import type { EngineOption } from "../domain/imageCatalog";

/**
 * On a view that failed or is waiting: choose which engine makes it from a drop-down, then press Use. The newest of each family come first, then every other image
 * model. An engine that cannot be used says why in its entry, and the reason for the chosen one is written under the field. Nothing is sent by choosing; the
 * button is the confirming click (the spending limit still applies).
 */
export function EngineSwitch({ options, current, onUse }: { options: EngineOption[]; current: { provider: string; model: string }; onUse: (option: EngineOption) => void }) {
  const id = useId();
  const isCurrent = (o: EngineOption) => o.provider === current.provider && o.model === current.model;
  const usable = (o: EngineOption) => o.available && !!o.model;
  const firstReady = options.find(usable);
  const [key, setKey] = useState<string>("");
  const picked = options.find((o) => o.key === key) ?? firstReady;
  if (!options.length) return null;
  const text = (o: EngineOption) => `${o.label}${isCurrent(o) ? " (used before)" : ""}${usable(o) ? "" : ` — ${o.note}`}`;
  const group = (g: "latest" | "other") => options.filter((o) => o.group === g).map((o) => <option key={o.key} value={o.key} disabled={!usable(o)}>{text(o)}</option>);
  const hasOther = options.some((o) => o.group === "other");
  return (
    <div className="engine-switch">
      <label htmlFor={id} className="engine-label">Make this view with</label>
      <select id={id} value={picked?.key ?? ""} onChange={(e) => setKey(e.target.value)}>
        <optgroup label="Newest models">{group("latest")}</optgroup>
        {hasOther && <optgroup label="Other image models">{group("other")}</optgroup>}
      </select>
      {picked?.note && usable(picked) && <small className="engine-note">{picked.note}</small>}
      <button className="secondary" disabled={!picked || !usable(picked)} onClick={() => picked && onUse(picked)}>Use {picked?.label.replace(/^On this computer: /, "") ?? "this engine"}</button>
    </div>
  );
}
