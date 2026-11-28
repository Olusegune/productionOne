import { useMemo, useState } from "react";
import { Check, Lightbulb, Sparkles, TriangleAlert, X } from "lucide-react";
import { useModelChoice } from "../data/modelChoice";
import { modelTakesReferences, providerLabels } from "../domain/imageCatalog";
import { approve, costPreview, enqueue, reject, type ImageJob, type QueueState } from "../domain/generationQueue";
import type { ExtractedAsset } from "../domain/productionStudio";
import { styleFingerprint } from "../domain/style2d";
import type { StyleBible } from "../domain/visualDevelopment";
import { findEntity, type SkinSpec, type VariationState } from "../domain/variations";
import { approvedSkin, isPhotorealStyle } from "../domain/skin";
import { describeLighting } from "../domain/lighting";
import { refinementCost, refusedLocally } from "../domain/skinRefine";
import { colourReviewQuestions, expectedColourEffect, lightingBlocker, lightingRequests, lightingSource, lightingTestStanding, lightJobs, SKIN_LIGHTS, startLightingTest } from "../domain/skinLighting";
import { buildPreflight } from "../domain/preflight";
import { plainNote } from "../domain/plainNote";
import { PreflightCard } from "./PreflightCard";
import { ZoomImage, ZoomToolbar, useZoomSync } from "./ZoomCompare";
import "../wardrobe.css";

export interface SkinLightingTestProps {
  character: ExtractedAsset;
  variations: VariationState;
  updateVariations: (update: (v: VariationState) => VariationState) => void;
  queue: QueueState;
  setQueue: (update: (q: QueueState) => QueueState) => void;
  style: StyleBible;
  desktop: boolean;
  providersVersion: number;
  onApproved: (job: ImageJob, primary: boolean) => void;
  onUnapproved: (job: ImageJob) => void;
  notify: (message: string) => void;
  openProviders: () => void;
}

const nowIso = () => new Date().toISOString();

/**
 * Lighting test: the same approved person and skin profile under four plain lighting setups. Each picture is a new candidate made by an image model, not
 * relighting and not a colour filter; the colour is judged by you against the approved reference and what the light itself would do. Pressing Generate is the
 * only thing that spends money.
 */
export function SkinLightingTest(props: SkinLightingTestProps) {
  const { character, variations, updateVariations, queue, setQueue, style, desktop, notify } = props;
  const choice = useModelChoice(desktop, props.providersVersion);
  const { provider, modelId, configured } = choice;
  const takesRefs = modelTakesReferences(provider, modelId);
  const profile = approvedSkin(variations, character.id);
  const source = useMemo(() => lightingSource(queue, variations, character), [queue, variations, character]);
  const blocker = lightingBlocker({ style, state: variations, character, source: source?.path, takesReferences: takesRefs });
  const cost = costPreview(SKIN_LIGHTS.length, queue.perImageUsd);

  const entity = variations.entities.find((e) => e.kind === "lighting-test" && !e.archived && e.characterId === character.id);
  const newest = entity?.revisions[entity.revisions.length - 1];
  const jobs = entity && newest ? lightJobs(queue, { id: entity.id, revision: newest.n }) : {};
  const candidates = Object.values(jobs).filter((j): j is ImageJob => !!j);
  const failed = candidates.filter((j) => j.status === "failed");
  const standing = lightingTestStanding(variations, character.id);

  const [lightId, setLightId] = useState(SKIN_LIGHTS[0].id);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const light = SKIN_LIGHTS.find((l) => l.id === lightId)!;
  const shown = jobs[lightId];
  const zoom = useZoomSync(`${newest?.n ?? 0}-${lightId}`, [source?.path, shown?.outputPath]);
  const spec = (profile?.spec ?? undefined) as SkinSpec | undefined;
  const questions = spec ? colourReviewQuestions(light.record, spec) : [];
  const keyFor = (i: number) => `${lightId}-${i}`;
  const identityOk = !!checks[keyFor(0)], colourOk = !!checks[keyFor(1)];
  const canKeep = !!shown?.outputPath && identityOk && colourOk;
  const spent = entity ? refinementCost(queue, entity.id) : undefined;

  const generate = () => {
    if (blocker || !source) { notify(blocker ?? "There is no approved picture to start from."); return; }
    if (desktop && choice.keysChecked && !configured[provider]) { notify(`There is no ${providerLabels[provider]} key yet. Add it, then generation starts.`); props.openProviders(); return; }
    const made = startLightingTest(variations, { character, now: nowIso() });
    if ("error" in made) { notify(made.error); return; }
    updateVariations(() => made.variations);
    const reqs = lightingRequests({ style, provider, model: modelId, character, lookName: made.variant, test: made.ref, spec: profile!.spec, source: source.path, styleFp: styleFingerprint(style) });
    const result = enqueue(queue, reqs, Date.now(), true);
    setQueue(() => result.state);
    setChecks({});
    notify(`Making ${result.added} lighting-test candidates of ${character.name}. The approved picture is not changed.`);
  };
  const keep = () => { if (!shown || !canKeep) return; setQueue((q) => approve(q, shown.id)); props.onApproved(shown, false); };
  const turnDown = () => { for (const j of candidates) { setQueue((q) => reject(q, j.id)); if (j.approved) props.onUnapproved(j); } setChecks({}); };

  const plan = buildPreflight({
    count: SKIN_LIGHTS.length, what: `${character.name} under ${SKIN_LIGHTS.map((l) => l.label.toLowerCase()).join(", ")}, as new candidates`, costLabel: cost.label,
    protectedItems: ["The same person, age, expression and marks", "The complexion and the skin profile, word for word, in every light"],
    approvedUntouched: variations.entities.reduce((n, e) => n + e.revisions.filter((r) => r.status === "approved").length, 0),
    affects: [],
    uses: [source ? `${character.name}'s approved ${source.kind === "refined" ? "refined skin" : ""} picture (one reference, never changed)`.replace("  ", " ") : "", `${modelId} on ${providerLabels[provider]}`],
    deliverables: ["Four head-and-shoulders candidates, one per light, to compare with the approved reference", "Nothing is approved until you approve it"],
  });

  if (!isPhotorealStyle(style)) return null;
  return (
    <section className="panel wd" aria-label="Lighting test">
      <header className="wd-head"><div><h2><Lightbulb size={18} aria-hidden="true" /> Lighting test</h2>
        <p className="helper">See {character.name}'s skin in four lights: neutral diffuse, soft side, directional and backlight. The lighting is kept in its own record, apart from the skin profile. Each picture is a new candidate made by an image model, not the same picture relit and never a colour filter, so check each against the approved reference. Pressing the button below is the only thing that spends money.</p></div></header>

      {blocker ? <p className="helper warn" role="alert">{blocker}</p> : <p className="helper" role="note">Warm light and natural undertones can be intentional, so nothing here tries to remove a warm cast. Judge colour against the reference and the light.</p>}
      {standing?.outOfDate && <p className="helper warn" role="alert"><TriangleAlert size={14} aria-hidden="true" /> The skin profile has changed since this lighting test was approved. The test still shows what it was made with; make it again to see the new profile.</p>}

      <PreflightCard plan={plan} />
      <div className="wd-actions">
        <button className="primary" onClick={generate} disabled={!!blocker}><Sparkles size={15} aria-hidden="true" /> Generate lighting test · {cost.label}</button>
        {spent && spent.pictures > 0 && <span className="helper">Spent on this test so far: {spent.attempts} attempt{spent.attempts === 1 ? "" : "s"}{spent.usd !== null ? `, about $${spent.usd.toFixed(2)}` : ""}.{spent.refused > 0 ? ` ${spent.refused} more ${spent.refused === 1 ? "was" : "were"} refused on this computer before sending, so ${spent.refused === 1 ? "it was" : "they were"} not charged.` : ""}</span>}
      </div>
      {failed.length > 0 && (
        <div className="wd-stale" role="alert">
          <b>{failed.length} picture{failed.length === 1 ? "" : "s"} could not be made.</b>
          <ul>{[...new Set(failed.map((j) => plainNote(j.error ?? "It failed without a message.")))].map((m) => <li key={m}>{m}</li>)}</ul>
          {failed.every(refusedLocally) && <p className="helper">Nothing reached the provider, so nothing was charged.</p>}
        </div>
      )}

      {entity && newest && candidates.length > 0 && spec && (
        <div className="wd-candidates" aria-live="polite">
          <h3>Compare each light with the approved reference</h3>
          <div className="rv-seg" role="group" aria-label="Which light">
            {SKIN_LIGHTS.map((l) => <button key={l.id} type="button" className={lightId === l.id ? "on" : ""} aria-pressed={lightId === l.id} onClick={() => setLightId(l.id)}>{l.label}{jobs[l.id]?.approved ? " ✓" : ""}</button>)}
          </div>
          <p className="helper">{light.purpose} <small>({describeLighting(light.record)})</small></p>
          <ZoomToolbar z={zoom} regions />
          {zoom.headNote && <p className="helper">{zoom.headNote}</p>}
          <div className="rv-compare">
            <figure><ZoomImage z={zoom} index={0} path={source?.path} label="Approved reference" empty="No reference" /><figcaption>Approved reference</figcaption></figure>
            <figure><ZoomImage z={zoom} index={1} path={shown?.outputPath} label={`${light.label} candidate`} empty={shown ? (shown.status === "failed" ? "This picture could not be made" : "Still being made") : "No candidate"} /><figcaption>{light.label}{shown?.approved ? " · kept as a reference" : ""}</figcaption></figure>
          </div>
          <p className="helper">{expectedColourEffect(light.record)}</p>
          <fieldset className="wd-keep"><legend>Your review of this light (kept apart)</legend>
            {questions.map((q, i) => <label key={i}><input type="checkbox" checked={!!checks[keyFor(i)]} onChange={(e) => setChecks((c) => ({ ...c, [keyFor(i)]: e.target.checked }))} /> {q}</label>)}
          </fieldset>
          <p className={canKeep ? "helper" : "helper warn"}>{canKeep ? "Identity and colour confirmed for this light." : "Confirm the person is the same and the complexion matches, allowing for this light, before keeping it as a reference."}</p>
          <div className="wd-decide">
            <button className="primary" disabled={!canKeep} onClick={keep}><Check size={14} aria-hidden="true" /> Keep this light as a reference</button>
            <button onClick={turnDown} aria-label="Turn down this lighting test"><X size={14} aria-hidden="true" /> Turn down all</button>
          </div>
        </div>
      )}

      {entity && (
        <ol className="wd-history" aria-label="Versions of the lighting test">
          {entity.revisions.map((r) => <li key={r.n}>Version {r.n}: {r.status === "approved" ? "approved" : r.status === "rejected" ? "turned down" : "candidate"}, made with skin profile version {(findEntity(variations, entity.id)?.revisions.find((x) => x.n === r.n)?.spec as { skin?: { revision: number } } | undefined)?.skin?.revision}</li>)}
        </ol>
      )}
    </section>
  );
}
