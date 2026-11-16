import { useId, useState } from "react";
import type { EngineOption } from "../domain/imageCatalog";

/**
 * On a view that failed or is waiting: choose which engine makes it, then press Use. The choices are an inline list, not a pop-up, so every engine and the reason
 * it cannot be used is readable at once. Nothing is sent by choosing; the button is the confirming click (the spending limit still applies).
 */
export function EngineSwitch({ options, current, onUse }: { options: EngineOption[]; current: { provider: string; model: string }; onUse: (option: EngineOption) => void }) {
  const group = useId();
  const choices = options;
  const isCurrent = (o: EngineOption) => o.provider === current.provider && o.model === current.model;
  const firstReady = choices.find((o) => o.available && o.model);
  const [key, setKey] = useState<string>("");
  const picked = choices.find((o) => o.key === key) ?? firstReady;
  if (!choices.length) return null;
  return (
    <div className="engine-switch">
      <div className="engine-list" role="radiogroup" aria-label="Make this view with">
        {choices.map((o) => {
          const usable = o.available && !!o.model;
          const on = picked?.key === o.key;
          return (
            <label key={o.key} className={`engine-opt${on ? " on" : ""}${usable ? "" : " off"}`}>
              <input type="radio" name={group} value={o.key} checked={on} disabled={!usable} onChange={() => setKey(o.key)} />
              <div className="engine-text"><b>{o.label}{isCurrent(o) && <em className="engine-current"> · used before</em>}</b>{o.note && <small>{o.note}</small>}</div>
            </label>
          );
        })}
      </div>
      <button className="secondary" disabled={!picked || !picked.available || !picked.model} onClick={() => picked && onUse(picked)}>Use {picked?.label.replace(/^On this computer: /, "") ?? "this engine"}</button>
    </div>
  );
}
