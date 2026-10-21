import { useMemo } from "react";
import { characterArcs, sceneMood } from "../engine/emotion";
import type { ParsedStory } from "../engine/story";
import { EmotionChip } from "./bible";

/** What the story engine found, each finding linked back to the script line it came from. */
export function ReadingPanel({ story, onJump }: { story?: ParsedStory; onJump: (line: number) => void }) {
  const arcs = useMemo(() => (story ? characterArcs(story) : []), [story]);
  if (!story || !story.scenes.length) return <section className="panel po-reading"><span className="eyebrow">THE ENGINE'S READING</span><h3>Nothing read yet</h3><p className="helper">Paste or import a script and press Analyze. Reading is free and happens on your computer.</p></section>;
  const jump = (line: number, label: string) => <button className="po-line" onClick={() => onJump(line)} title="Show this line in the script">{label}</button>;
  return (
    <section className="panel po-reading" aria-label="What the engine found">
      <div className="panel-heading">
        <div><span className="eyebrow">THE ENGINE'S READING · FREE, LOCAL</span><h3>{story.scenes.length} scene{story.scenes.length === 1 ? "" : "s"} · {story.characters.length} character{story.characters.length === 1 ? "" : "s"} · {story.props.length} prop{story.props.length === 1 ? "" : "s"}</h3></div>
        <span className="pill">{story.format}</span>
      </div>
      {story.warnings.map((w) => <p key={w} className="helper warn">{w}</p>)}
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
              <span className="po-chips">{arc?.points.map((p) => <span key={p.sceneId} title={p.evidence[0]?.text}><EmotionChip emotion={p.reading.emotion} intensity={p.reading.intensity} /></span>)}</span>
            </li>
          ); })}
        </ul>
      </details>
      {story.variants.length > 0 && (
        <details>
          <summary>Ages, costumes and conditions ({story.variants.length})</summary>
          <ul className="po-plain">{story.variants.map((v, i) => <li key={i}><b>{v.character}</b>: {v.value} <small>{v.kind}</small> {jump(v.evidence.line, `line ${v.evidence.line}`)}</li>)}</ul>
        </details>
      )}
      {story.props.length > 0 && (
        <details>
          <summary>Props ({story.props.length})</summary>
          <ul className="po-plain">{story.props.map((p) => <li key={p.name}><b>{p.name}</b>{p.condition && <small> · {p.condition}</small>} {jump(p.evidence[0].line, `line ${p.evidence[0].line}`)}</li>)}</ul>
        </details>
      )}
    </section>
  );
}
