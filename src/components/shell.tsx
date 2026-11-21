import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, BookText, ClipboardCheck, Clapperboard, FolderOpen, Command as CommandIcon, Check, PackageCheck, Palette, ChevronDown, ChevronUp, WandSparkles , MessageCircle, Loader2, Clock, Eye, AlertTriangle } from "lucide-react";
import { BrandMark } from "./BrandMark";
import { RealImage } from "./RealImage";
import { stripItems } from "../domain/queueStrip";
import { newlyDone } from "../domain/shortcuts";
import { goldenPath, type GoldenPathInput, type GoldenStep } from "../domain/goldenPath";
import { spendGate, summarize, waitingForAnchor, type QueueState } from "../domain/generationQueue";

const workspaceIcons = { Projects: FolderOpen, Story: BookText, Design: Palette, Review: ClipboardCheck, Direct: Clapperboard, Deliver: PackageCheck, Assistant: MessageCircle } as const;
/** Sidebar order. Alt+1 to Alt+5 keep their old meaning; Review is Alt+6, Assistant Alt+7. */
export const workspaceNames = ["Projects", "Story", "Design", "Review", "Direct", "Deliver", "Assistant"] as const;
/** What each screen is called on screen. The ids above stay as they are (saved links, shortcuts and tests use them). */
export const workspaceLabels: Record<string, string> = { Story: "Script", Direct: "Storyboards" };
export const labelOf = (name: string): string => workspaceLabels[name] ?? name;

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
  /** Pictures waiting for a decision; shown as a badge on Review. */
  reviewCount?: number;
  onAppearance?: () => void;
}) {
  const { steps, next, progress } = useMemo(() => goldenPath(props.golden), [props.golden]);
  // The Assistant is the easiest way in, so it says "new" until it has been opened once.
  const [assistantSeen, setAssistantSeen] = useState(() => { try { return localStorage.getItem("po.assistant.seen") === "1"; } catch { return true; } });
  useEffect(() => { if (props.workspace === "Assistant" && !assistantSeen) { try { localStorage.setItem("po.assistant.seen", "1"); } catch { /* private window */ } setAssistantSeen(true); } }, [props.workspace, assistantSeen]);
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
    setCheer(step?.id === "deliver" ? "Ready to export" : `${step?.label ?? "Step"} complete`);
    const timer = window.setTimeout(() => setCheer(""), 3600);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneIds.join("|")]);
  return (
    <div className="po-top" role="banner">
      <div className="po-brand">
        <span className="po-ring" style={{ "--p": `${progress}%` } as React.CSSProperties} title={`Production ${progress}% through its steps`}><BrandMark size={30} /><span className="visually-hidden">Production {progress}% through its steps</span></span>
        <span className="po-wordmark">Production <b>One</b></span>
      </div>
      <div className="po-project">
        <button className="po-title" onClick={props.onOpenSettings} title="Project settings">{props.title}</button>
        <span className={`po-save${props.unsaved ? " unsaved" : ""}`} role="status">{props.saveLabel}</span>
        {cheer && <span className="po-cheer" role="status"><Check size={12} aria-hidden="true" /> {cheer}</span>}
      </div>
      <nav className="po-tabs" aria-label="Workspaces">
        {workspaceNames.map((name) => (
          <button key={name} className={props.workspace === name ? "active" : ""} onClick={() => props.onWorkspace(name)} aria-current={props.workspace === name ? "page" : undefined} aria-label={name === "Review" && props.reviewCount ? `Review, ${props.reviewCount} waiting` : labelOf(name)} title={labelOf(name)}>
            {(() => { const Icon = workspaceIcons[name]; return <Icon size={18} aria-hidden="true" />; })()}
            <span>{labelOf(name)}</span>
            {name === "Direct" && <em>optional</em>}
            {name === "Assistant" && !assistantSeen && props.workspace !== "Assistant" && <em className="po-badge new">new</em>}
            {name === "Review" && !!props.reviewCount && <em className="po-badge" aria-label={`${props.reviewCount} waiting`}>{props.reviewCount}</em>}
          </button>
        ))}
      </nav>
      {next && (
        <div className="po-next">
          <small>Next step</small>
          <span className="po-next-step" aria-label={`Step ${Math.max(1, steps.findIndex((x) => x.id === next.id) + 1)} of ${steps.length}`}><span className="po-next-bar" aria-hidden="true"><i style={{ width: `${Math.round(((Math.max(1, steps.findIndex((x) => x.id === next.id) + 1) - 1) / Math.max(1, steps.length)) * 100)}%` }} /></span>Step {Math.max(1, steps.findIndex((x) => x.id === next.id) + 1)} of {steps.length}</span>
          <p>{next.detail}</p>
          <button className="primary" onClick={() => props.onNext(next)} title={next.detail} aria-label={next.action}>
            <span className="btn-label">{next.action}</span> <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
      )}
      <div className="po-actions">
        {props.onLocal && <button className={`po-local${props.localUp ? " up" : ""}`} onClick={props.onLocal} title="Local AI: Ollama, LM Studio, ComfyUI"><span />Local AI</button>}
        <button className="icon-button" onClick={props.onPalette} title="Command palette (Ctrl+K)" aria-label="Open command palette"><CommandIcon size={16} /></button>
        <button className="icon-button" onClick={props.onProviders} title="Providers and keys" aria-label="Providers and keys"><WandSparkles size={16} /></button>
        {props.onAppearance && <button className="icon-button" onClick={props.onAppearance} title="Appearance" aria-label="Appearance"><Palette size={16} /></button>}
      </div>
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
          <p>Your provider bills the account behind your key. Buttons show a typical price as an estimate; enter your own price here and they use it. The count below includes retries.</p>
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

export function QueueDock({ queue, setQueue, onOpen, onReview, nameOf, children }: { queue: QueueState; setQueue: (update: (q: QueueState) => QueueState) => void; onOpen: () => void; /** Opens Review (used by the pictures waiting for your decision). */ onReview?: () => void; /** What to call an asset (its name rather than its id). */ nameOf?: (assetId: string) => string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const s = summarize(queue);
  const busy = s.generating + s.validating;
  const waiting = s.queued + s.pending;
  const capBlocked = queue.guard && waiting > 0 && !spendGate(queue).ok;
  // Views that match a front view wait until a person approves it. Say so, or a quiet queue looks stuck.
  const anchorWaiting = queue.jobs.filter((j) => j.status === "queued" && waitingForAnchor(queue, j)).length;
  const items = stripItems(queue);
  const name = (id: string) => (nameOf ? nameOf(id) : id);
  const line = s.total === 0 ? "Queue is empty" : `${s.queued} queued · ${busy} running · ${s.needsReview} to review · ${s.completed} done${s.failed ? ` · ${s.failed} failed` : ""}${queue.paused ? " · paused" : ""}`;
  return (
    <div className={`po-dock${open ? " open" : ""}`}>
      <div className="po-dock-row">
        <button className="po-dock-bar" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span className={`po-dock-dot${busy ? " busy" : s.needsReview ? " review" : ""}`} />
          <span>{line}</span>
          {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
        {!capBlocked && anchorWaiting > 0 && busy === 0 && <span className="po-cap-note" role="status">{anchorWaiting} waiting for you to approve a front view, so they can match it. <button onClick={onOpen}>Open sheets</button></span>}
        {capBlocked && <span className="po-cap-note" role="alert">Waiting: your spending cap is reached. <button onClick={() => setQueue((q) => ({ ...q, guard: false }))}>Turn the cap off</button></span>}
        {items.shown.length > 0 && (
          <ul className="po-strip" aria-label="Queue">
            {items.shown.map((it) => (
              <li key={it.job.id} className={`po-strip-item ${it.kind}`}>
                {it.kind === "review"
                  ? <button type="button" onClick={onReview} title="Open Review" aria-label={`${name(it.job.assetId)} · ${it.job.label} is waiting for your decision. Open Review`}><span className="po-strip-thumb"><RealImage path={it.job.outputPath} label="" empty="" /></span><span className="po-strip-text"><b>{name(it.job.assetId)} · {it.job.label}</b><small><Eye size={12} aria-hidden="true" /> Needs your decision</small></span></button>
                  : (
                    <>
                      <span className="po-strip-icon" aria-hidden="true">{it.kind === "running" ? <Loader2 size={15} className="spin" /> : it.kind === "failed" ? <AlertTriangle size={15} /> : <Clock size={15} />}</span>
                      <span className="po-strip-text"><b>{name(it.job.assetId)} · {it.job.label}</b><small>{it.kind === "running" ? (it.job.status === "validating" ? "Checking" : "Running") : it.kind === "failed" ? "Failed" : it.kind === "held" ? "Waiting for a front view" : "Queued"}</small></span>
                    </>
                  )}
              </li>
            ))}
            {items.more > 0 && <li className="po-strip-more"><button type="button" onClick={() => setOpen(true)} aria-label={`${items.more} more in the queue. View the queue`}>+{items.more} more</button></li>}
          </ul>
        )}
        <CostChip queue={queue} setQueue={setQueue} />
      </div>
      {open && (
        <div className="po-dock-body">
          {queue.jobs.length === 0 && <p className="helper">Queued sheet views will appear here with their status.</p>}
          <ul>
            {queue.jobs.slice(-40).reverse().map((j) => (
              <li key={j.id}><b>{j.label}</b><span>{name(j.assetId)} · {j.sheetType} · v{j.revision}</span><em className={j.status}>{j.status}</em></li>
            ))}
          </ul>
          <button className="secondary" onClick={onOpen}>Open sheets</button>
          {children}
        </div>
      )}
    </div>
  );
}
