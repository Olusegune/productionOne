import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { EmptyState } from "./EmptyState";
import { Box, ImagePlus, Mountain, Shirt, Users, X, type LucideIcon } from "lucide-react";
import type { ExtractedAsset } from "../domain/productionStudio";
import { isSuperseded, type QueueState } from "../domain/generationQueue";
import { characterArcs, expressionPlan, type Emotion, type CharacterArc } from "../engine/emotion";
import type { ParsedStory } from "../engine/story";

export const emotionColor: Record<Emotion, string> = {
  neutral: "#77828c", joy: "#d1b47b", sadness: "#5c93b8", anger: "#c0705f", fear: "#9a86c4", surprise: "#8ec0b0", disgust: "#8fa06a", contempt: "#a08e7a", love: "#cf8fa0", determination: "#e9edf0",
};

export function EmotionChip({ emotion, intensity, ai }: { emotion: Emotion; intensity?: number; ai?: boolean }) {
  return <span className="po-emotion" title={ai ? "Read by an AI model; its evidence quote was checked against the script" : undefined} style={{ borderColor: emotionColor[emotion], color: emotionColor[emotion] }}>{ai ? "✦ " : ""}{emotion}{intensity ? ` ${intensity}` : ""}</span>;
}

type Dot = "approved" | "review" | "busy" | "failed" | "planned";
const dotFor = (asset: ExtractedAsset, queue: QueueState): Dot => {
  const mine = queue.jobs.filter((j) => j.assetId === asset.id);
  if (mine.some((j) => j.status === "failed" && !isSuperseded(queue, j))) return "failed";
  if (mine.some((j) => j.status === "generating" || j.status === "validating" || j.status === "queued")) return "busy";
  if (mine.some((j) => j.status === "needs-review")) return "review";
  return asset.status === "approved" ? "approved" : "planned";
};
const typeIcon: Record<string, LucideIcon> = { character: Users, costume: Shirt, prop: Box, set: Mountain, environment: Mountain };
const dotLabel: Record<Dot, string> = { approved: "Approved", review: "Needs your review", busy: "In the queue", failed: "A view failed", planned: "Planned" };

/** The production bible: every character, prop and set the script needs, with where it stands. */
export function BibleTree({ assets, story, queue, selected, onSelect, onAddCharacter }: { assets: ExtractedAsset[]; story?: ParsedStory; queue: QueueState; selected: number; onSelect: (index: number) => void; onAddCharacter?: (name: string, gender: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGender, setNewGender] = useState("");
  const arcs = useMemo(() => new Map<string, CharacterArc>((story ? characterArcs(story) : []).map((a) => [a.character.toUpperCase(), a])), [story]);
  const groups: Array<[string, ExtractedAsset["type"][]]> = [["Characters", ["character"]], ["Costumes", ["costume"]], ["Props", ["prop"]], ["Sets", ["set", "environment"]]];
  const approved = assets.filter((a) => a.status === "approved").length;
  return (
    <aside className="po-bible" aria-label="Production bible">
      <div className="po-bible-head"><span className="eyebrow">PRODUCTION BIBLE</span><small>{approved} of {assets.length} approved</small></div>
      {onAddCharacter && <button className="secondary add-asset-open" onClick={() => setAdding(true)} title="Start a character from an image you already have"><ImagePlus size={14} aria-hidden="true" /> Add character from image</button>}
      {adding && onAddCharacter && createPortal(
        <div className="modal-backdrop" role="presentation" onClick={() => setAdding(false)}>
          <section className="sheet add-dialog" role="dialog" aria-modal="true" aria-label="Add a character from an image" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === "Escape") setAdding(false); }}>
            <div className="panel-heading"><h3>Add a character from an image</h3><button className="icon-button" aria-label="Close" onClick={() => setAdding(false)}><X size={16} /></button></div>
            <p className="helper">Choose an image you already have (for example from Midjourney). It becomes the approved front view, and every other sheet is built from it.</p>
        <form className="add-character" onSubmit={(e) => { e.preventDefault(); if (!newName.trim()) return; onAddCharacter(newName, newGender); setNewName(""); setNewGender(""); setAdding(false); }}>
          <label><span>Have a character image? Start from it</span><input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Character name" aria-label="Name for the new character" /></label>
          <label><span>Gender (optional, helps pick a voice)</span><select value={newGender} onChange={(e) => setNewGender(e.target.value)} aria-label="Gender for the new character"><option value="">Not set</option><option value="female">Female</option><option value="male">Male</option></select></label>
          <button className="secondary" type="submit" disabled={!newName.trim()} title="Choose an image (for example from Midjourney). It becomes the approved front view; every other sheet is built from it."><ImagePlus size={14} aria-hidden="true" /> Add from image</button>
        </form>
          </section>
        </div>,
        document.body,
      )}
      {assets.length === 0 && <EmptyState icon={Users} title="No cast yet" tone="violet">Analyze a script in Story and the people, props and places it needs appear here. Or start a character from an image you already have.</EmptyState>}
      {groups.map(([label, types]) => {
        const items = assets.map((a, i) => ({ a, i })).filter(({ a }) => types.includes(a.type));
        if (!items.length) return null;
        return (
          <section key={label}>
            <h4>{(() => { const Icon = typeIcon[types[0]] ?? Box; return <Icon size={14} aria-hidden="true" />; })()}{label}<span>{items.length}</span></h4>
            <ul>
              {items.map(({ a, i }) => {
                const dot = dotFor(a, queue);
                const arc = arcs.get(a.name.toUpperCase());
                const dominant = arc ? [...arc.points].sort((x, y) => y.reading.intensity - x.reading.intensity)[0]?.reading : undefined;
                const variants = story ? new Set(story.variants.filter((v) => v.character.toUpperCase() === a.name.toUpperCase()).map((v) => v.value)).size : 0;
                return (
                  <li key={a.id}>
                    <button className={selected === i ? "on" : ""} onClick={() => onSelect(i)} aria-current={selected === i ? "true" : undefined}>
                      <span className={`po-avatar kind-${a.type}`} aria-hidden="true">{(() => { const Icon = typeIcon[a.type] ?? Box; return <Icon size={14} />; })()}<i className={`po-dot ${dot}`} title={dotLabel[dot]} /></span>
                      <span className="po-name">{a.name}</span>
                      {variants > 0 && <small title="Story variants found in the script">{variants} look{variants === 1 ? "" : "s"}</small>}
                      {dominant && dominant.emotion !== "neutral" && <EmotionChip emotion={dominant.emotion} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </aside>
  );
}

/** What the engine knows about the selected asset, with the script lines it came from. */
export function AssetInspector({ asset, story }: { asset?: ExtractedAsset; story?: ParsedStory }) {
  const arc = useMemo(() => (story && asset ? characterArcs(story).find((a) => a.character.toUpperCase() === asset.name.toUpperCase()) : undefined), [story, asset]);
  if (!asset) return <aside className="po-inspector"><span className="eyebrow">INSPECTOR</span><p className="helper">Select something in the bible to see what the script says about it.</p></aside>;
  const scenes = story?.scenes.filter((s) => asset.sceneIds.includes(s.id)) ?? [];
  const variants = story?.variants.filter((v) => v.character.toUpperCase() === asset.name.toUpperCase()) ?? [];
  const prop = story?.props.find((p) => asset.type === "prop" && p.name === asset.name);
  const plan = arc ? expressionPlan(arc) : [];
  return (
    <aside className="po-inspector" aria-label="Inspector">
      <span className="eyebrow">{asset.type.toUpperCase()} · {asset.id}</span>
      <h3>{asset.name}</h3>
      <section>
        <h4>Appears in</h4>
        <ul className="po-plain">{scenes.map((s) => <li key={s.id}>{s.number}. {s.heading}</li>)}{!scenes.length && <li>No scenes recorded.</li>}</ul>
      </section>
      {prop?.condition && <section><h4>Condition</h4><p><EmotionChip emotion="neutral" />{" "}<b>{prop.condition}</b>: the sheets show this state.</p></section>}
      {variants.length > 0 && (
        <section>
          <h4>Looks found in the script</h4>
          <ul className="po-plain">{variants.map((v, i) => <li key={i}><b>{v.value}</b> <small>{v.kind}</small><q>{v.evidence.text}</q><small>line {v.evidence.line}</small></li>)}</ul>
        </section>
      )}
      {arc && arc.points.length > 0 && (
        <section>
          <h4>Emotional arc</h4>
          <svg className="po-arc" viewBox={`0 0 ${Math.max(1, arc.points.length) * 56} 70`} role="img" aria-label={`Emotional arc across ${arc.points.length} scenes`}>
            <polyline fill="none" stroke="#3a444d" strokeWidth="2" points={arc.points.map((p, i) => `${i * 56 + 28},${62 - p.reading.intensity * 5.5}`).join(" ")} />
            {arc.points.map((p, i) => <circle key={p.sceneId} cx={i * 56 + 28} cy={62 - p.reading.intensity * 5.5} r="6" fill={emotionColor[p.reading.emotion]}><title>{`Scene ${p.sceneNumber}: ${p.reading.emotion} ${p.reading.intensity}/10`}</title></circle>)}
          </svg>
          <ul className="po-plain">
            {arc.points.map((p) => (
              <li key={p.sceneId}>
                <EmotionChip emotion={p.reading.emotion} intensity={p.reading.intensity} ai={p.reading.source === "ai"} /> <small>scene {p.sceneNumber} · {Math.round(p.reading.confidence * 100)}% sure{p.reading.nuance ? ` · ${p.reading.nuance}` : ""}</small>
                {p.evidence[0] && <q>{p.evidence[0].text}</q>}
                {(() => { const b = (story as { ai?: Record<string, { beats: Array<{ character: string; subtext?: string; tell?: string }> }> }).ai?.[p.sceneId]?.beats.find((x) => x.character.toUpperCase() === asset.name.toUpperCase()); return b && (b.subtext || b.tell) ? <small className="po-ai-note">{b.subtext ? `Subtext: ${b.subtext}` : ""}{b.subtext && b.tell ? " · " : ""}{b.tell ? `Tell: ${b.tell}` : ""}</small> : null; })()}
              </li>
            ))}
          </ul>
          <p className="helper">{arc.points.some((p) => p.reading.source === "ai") ? "Marked ✦ were read by an AI model; its quotes were checked against the script. The rest are read by rules." : "Read from the words themselves (rules, not AI). Check them against your intent."}</p>
        </section>
      )}
      {plan.length > 1 && <section><h4>Expressions the story needs</h4><p className="po-chips">{plan.map((n) => <EmotionChip key={n.emotion} emotion={n.emotion} />)}</p></section>}
    </aside>
  );
}
