import { useMemo } from "react";
import { characterArcs, sceneMood } from "../engine/emotion";
import type { ParsedStory } from "../engine/story";
import { EmotionChip } from "./bible";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { runAiPass } from "../data/aiPass";
import { useLocalAi } from "../data/localAi";
import { applyAi } from "../engine/aiBeats";
import { explainStory } from "../engine/explain";

/** What the story engine found, each finding linked back to the script line it came from. */
export function ReadingPanel({ story, onJump, desktop = false, onStory, notify, onAddProp, onUseAge }: { story?: ParsedStory; onJump: (line: number) => void; desktop?: boolean; onStory?: (story: ParsedStory) => void; notify?: (message: string) => void; onAddProp?: (name: string) => void; onUseAge?: (character: string, value: string) => void }) {
  const [propName, setPropName] = useState("");
  const local = useLocalAi(desktop);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const why = useMemo(() => (story ? explainStory(story) : null), [story]);
  const arcs = useMemo(() => (story ? characterArcs(story) : []), [story]);
  if (!story || !story.scenes.length) return <section className="panel po-reading"><span className="eyebrow">THE ENGINE'S READING</span><h3>Nothing read yet</h3><p className="helper">Paste or import a script and press Analyze. Reading is free and happens on your computer.</p></section>;
  const jump = (line: number, label: string) => <button className="po-line" onClick={() => onJump(line)} title="Show this line in the script">{label}</button>;
  return (
    <section className="panel po-reading" aria-label="What the engine found">
      <div className="panel-heading">
        <div><span className="eyebrow">THE ENGINE'S READING · FREE, LOCAL</span><h3>{story.scenes.length} scene{story.scenes.length === 1 ? "" : "s"} · {story.characters.length} character{story.characters.length === 1 ? "" : "s"} · {story.props.length} prop{story.props.length === 1 ? "" : "s"}</h3></div>
        <span className="pill">{story.format}</span>
      </div>
      {desktop && onStory && (
        <div className="ai-row">
          <button className="secondary" disabled={!!progress || !local.config.textModel} onClick={async () => {
            try {
              setProgress({ done: 0, total: 1 });
              const readings = await runAiPass(story, local.config, (done, total) => setProgress({ done, total }));
              onStory(applyAi(story, readings));
              const kept = readings.reduce((n, r) => n + r.beats.length, 0);
              const dropped = readings.reduce((n, r) => n + r.dropped, 0);
              notify?.(`Read ${readings.length} scene${readings.length === 1 ? "" : "s"} with ${local.config.textModel}: ${kept} beat${kept === 1 ? "" : "s"} kept${dropped ? `, ${dropped} dropped because their evidence was not in the script` : ""}.`);
            } catch (e) { notify?.(String(e)); } finally { setProgress(null); }
          }}><Sparkles size={14} /> {progress ? `Reading scene ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…` : "Deepen with local AI"}</button>
          <small>{local.config.textModel ? `Uses ${local.config.textModel} on this computer. Nothing is sent online.` : "Open Local AI and choose a model to use this."}</small>
        </div>
      )}
      {story.warnings.map((w) => <p key={w} className="helper warn">{w}</p>)}
      {why && <details open={why.needsReview > 0}>
        <summary>How this was read{why.needsReview > 0 ? ` · ${why.needsReview} to check` : ""}</summary>
        <ul className="po-plain">{why.findings.map((f, i) => <li key={i}><span className={`pill conf-${f.confidence}`}>{f.confidence}</span> <b>{f.subject}</b> <small>{f.reason}</small>{f.line ? <> {jump(f.line, `line ${f.line}`)}</> : null}</li>)}</ul>
      </details>}
      <details open>
        <summary>Scenes and mood</summary>
        <ul className="po-plain">
          {story.scenes.map((s) => { const mood = sceneMood(s); return (
            <li key={s.id}>{jump(s.startLine, `${s.number}. ${s.heading}`)} <small>{s.intExt} · {s.timeOfDay} · {s.dialogue.length} line{s.dialogue.length === 1 ? "" : "s"}</small> {mood.emotion !== "neutral" && <EmotionChip emotion={mood.emotion} intensity={mood.intensity} />}</li>
          ); })}
        </ul>
      </details>
      <details open>
        <summary>Characters and how they feel</summary>
        <ul className="po-plain">
          {story.characters.map((c) => { const arc = arcs.find((a) => a.character === c.name); return (
            <li key={c.name}><b>{c.name}</b> <small>{c.dialogueCount} line{c.dialogueCount === 1 ? "" : "s"} · {c.sceneIds.length} scene{c.sceneIds.length === 1 ? "" : "s"}</small>
              <span className="po-chips">{arc?.points.map((p) => <span key={p.sceneId} title={p.evidence[0]?.text}><EmotionChip emotion={p.reading.emotion} intensity={p.reading.intensity} ai={p.reading.source === "ai"} /></span>)}</span>
            </li>
          ); })}
        </ul>
      </details>
      {story.variants.length > 0 && (
        <details>
          <summary>Ages, costumes and conditions ({story.variants.length})</summary>
          <ul className="po-plain">{story.variants.map((v, i) => <li key={i}><b>{v.character}</b>: {v.value} <small>{v.kind}</small> {jump(v.evidence.line, `line ${v.evidence.line}`)}{v.kind === "age" && onUseAge && <> <button className="tertiary" onClick={() => onUseAge(v.character, v.value)} title="Saves this as the character's confirmed age; it goes into image prompts">Use as {v.character}'s age</button></>}</li>)}</ul>
        </details>
      )}
      {(story.props.length > 0 || onAddProp) && (
        <details>
          <summary>Props ({story.props.length})</summary>
          {onAddProp && <form className="add-prop" onSubmit={(e) => { e.preventDefault(); onAddProp(propName); setPropName(""); }}><label><span>Missed a prop? Add it</span><input value={propName} onChange={(e) => setPropName(e.target.value)} placeholder="e.g. rusty key" /></label><button className="secondary" type="submit" disabled={!propName.trim()}>Add as prop</button></form>}
          <ul className="po-plain">{story.props.map((p) => <li key={p.name}><b>{p.name}</b>{p.condition && <small> · {p.condition}</small>} {jump(p.evidence[0].line, `line ${p.evidence[0].line}`)}</li>)}</ul>
        </details>
      )}
    </section>
  );
}
