import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Check, Moon, Sun, X } from "lucide-react";
import { looks, type Look } from "../domain/appearance";
import { toggleTheme } from "../data/theme";
import { useState } from "react";

/** Choose how the app looks. The choice applies at once and is remembered on this computer; it changes colours and fonts only. */
export function AppearanceMenu({ look, onLook, onClose }: { look: Look; onLook: (look: Look) => void; onClose: () => void }) {
  const first = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(typeof document !== "undefined" ? document.activeElement : null);
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme === "light" ? "light" : "dark");
  useEffect(() => { first.current?.focus(); const back = opener.current; return () => { if (back instanceof HTMLElement) back.focus(); }; }, []);
  return createPortal(
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="sheet am" role="dialog" aria-modal="true" aria-label="Appearance" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
        <div className="panel-heading"><div><h3>Appearance</h3><p className="helper">Try each look on your own project. It changes colours and fonts only.</p></div><button className="icon-button" aria-label="Close appearance" onClick={onClose}><X size={16} /></button></div>
        <div className="am-grid" role="radiogroup" aria-label="Look">
          {looks.map((l, i) => (
            <button key={l.id} ref={i === 0 ? first : undefined} role="radio" aria-checked={look === l.id} className={`am-card${look === l.id ? " on" : ""}`} data-look-preview={l.id} onClick={() => onLook(l.id)}>
              <span className="am-preview" aria-hidden="true"><i className="am-bg"><b className="am-heading">Aa</b><u className="am-bar" /><u className="am-bar short" /><s className="am-accent" /></i></span>
              <span className="am-name">{l.name}{look === l.id && <Check size={15} aria-hidden="true" />}</span>
              <small>{l.tagline}</small>
              <small className="am-desc">{l.description}</small>
            </button>
          ))}
        </div>
        <div className="am-theme">
          <span>Colour scheme</span>
          <div className="seg" role="group" aria-label="Colour scheme">
            <button className={theme === "dark" ? "on" : ""} aria-pressed={theme === "dark"} onClick={() => { if (theme !== "dark") setTheme(toggleTheme()); }}><Moon size={14} aria-hidden="true" /> Dark</button>
            <button className={theme === "light" ? "on" : ""} aria-pressed={theme === "light"} onClick={() => { if (theme !== "light") setTheme(toggleTheme()); }}><Sun size={14} aria-hidden="true" /> Light</button>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}
