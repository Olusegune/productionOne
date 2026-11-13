import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, BookText, Clapperboard, FolderOpen, Command as CommandIcon, Check, PackageCheck, Palette, ChevronDown, ChevronUp, WandSparkles } from "lucide-react";
import { BrandMark } from "./BrandMark";
import { newlyDone } from "../domain/shortcuts";
import { goldenPath, type GoldenPathInput, type GoldenStep } from "../domain/goldenPath";
import { spendGate, summarize, type QueueState } from "../domain/generationQueue";

const workspaceIcons = { Projects: FolderOpen, Story: BookText, Design: Palette, Direct: Clapperboard, Deliver: PackageCheck } as const;
export const workspaceNames = ["Projects", "Story", "Design", "Direct", "Deliver"] as const;

export function TopBar(props: {
  title: string;
  saveLabel: string;
  unsaved: boolean;
  workspace: string;
  onWorkspace: (name: string) => void;
  onNext: (step: GoldenStep) => void;
  golden: GoldenPathInput;
  onOpenSettings: () => void;
  onPalette: () => void;
  onProviders: () => void;
  localUp?: boolean;
  onLocal?: () => void;
}) {
  const { steps, next, progress } = useMemo(() => goldenPath(props.golden), [props.golden]);
  // Quietly acknowledge a step when it becomes done (not on first load).
  const doneIds = steps.filter((s) => s.state === "done").map((s) => s.id);
  const seen = useRef<string[] | null>(null);
  const [cheer, setCheer] = useState("");
  useEffect(() => {
    const before = seen.current;
    seen.current = doneIds;
    if (before === null) return;
    const fresh = newlyDone(before, doneIds);
    if (!fresh.length) return;
    const step = steps.find((s) => s.id === fresh[fresh.length - 1]);
    setCheer(`${step?.label ?? "Step"} complete`);
    const timer = window.setTimeout(() => setCheer(""), 3600);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneIds.join("|")]);
  return (
    <div className="po-top" role="banner">
      <div className="po-bar">
        <div className="po-brand">
          <span className="po-ring" style={{ "--p": `${progress}%` } as React.CSSProperties} title={`Golden Path ${progress}% complete`}><BrandMark size={30} /><span className="visually-hidden">Golden Path {progress}% complete</span></span>
          <button className="po-title" onClick={props.onOpenSettings} title="Project settings">{props.title}</button>
          {cheer && <span className="po-cheer" role="status"><Check size={12} aria-hidden="true" /> {cheer}</span>}
          <span className={`po-save${props.unsaved ? " unsaved" : ""}`} role="status">{props.saveLabel}</span>
        </div>
        <nav className="po-tabs" aria-label="Workspaces">
          {workspaceNames.map((name) => (
            <button key={name} className={props.workspace === name ? "active" : ""} onClick={() => props.onWorkspace(name)} aria-current={props.workspace === name ? "page" : undefined}>
              {(() => { const Icon = workspaceIcons[name]; return <Icon size={15} aria-hidden="true" />; })()}
              <span>{name}</span>
              {name === "Direct" && <em>optional</em>}
            </button>
          ))}
        </nav>
        <div className="po-actions">
          {next && (
            <button className="primary" onClick={() => props.onNext(next)} title={next.detail}>
              <span className="btn-label">{next.action}</span> <ArrowRight size={14} aria-hidden="true" />
            </button>
          )}
          {props.onLocal && <button className={`po-local${props.localUp ? " up" : ""}`} onClick={props.onLocal} title="Local AI: Ollama, LM Studio, ComfyUI"><span />Local AI</button>}
          <button className="icon-button" onClick={props.onPalette} title="Command palette (Ctrl+K)" aria-label="Open command palette"><CommandIcon size={16} /></button>
          <button className="icon-button" onClick={props.onProviders} title="Providers and keys" aria-label="Providers and keys"><WandSparkles size={16} /></button>
        </div>
      </div>
      <ol className="po-steps" aria-label="Golden Path">
        {steps.map((step) => (
          <li key={step.id} className={step.state}>
            <button onClick={() => props.onWorkspace(step.workspace)} title={`${step.label}: ${step.detail}`}>
              <span className="po-step-dot">{step.state === "done" ? <Check size={11} /> : null}</span>
              <span>{step.label}</span>
            </button>
          </li>
        ))}
        {next && <li className="po-hint" aria-live="polite">{next.detail}</li>}
      </ol>
    </div>
  );
}

export interface PaletteCommand { id: string; label: string; hint?: string; run: () => void }

export function CommandPalette({ commands, onClose }: { commands: PaletteCommand[]; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return commands.filter((c) => !q || c.label.toLowerCase().includes(q) || (c.hint ?? "").toLowerCase().includes(q));
  }, [commands, query]);
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => setIndex(0), [query]);
  const run = (command?: PaletteCommand) => { if (!command) return; onClose(); command.run(); };
  return (
    <div className="modal-backdrop po-palette-backdrop" role="presentation" onClick={onClose}>
      <section className="po-palette" role="dialog" aria-modal="true" aria-label="Command palette" onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "ArrowDown") { e.preventDefault(); setIndex((i) => Math.min(shown.length - 1, i + 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)); }
          if (e.key === "Enter") run(shown[index]);
        }}>
        <input ref={input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type a command or a place to go…" aria-label="Command" />
        <ul role="listbox">
          {shown.length === 0 && <li className="empty">Nothing matches “{query}”.</li>}
          {shown.map((c, i) => (
            <li key={c.id} role="option" aria-selected={i === index} className={i === index ? "on" : ""} onMouseEnter={() => setIndex(i)} onClick={() => run(c)}>
              <span>{c.label}</span>{c.hint && <small>{c.hint}</small>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Cost is passive: a request counter always, and an optional spending cap the person can switch on when they want one. */
function CostChip({ queue, setQueue }: { queue: QueueState; setQueue: (update: (q: QueueState) => QueueState) => void }) {
  const [open, setOpen] = useState(false);
  const s = summarize(queue);
  const label = queue.guard && queue.totalCeilingUsd !== null && queue.perImageUsd !== null ? `$${s.committedUsd.toFixed(2)} of $${queue.totalCeilingUsd.toFixed(2)}` : `${s.requests} request${s.requests === 1 ? "" : "s"}`;
  const num = (v: string) => { const n = Number(v); return v.trim() === "" || !(n >= 0) ? null : n; };
  return (
    <span className="po-cost">
      <button className="po-cost-chip" onClick={() => setOpen((o) => !o)} aria-expanded={open} title="Cost and spending cap">{label}{queue.guard ? " · cap on" : ""}</button>
      {open && (
        <div className="po-cost-pop" role="dialog" aria-label="Cost and spending cap">
          <p>Your provider bills the account behind your key. This app does not state prices, so it counts requests, including retries.</p>
          <label className="po-switch"><input type="checkbox" checked={queue.guard} onChange={(e) => setQueue((q) => ({ ...q, guard: e.target.checked }))} /> Stop at a spending cap</label>
          <div className="po-cost-fields">
            <label>Price per request (USD)<input inputMode="decimal" disabled={!queue.guard} value={queue.perImageUsd ?? ""} onChange={(e) => setQueue((q) => ({ ...q, perImageUsd: num(e.target.value) }))} aria-label="Price per request in dollars" /></label>
            <label>Cap (USD)<input inputMode="decimal" disabled={!queue.guard} value={queue.totalCeilingUsd ?? ""} onChange={(e) => setQueue((q) => ({ ...q, totalCeilingUsd: num(e.target.value) }))} aria-label="Spending cap in dollars" /></label>
          </div>
          {queue.guard && (queue.perImageUsd === null || queue.totalCeilingUsd === null) && <p className="helper warn">Enter both figures and generation continues up to the cap. Until then nothing new starts.</p>}
        </div>
      )}
    </span>
  );
}

export function QueueDock({ queue, setQueue, onOpen, children }: { queue: QueueState; setQueue: (update: (q: QueueState) => QueueState) => void; onOpen: () => void; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const s = summarize(queue);
  const busy = s.generating + s.validating;
  const waiting = s.queued + s.pending;
  const capBlocked = queue.guard && waiting > 0 && !spendGate(queue).ok;
  const line = s.total === 0 ? "Queue is empty" : `${s.queued} queued · ${busy} running · ${s.needsReview} to review · ${s.completed} done${s.failed ? ` · ${s.failed} failed` : ""}${queue.paused ? " · paused" : ""}`;
  return (
    <div className={`po-dock${open ? " open" : ""}`}>
      <div className="po-dock-row">
        <button className="po-dock-bar" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span className={`po-dock-dot${busy ? " busy" : s.needsReview ? " review" : ""}`} />
          <span>{line}</span>
          {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
        {capBlocked && <span className="po-cap-note" role="alert">Waiting: your spending cap is reached. <button onClick={() => setQueue((q) => ({ ...q, guard: false }))}>Turn the cap off</button></span>}
        <CostChip queue={queue} setQueue={setQueue} />
      </div>
      {open && (
        <div className="po-dock-body">
          {queue.jobs.length === 0 && <p className="helper">Queued sheet views will appear here with their status.</p>}
          <ul>
            {queue.jobs.slice(-40).reverse().map((j) => (
              <li key={j.id}><b>{j.label}</b><span>{j.assetId} · {j.sheetType} · v{j.revision}</span><em className={j.status}>{j.status}</em></li>
            ))}
          </ul>
          <button className="secondary" onClick={onOpen}>Open sheets</button>
          {children}
        </div>
      )}
    </div>
  );
}
