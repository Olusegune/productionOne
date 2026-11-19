import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AlertTriangle, Check, FileText, ImagePlus, Paperclip, Pause, Play, Send, Sparkles, Square, X } from "lucide-react";
import { advance, initialState, report, summarize, withBudget, type AutopilotOptions, type AutopilotState, type Depth } from "../domain/autopilot";
import { planCoverage } from "../domain/direct";
import { cancelAllWaiting, committedUsd, type ImageJob, type QueueState } from "../domain/generationQueue";
import { modelTakesReferences } from "../domain/imageCatalog";
import type { AnalysisResult, ShotRecord } from "../domain/productionStudio";
import { primaryViewKeys } from "../domain/sheetSpecs";
import type { StyleBible } from "../domain/visualDevelopment";
import type { NewAssetKind } from "../domain/readingActions";
import type { ScriptKind } from "../engine/importers";
import { useModelChoice } from "../data/modelChoice";
import "../assistant.css";

interface Attachment { path: string; name: string; kind: "script" | "image" | "unsupported"; text?: string | null; error?: string | null }
interface Msg { id: number; role: "user" | "assistant"; text: string; files?: string[]; choose?: { paths: string[] } | null; action?: "providers" | null }

export const WRITE_SYSTEM = [
  "You are a screenwriter's assistant inside a film pre-production app.",
  "Write a short screenplay in Fountain format from the person's brief: a Title: line, scene headings like INT. PLACE - DAY or EXT. PLACE - NIGHT, action lines, character names in capitals on their own line followed by their dialogue.",
  "Keep it to the number of scenes asked for, use at most four named characters, and be concrete about what people wear and look like, the key props and the places, because pictures will be made from your words.",
  "Output only the screenplay: no commentary, no markdown fences.",
].join(" ");

const looksLikeScript = (text: string) => /^\s*(INT|EXT|INT\.?\/EXT|I\/E)[.\s]/im.test(text);
const kinds: Array<{ kind: NewAssetKind; label: string }> = [{ kind: "character", label: "Characters" }, { kind: "prop", label: "Props" }, { kind: "set", label: "Places" }, { kind: "costume", label: "Costumes" }];

const readStored = (key: string, fallback: string) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
const writeStored = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* storage may be unavailable */ } };

/** What the assistant says it can do, without needing any model. */
export const HELP = [
  "I can take a script or an idea and make the production for you, inside a budget you set.",
  "• Attach a script: a Word document, a PDF, or a text, Fountain or Final Draft file. I read it and find the characters, places and props.",
  "• Describe a short film: I can write the script for you (this needs a Google Gemini or OpenRouter key).",
  "• Attach pictures: I can turn them into characters, props or places with your picture as the approved reference.",
  "Then I show you a plan with the number of pictures and the cost. Nothing is made until you press Start, and I stop at the budget you set.",
].join("\n");

// The chat and the run outlive switching screens: the screen stays mounted and these hold what it had.
const kept: { messages: Msg[]; state: AutopilotState } = { messages: [], state: initialState() };
/** For tests: forget the conversation and the run. */
export const forgetAssistant = () => { kept.messages = []; kept.state = initialState(); };

/** The assistant: chat on the left, the plan and the run on the right. A plan is only ever started by the person pressing Start. */
export function AssistantView(props: {
  analysis: AnalysisResult; shots: ShotRecord[]; setShots: (update: (s: ShotRecord[]) => ShotRecord[]) => void;
  queue: QueueState; setQueue: (update: (q: QueueState) => QueueState) => void; style: StyleBible; assetRefs: Record<string, string[]>; format: string; script: string;
  desktop: boolean; providersVersion: number; notify: (message: string) => void; openProviders: () => void; openReview: () => void; openDesign: () => void; openDeliver: () => void;
  useScript: (name: string, kind: ScriptKind, raw: string) => { ok: true; scenes: number; assets: number } | { ok: false; error: string };
  addImages: (kind: NewAssetKind, paths: string[]) => Promise<number>;
  onApproved: (job: ImageJob, primary: boolean) => void;
}) {
  const { analysis, shots, setShots, queue, setQueue, style, assetRefs, format, desktop, notify } = props;
  const choice = useModelChoice(desktop, props.providersVersion);
  const [messages, setMessages] = useState<Msg[]>(kept.messages);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [state, setStateRaw] = useState<AutopilotState>(kept.state);
  const [depth, setDepth] = useState<Depth>("standard");
  const [includeFrames, setIncludeFrames] = useState(false);
  const [stopAfterConcepts, setStop] = useState(true);
  const [price, setPrice] = useState(() => readStored("po.asst.price", ""));
  const [budget, setBudget] = useState(() => readStored("po.asst.budget", ""));
  const [writer, setWriter] = useState(() => readStored("po.asst.writer", "google"));
  const [writerModel, setWriterModel] = useState(() => readStored("po.asst.writerModel", "gemini-2.5-flash"));
  const prevGuard = useRef<Pick<QueueState, "guard" | "perImageUsd" | "totalCeilingUsd"> | null>(null);
  const nextId = useRef(messages.length + 1);
  const endRef = useRef<HTMLDivElement>(null);

  const setState = (s: AutopilotState) => { kept.state = s; setStateRaw(s); };
  const say = (role: Msg["role"], text: string, extra: Partial<Msg> = {}) => setMessages((list) => { const next = [...list, { id: nextId.current++, role, text, ...extra }]; kept.messages = next; return next; });
  useEffect(() => { if (!messages.length) say("assistant", "Hello. Give me a script or an idea and I will make the production for you, inside a budget you set. Attach a Word, PDF or text script, describe a short film, or attach pictures.\n\nType \"help\" to see everything I can do."); }, []);
  useEffect(() => { endRef.current?.scrollIntoView?.({ block: "end" }); }, [messages, busy]);
  useEffect(() => { writeStored("po.asst.price", price); writeStored("po.asst.budget", budget); writeStored("po.asst.writer", writer); writeStored("po.asst.writerModel", writerModel); }, [price, budget, writer, writerModel]);

  const perImageUsd = price.trim() === "" || !(Number(price) >= 0) ? null : Number(price);
  const budgetUsd = budget.trim() === "" || !(Number(budget) > 0) ? null : Number(budget);
  const options: AutopilotOptions = useMemo(() => ({ depth, includeFrames, stopAfterConcepts, perImageUsd, budgetUsd, provider: choice.provider, model: choice.modelId, takesReferences: modelTakesReferences(choice.provider, choice.modelId), aspect: format }), [depth, includeFrames, stopAfterConcepts, perImageUsd, budgetUsd, choice.provider, choice.modelId, format]);
  const plan = useMemo(() => summarize(analysis, shots, style, queue, assetRefs, options), [analysis, shots, style, queue, assetRefs, options]);
  const running = state.phase !== "idle" && state.phase !== "done" && state.phase !== "stopped";
  const hasWriter = !!(choice.configured?.google || choice.configured?.openrouter);

  const restoreGuard = () => { const g = prevGuard.current; if (g) setQueue((q) => ({ ...q, ...g })); prevGuard.current = null; };

  // The run: every time the queue changes, take the next step if the last one has settled.
  useEffect(() => {
    if (!running) return;
    const step = advance(state, analysis, shots, style, queue, assetRefs, options);
    const changedState = JSON.stringify(step.state) !== JSON.stringify(state);
    if (step.queue !== queue) setQueue(() => step.queue);
    if (changedState) setState(step.state);
    step.approvedNow.forEach((job) => props.onApproved(job, primaryViewKeys.includes(job.viewKey)));
    if (step.message && changedState) say("assistant", step.message);
    if (changedState && (step.state.phase === "done" || step.state.phase === "stopped")) restoreGuard();
  }, [queue, state, analysis, shots]);

  const start = () => {
    if (plan.needsAttention || !plan.images) return;
    prevGuard.current = { guard: queue.guard, perImageUsd: queue.perImageUsd, totalCeilingUsd: queue.totalCeilingUsd };
    setQueue((q) => withBudget({ ...q, paused: false }, { perImageUsd, budgetUsd }));
    if (includeFrames && !shots.length) setShots(() => planCoverage(analysis));
    setState({ ...initialState(), phase: "concepts", note: "Starting…" });
    say("assistant", `Starting. ${plan.images} picture${plan.images === 1 ? "" : "s"} planned, about $${(plan.costUsd ?? 0).toFixed(2)}, and I will stop at $${(budgetUsd ?? 0).toFixed(2)}.${stopAfterConcepts ? " I will stop after the first concepts so you can approve or replace them." : ""}`);
  };
  const stop = () => { setQueue((q) => cancelAllWaiting(q)); setState({ ...state, phase: "stopped", note: "Stopped. Pictures already being made will finish; nothing new starts." }); restoreGuard(); say("assistant", "Stopped. Pictures already being made will finish; nothing new starts."); };

  const attach = async () => {
    if (!desktop) { notify("Attaching files needs the desktop app. You can paste a script into the message box."); return; }
    try { const files = await invoke<Attachment[]>("pick_attachments"); if (files.length) setPending((p) => [...p, ...files].slice(0, 12)); } catch (e) { notify(String(e)); }
  };

  const writeScript = async (brief: string): Promise<string | null> => {
    try {
      return await invoke<string>("assistant_complete", { provider: writer, model: writerModel, system: WRITE_SYSTEM, messages: [{ role: "user", text: `Brief: ${brief}\n\nScenes: 4 to 6.` }] });
    } catch (e) { say("assistant", `I could not write the script: ${String(e)}`); return null; }
  };

  const send = async () => {
    const text = input.trim();
    if ((!text && !pending.length) || busy) return;
    const files = pending; setInput(""); setPending([]); setBusy(true);
    say("user", text || `Attached ${files.map((f) => f.name).join(", ")}`, { files: text ? files.map((f) => f.name) : [] });
    try {
      if (/^\s*(help|what can you do\??)\s*$/i.test(text) && !files.length) { say("assistant", HELP); return; }
      const scripts = files.filter((f) => f.kind === "script" && f.text);
      const pictures = files.filter((f) => f.kind === "image");
      for (const f of files.filter((x) => x.kind === "unsupported")) say("assistant", `I could not use ${f.name}: ${f.error ?? "unsupported file"}`);
      let used = false;
      for (const f of scripts) {
        const kind: ScriptKind = /\.fdx$/i.test(f.name) ? "fdx" : "text";
        const result = props.useScript(f.name, kind, f.text ?? "");
        if (result.ok) { used = true; say("assistant", `I read ${f.name}: ${result.scenes} scene${result.scenes === 1 ? "" : "s"} and ${result.assets} characters, props and places. The plan is on the right: set a price and a budget, then press Start.`); } else say("assistant", `I could not read ${f.name}: ${result.error}`);
      }
      if (pictures.length) say("assistant", `You attached ${pictures.length} picture${pictures.length === 1 ? "" : "s"}. What are they? I will make one item for each, with your picture as the approved reference.`, { choose: { paths: pictures.map((p) => p.path) } });
      if (text && !used) {
        if (looksLikeScript(text)) {
          const result = props.useScript("your message", "text", text);
          if (result.ok) say("assistant", `I read your script: ${result.scenes} scene${result.scenes === 1 ? "" : "s"} and ${result.assets} characters, props and places. The plan is on the right.`); else say("assistant", result.error);
        } else if (hasWriter) {
          say("assistant", "Writing a short script from your idea…");
          const written = await writeScript(text);
          if (written) {
            const result = props.useScript("the script I wrote", "text", written);
            if (result.ok) say("assistant", `Here is the script I wrote. It is in the Story screen if you want to edit it. I found ${result.scenes} scene${result.scenes === 1 ? "" : "s"} and ${result.assets} characters, props and places. The plan is on the right.\n\n${written.slice(0, 1800)}${written.length > 1800 ? "\n…" : ""}`);
            else say("assistant", `I wrote a script but could not read it back: ${result.error}`);
          }
        } else if (!pictures.length) {
          say("assistant", "To turn a short idea into a script I need a language model key (Google Gemini or OpenRouter). You can add one, or attach or paste a script instead.", { action: "providers" });
        }
      }
    } finally { setBusy(false); }
  };

  const chooseKind = async (msgId: number, kind: NewAssetKind, paths: string[]) => {
    setMessages((list) => { const next = list.map((m) => (m.id === msgId ? { ...m, choose: null } : m)); kept.messages = next; return next; });
    const n = await props.addImages(kind, paths);
    say("assistant", n ? `Added ${n} item${n === 1 ? "" : "s"}, each with your picture as the approved reference. They are in the plan now.` : "I could not add those pictures.");
  };

  const jobs = queue.jobs;
  const made = jobs.filter((j) => !!j.outputPath).length;
  const failed = jobs.filter((j) => j.status === "failed" && j.source !== "supplied").length;
  const liveCount = jobs.filter((j) => ["queued", "pending", "generating", "validating"].includes(j.status)).length;
  const finished = state.phase === "done" || state.phase === "stopped";
  const rep = finished ? report(queue, analysis, state, perImageUsd) : null;
  const items = analysis.assets.length;

  return (
    <section className="asst" aria-label="Assistant">
      <div className="asst-chat">
        <header className="asst-head"><h2>Assistant</h2><p>Give me a script or an idea. I plan it, show you the cost, and make it when you press Start.</p></header>
        <div className="asst-log" role="log" aria-live="polite" aria-label="Conversation">
          {messages.map((m) => (
            <div key={m.id} className={`asst-msg ${m.role}`}>
              <div className="asst-bubble">
                {m.files?.length ? <div className="asst-files">{m.files.map((f) => <span key={f}><FileText size={12} aria-hidden="true" /> {f}</span>)}</div> : null}
                <p>{m.text}</p>
                {m.choose && <div className="asst-choices" role="group" aria-label="What are these pictures?">{kinds.map((k) => <button key={k.kind} className="secondary" onClick={() => void chooseKind(m.id, k.kind, m.choose!.paths)}>{k.label}</button>)}</div>}
                {m.action === "providers" && <div className="asst-choices"><button className="secondary" onClick={props.openProviders}>Add a key</button></div>}
              </div>
            </div>
          ))}
          {busy && <div className="asst-msg assistant"><div className="asst-bubble"><p className="asst-typing">Working…</p></div></div>}
          <div ref={endRef} />
        </div>
        {messages.length <= 1 && (
          <div className="asst-chips" role="group" aria-label="Ideas">
            <button className="secondary" onClick={() => void attach()}><Paperclip size={13} aria-hidden="true" /> Attach a script (Word, PDF, text)</button>
            <button className="secondary" onClick={() => setInput("A short film about a harbour pilot who finds a lantern that shows ships that have not yet been lost.")}><Sparkles size={13} aria-hidden="true" /> Describe a short film</button>
            <button className="secondary" onClick={() => void attach()}><ImagePlus size={13} aria-hidden="true" /> Add my pictures</button>
            <button className="secondary" onClick={() => setInput("help")}>What can you do?</button>
          </div>
        )}
        {pending.length > 0 && <div className="asst-pending" aria-label="Attached files">{pending.map((f, i) => <span key={f.path} className={`asst-pill ${f.kind}`}>{f.kind === "image" ? <ImagePlus size={12} aria-hidden="true" /> : <FileText size={12} aria-hidden="true" />} {f.name}<button aria-label={`Remove ${f.name}`} onClick={() => setPending((p) => p.filter((_, j) => j !== i))}><X size={11} /></button></span>)}</div>}
        <form className="asst-compose" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <button type="button" className="icon-button" aria-label="Attach files" title="Attach a script (Word, PDF, text, Fountain, Final Draft) or pictures" onClick={() => void attach()}><Paperclip size={16} /></button>
          <textarea aria-label="Message" rows={2} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} placeholder="Describe your film, paste a script, or attach files…" />
          <button type="submit" className="primary" disabled={busy || (!input.trim() && !pending.length)}><Send size={15} aria-hidden="true" /> Send</button>
        </form>
        <details className="asst-settings">
          <summary>Writing model (used only to write a script from an idea)</summary>
          <label><span>Provider</span><select value={writer} onChange={(e) => setWriter(e.target.value)} aria-label="Writing provider"><option value="google">Google Gemini</option><option value="openrouter">OpenRouter</option></select></label>
          <label><span>Model id</span><input value={writerModel} onChange={(e) => setWriterModel(e.target.value)} aria-label="Writing model id" /></label>
          <small>{hasWriter ? "A key is saved for Google Gemini or OpenRouter." : "No Google Gemini or OpenRouter key is saved yet."} Not yet checked with a real model: if it fails the message says why.</small>
        </details>
      </div>

      <aside className="asst-plan panel" aria-label="Plan">
        <h3>Plan</h3>
        {!items && <p className="helper">Nothing to plan yet. Attach a script or pictures, or describe your film, and the plan appears here.</p>}
        {items > 0 && !running && !finished && (
          <>
            <p className="asst-sum"><b>{items}</b> item{items === 1 ? "" : "s"} · <b>{plan.images}</b> picture{plan.images === 1 ? "" : "s"} · {plan.costUsd === null ? "cost unknown" : `about $${plan.costUsd.toFixed(2)}`}</p>
            <div className="asst-opts">
              <div className="seg" role="group" aria-label="How much to make">
                <button className={depth === "quick" ? "on" : ""} aria-pressed={depth === "quick"} onClick={() => setDepth("quick")}>Quick: one sheet each</button>
                <button className={depth === "standard" ? "on" : ""} aria-pressed={depth === "standard"} onClick={() => setDepth("standard")}>Standard: full sheets</button>
              </div>
              <label className="asst-check"><input type="checkbox" checked={includeFrames} onChange={(e) => setIncludeFrames(e.target.checked)} /> Also make storyboard frames ({shots.length || "planned from the script"}) in {format}</label>
              <label className="asst-check"><input type="checkbox" checked={stopAfterConcepts} onChange={(e) => setStop(e.target.checked)} /> Stop after the first concepts so I can approve each one <small>(recommended)</small></label>
              <div className="asst-money">
                <label><span>One picture costs me (USD)</span><input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="for example 0.05" aria-label="Price per picture in dollars" /></label>
                <label><span>Budget I allow (USD)</span><input inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="for example 5" aria-label="Budget in dollars" /></label>
              </div>
              <small className="asst-model">Pictures are made with {choice.modelId || "your chosen model"} ({choice.provider}).</small>
            </div>
            <ol className="asst-steps">{plan.steps.map((s) => <li key={s}>{s}</li>)}</ol>
            {plan.needsAttention && <p className="asst-warn" role="alert"><AlertTriangle size={14} aria-hidden="true" /> {plan.reason}</p>}
            <button className="primary asst-start" disabled={plan.needsAttention || !plan.images} onClick={start}><Play size={15} aria-hidden="true" /> Start{plan.costUsd !== null ? ` (about $${plan.costUsd.toFixed(2)})` : ""}</button>
            <p className="helper">Nothing is made until you press Start. The run stops at your budget.</p>
          </>
        )}
        {running && (
          <>
            <p className="asst-status" role="status">{state.note}</p>
            <p className="asst-sum"><b>{made}</b> made · <b>{liveCount}</b> in progress · <b>{failed}</b> failed · about ${queue.perImageUsd === null ? "?" : committedUsd(queue).toFixed(2)} of ${(queue.totalCeilingUsd ?? 0).toFixed(2)}</p>
            <div className="asst-run">
              {state.phase === "checkpoint" && <><button className="secondary" onClick={props.openReview}>Open Review</button><button className="primary" onClick={() => setState({ ...state, continued: true })}><Check size={14} aria-hidden="true" /> Continue</button></>}
              <button className="secondary" onClick={() => setQueue((q) => ({ ...q, paused: !q.paused }))}>{queue.paused ? <><Play size={14} aria-hidden="true" /> Resume</> : <><Pause size={14} aria-hidden="true" /> Pause</>}</button>
              <button className="secondary" onClick={stop}><Square size={14} aria-hidden="true" /> Stop</button>
            </div>
          </>
        )}
        {finished && rep && (
          <div className="asst-report" aria-label="Report">
            <h4>{state.phase === "done" ? "Finished" : "Stopped"}</h4>
            <ul>
              <li>{rep.made} pictures made, {rep.approved} approved{rep.autoApproved ? ` (${rep.autoApproved} approved automatically by the quality checks)` : ""}, {rep.needsReview} waiting for your decision.</li>
              <li>{rep.failed.length ? `${rep.failed.length} failed:` : "Nothing failed."}</li>
              {rep.failed.slice(0, 8).map((f) => <li key={`${f.asset}-${f.label}`} className="asst-fail">{f.asset}, {f.label}: {f.error.slice(0, 140)}</li>)}
              {rep.skippedForBudget > 0 && <li>{rep.skippedForBudget} not started (waiting, or stopped by the budget).</li>}
              <li>{rep.spentUsd === null ? "Cost not worked out (no price given)." : `About $${rep.spentUsd.toFixed(2)} spent on requests sent.`} This is your own estimate from the price you entered, not a bill.</li>
            </ul>
            <div className="asst-run"><button className="secondary" onClick={props.openReview}>Review</button><button className="secondary" onClick={props.openDesign}>Design</button><button className="primary" onClick={props.openDeliver}>Deliver</button><button className="tertiary" onClick={() => setState(initialState())}>New run</button></div>
          </div>
        )}
      </aside>
    </section>
  );
}
