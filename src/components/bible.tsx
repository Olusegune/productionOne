import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { EmptyState } from "./EmptyState";
import { ImagePlus, Users, X } from "lucide-react";
import { assetIconFor } from "../domain/categoryIcons";
import type { ExtractedAsset } from "../domain/productionStudio";
import { newAssetKinds, type NewAssetKind } from "../domain/readingActions";
import { isSuperseded, type QueueState } from "../domain/generationQueue";
import { characterArcs, expressionPlan, type Emotion, type CharacterArc } from "../engine/emotion";
import type { ParsedStory } from "../engine/story";

/** Chip colours for the dark theme, lifted where needed so the text reads at 4.5:1 on the chip's own tint (a test checks every surface). */
export const emotionColor: Record<Emotion, string> = {
  neutral: "#9ca4ac", joy: "#d1b47b", sadness: "#7da9c6", anger: "#d09487", fear: "#ac9bce", surprise: "#8ec0b0", disgust: "#97a775", contempt: "#ae9f8e", love: "#cf8fa0", determination: "#e9edf0",
};

/** The same colours, darkened until the chip text reads at 4.5:1 or better on every light surface (the chip has a 16 percent tint of its own colour behind it). */
export const emotionColorLight: Record<Emotion, string> = {
  neutral: "#50585e", joy: "#63563a", sadness: "#3a5c73", anger: "#7d493e", fear: "#5c5076", surprise: "#435b54", disgust: "#525c3d", contempt: "#605549", love: "#724f58", determination: "#57595a",
};

export function EmotionChip({ emotion, intensity, ai }: { emotion: Emotion; intensity?: number; ai?: boolean }) {
  return <span className="po-emotion" title={ai ? "Read by an AI model; its evidence quote was checked against the script" : undefined} style={{ ["--emo" as string]: emotionColor[emotion], ["--emo-l" as string]: emotionColorLight[emotion] }}>{ai ? "✦ " : ""}{emotion}{intensity ? ` ${intensity}` : ""}</span>;
}

type Dot = "approved" | "review" | "busy" | "failed" | "planned";
const dotFor = (asset: ExtractedAsset, queue: QueueState): Dot => {
  const mine = queue.jobs.filter((j) => j.assetId === asset.id);
  if (mine.some((j) => j.status === "failed" && !isSuperseded(queue, j))) return "failed";
  if (mine.some((j) => j.status === "generating" || j.status === "validating" || j.status === "queued")) return "busy";
  if (mine.some((j) => j.status === "needs-review")) return "review";
  return asset.status === "approved" ? "approved" : "planned";
};
const dotLabel: Record<Dot, string> = { approved: "Approved", review: "Needs your review", busy: "In the queue", failed: "A view failed", planned: "Planned" };

/** The production bible: every character, prop and set the script needs, with where it stands. */
export function BibleTree({ assets, story, queue, selected, onSelect, onAddAsset }: { assets: ExtractedAsset[]; story?: ParsedStory; queue: QueueState; selected: number; onSelect: (index: number) => void; /** Adds a character, costume, prop or set; with an image (the person chooses a file) or without one. */ onAddAsset?: (kind: NewAssetKind, name: string, gender: string, withImage: boolean) => void }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGender, setNewGender] = useState("");
  const [newKind, setNewKind] = useState<NewAssetKind>("character");
  const arcs = useMemo(() => new Map<string, CharacterArc>((story ? characterArcs(story) : []).map((a) => [a.character.toUpperCase(), a])), [story]);
  const groups: Array<[string, ExtractedAsset["type"][]]> = [["Characters", ["character"]], ["Costumes", ["costume"]], ["Props", ["prop"]], ["Sets", ["set", "environment"]]];
  const approved = assets.filter((a) => a.status === "approved").length;
  return (
    <aside className="po-bible" aria-label="Production bible">
      <div className="po-bible-head"><span className="eyebrow">PRODUCTION BIBLE</span><small>{approved} of {assets.length} approved</small></div>
      {onAddAsset && <button className="secondary add-asset-open" onClick={() => setAdding(true)} title="Add a character, costume, prop or set, with or without an image you already have"><ImagePlus size={14} aria-hidden="true" /> Add to the bible</button>}
      {adding && onAddAsset && createPortal(
        <div className="modal-backdrop" role="presentation" onClick={() => setAdding(false)}>
          <section className="sheet add-dialog" role="dialog" aria-modal="true" aria-label="Add to the production bible" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === "Escape") setAdding(false); }}>
            <div className="panel-heading"><h3>Add to the production bible</h3><button className="icon-button" aria-label="Close" onClick={() => setAdding(false)}><X size={16} /></button></div>
            <p className="helper">Add a character, costume, prop or set the script did not list, or one you already have an image of (for example from Midjourney). With an image, it becomes the approved reference and every other sheet is built from it. Without one, its sheets are planned and you generate the first picture yourself.</p>
            <form className="add-character" onSubmit={(e) => e.preventDefault()}>
              <label><span>What is it?</span><select value={newKind} onChange={(e) => setNewKind(e.target.value as NewAssetKind)} aria-label="Type of the new asset">{newAssetKinds.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}</select></label>
              <label><span>Name</span><input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={newKind === "set" ? "Location name" : `${newAssetKinds.find((k) => k.kind === newKind)?.label} name`} aria-label="Name for the new asset" /></label>
              {newKind === "character" && <label><span>Gender (optional, helps pick a voice)</span><select value={newGender} onChange={(e) => setNewGender(e.target.value)} aria-label="Gender for the new character"><option value="">Not set</option><option value="female">Female</option><option value="male">Male</option></select></label>}
              <button className="secondary" type="button" disabled={!newName.trim()} onClick={() => { onAddAsset(newKind, newName, newKind === "character" ? newGender : "", true); setNewName(""); setNewGender(""); setAdding(false); }} title="Choose an image. It becomes the approved reference; every other sheet is built from it."><ImagePlus size={14} aria-hidden="true" /> Add from image</button>
              <button className="tertiary" type="button" disabled={!newName.trim()} onClick={() => { onAddAsset(newKind, newName, newKind === "character" ? newGender : "", false); setNewName(""); setNewGender(""); setAdding(false); }} title="Plan its sheets now and generate the first picture yourself.">Add without image</button>
            </form>
          </section>
        </div>,
        document.body,
      )}
      {assets.length === 0 && <EmptyState icon={Users} title="No cast yet" tone="violet">Analyze a script in Story and the people, props and places it needs appear here. Or add a character, prop or set yourself with the button above.</EmptyState>}
      {groups.map(([label, types]) => {
        const items = assets.map((a, i) => ({ a, i })).filter(({ a }) => types.includes(a.type));
        return (
          <section key={label}>
            <h4>{(() => { const Icon = assetIconFor(types[0]); return <Icon size={14} aria-hidden="true" />; })()}{label}<span>{items.length}</span></h4>
            {!items.length && <p className="helper po-none">None yet.{onAddAsset ? " Use Add to the bible, or analyze a script that has them." : ""}</p>}
            <ul>
              {items.map(({ a, i }) => {
                const dot = dotFor(a, queue);
                const arc = arcs.get(a.name.toUpperCase());
                const dominant = arc ? [...arc.points].sort((x, y) => y.reading.intensity - x.reading.intensity)[0]?.reading : undefined;
                const variants = story ? new Set(story.variants.filter((v) => v.character.toUpperCase() === a.name.toUpperCase()).map((v) => v.value)).size : 0;
                return (
                  <li key={a.id}>
                    <button className={selected === i ? "on" : ""} onClick={() => onSelect(i)} aria-current={selected === i ? "true" : undefined}>
                      <span className={`po-avatar kind-${a.type}`} aria-hidden="true">{(() => { const Icon = assetIconFor(a.type); return <Icon size={14} />; })()}<i className={`po-dot ${dot}`} title={dotLabel[dot]} /></span>
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
export function AssetInspector({ asset, story, slotRef }: { asset?: ExtractedAsset; story?: ParsedStory; /** Called with the element that holds the sheet controls, or null when they are not shown here. */ slotRef?: (el: HTMLElement | null) => void }) {
  const arc = useMemo(() => (story && asset ? characterArcs(story).find((a) => a.character.toUpperCase() === asset.name.toUpperCase()) : undefined), [story, asset]);
  if (!asset) return <aside className="po-inspector"><span className="eyebrow">INSPECTOR</span><p className="helper">Select something in the bible to see what the script says about it.</p></aside>;
  const scenes = story?.scenes.filter((s) => asset.sceneIds.includes(s.id)) ?? [];
  const variants = story?.variants.filter((v) => v.character.toUpperCase() === asset.name.toUpperCase()) ?? [];
  const prop = story?.props.find((p) => asset.type === "prop" && p.name === asset.name);
  const plan = arc ? expressionPlan(arc) : [];
  return (
    <aside className="po-inspector" aria-label="Inspector">
      {slotRef && <div className="ss-slot" ref={slotRef} />}
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
