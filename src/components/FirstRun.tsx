import { useState } from "react";
import { KeyRound, FileText, Route, X } from "lucide-react";

const KEY = "po.firstRunDismissed";
const read = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };
const write = () => { try { localStorage.setItem(KEY, "1"); } catch { /* private window: the card just returns next time */ } };

/** A short, dismissible start for new people: keys, script, then the Golden Path. Remembers being dismissed. */
export function FirstRun({ onKeys, onStory }: { onKeys: () => void; onStory: () => void }) {
  const [gone, setGone] = useState(read);
  if (gone) return null;
  const close = () => { write(); setGone(true); };
  return (
    <section className="first-run" aria-label="Getting started">
      <header>
        <div>
          <span className="eyebrow">Welcome</span>
          <h3>Three things to know before you start</h3>
        </div>
        <button className="icon-button" onClick={close} aria-label="Dismiss the getting started guide"><X size={16} /></button>
      </header>
      <ol>
        <li><KeyRound size={18} aria-hidden="true" /><div><b>Add a provider key</b><p>Image and voice providers charge for each request. Keys stay on this computer. Nothing is sent until you press a generate button, and each one shows what it will cost.</p><button className="secondary" onClick={onKeys}>Add keys</button></div></li>
        <li><FileText size={18} aria-hidden="true" /><div><b>Paste or import a script</b><p>Production One reads characters, props and sets from it and shows how it read them, so you can correct a miss.</p><button className="secondary" onClick={onStory}>Open Story</button></div></li>
        <li><Route size={18} aria-hidden="true" /><div><b>Follow the Golden Path</b><p>The gold button at the top always names the next step: design, generate, review, deliver.</p></div></li>
      </ol>
      <button className="primary" onClick={close}>Got it</button>
    </section>
  );
}
