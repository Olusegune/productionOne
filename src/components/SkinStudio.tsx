import { useState } from "react";
import { Plus, ScanFace, ShieldCheck, X } from "lucide-react";
import type { ExtractedAsset } from "../domain/productionStudio";
import { approvedSkin, checkSkinSpec, CONTROL_LABELS, FINE_HAIR, FINISH, isPhotorealStyle, newSkin, overridesOf, PROTECT_CHOICES, recordSkin, RETOUCH, SKIN_PRESETS, SKIN_REGIONS, skinLine, TEXTURE, TONAL, withPreset, type Level } from "../domain/skin";
import { approveRevision, type SkinControls, type SkinSpec, type VariationState } from "../domain/variations";
import "../wardrobe.css";

export interface SkinStudioProps {
  character: ExtractedAsset;
  variations: VariationState;
  updateVariations: (update: (v: VariationState) => VariationState) => void;
  /** The character's own style, or the project's. */
  style: { family?: string; name?: string; rendering?: string };
  notify: (message: string) => void;
}

const nowIso = () => new Date().toISOString();
const LEVELS: Record<keyof SkinControls, Array<Level<string>>> = { textureDetail: TEXTURE, surfaceFinish: FINISH, tonalVariation: TONAL, fineFacialHair: FINE_HAIR, retouching: RETOUCH };

/**
 * Skin & Surface: the desired look of a photorealistic character's skin, as structured choices. Saving a profile makes no picture and costs nothing; the
 * controls only change what is written into new pictures once the profile is approved. Age, lighting, grading, makeup and temporary conditions are separate.
 */
export function SkinStudio({ character, variations, updateVariations, style, notify }: SkinStudioProps) {
  const current = approvedSkin(variations, character.id)?.spec;
  const photoreal = isPhotorealStyle(style);
  const [spec, setSpec] = useState<SkinSpec>(() => current ?? newSkin(character.id));
  const [more, setMore] = useState(false);
  const edit = (patch: Partial<SkinSpec>) => setSpec((s) => ({ ...s, ...patch }));
  const overrides = overridesOf(spec);
  const unsaved = JSON.stringify(spec) !== JSON.stringify(current ?? newSkin(character.id));

  const save = () => {
    const made = recordSkin(variations, spec, character.name, nowIso());
    if ("error" in made) { notify(made.error); return; }
    updateVariations((v) => { const r = recordSkin(v, spec, character.name, nowIso()); return "error" in r ? v : approveRevision(r.state, r.ref); });
    notify(photoreal ? `Skin profile approved for ${character.name}. It is written into new pictures.` : `Skin profile saved for ${character.name}. The style is not photorealistic, so it is not written into pictures.`);
  };
  const problem = checkSkinSpec(spec);
  const setMark = (i: number, patch: Partial<SkinSpec["marks"][number]>) => edit({ marks: spec.marks.map((m, n) => (n === i ? { ...m, ...patch } : m)) });

  return (
    <section className="panel wd" aria-label="Skin and surface">
      <header className="wd-head"><div><h2><ScanFace size={18} aria-hidden="true" /> Skin &amp; Surface</h2>
        <p className="helper">The look you want for {character.name}'s skin: natural texture, restrained highlights, believable tone. These are wishes an image model tries to meet, not exact values, so every picture is still checked by you. Nothing here makes a picture or costs anything.</p></div></header>

      {!photoreal && <p className="helper warn" role="note">This project's style ({style.name || "not set"}) is not photorealistic. You can save a profile, but it is not written into pictures, so the style is never pushed toward realism.</p>}

      <div className="wd-design">
        <div className="sk-presets" role="radiogroup" aria-label="Starting preset">
          {SKIN_PRESETS.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={spec.preset === p.id} className={spec.preset === p.id ? "on" : ""} onClick={() => setSpec((s) => withPreset(s, p.id))}>
              <b>{p.label}</b><small>{p.blurb}</small>
            </button>
          ))}
        </div>

        <div className="wd-fields">
          {(Object.keys(LEVELS) as Array<keyof SkinControls>).map((k) => (
            <div className="sk-ctl" key={k}>
              <label>{CONTROL_LABELS[k]}
                <select value={spec[k]} aria-describedby={`sk-hint-${k}`} onChange={(e) => edit({ [k]: e.target.value, preset: spec.preset } as Partial<SkinSpec>)}>{LEVELS[k].map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select>
              </label>
              <small id={`sk-hint-${k}`}>{LEVELS[k].find((l) => l.id === spec[k])?.hint}</small>
            </div>
          ))}
        </div>
        {overrides.length > 0 && <p className="helper" aria-live="polite">Changed from {SKIN_PRESETS.find((p) => p.id === (spec.preset === "custom" ? "natural" : spec.preset))?.label}: {overrides.map((o) => `${o.label.toLowerCase()} ${o.from.toLowerCase()} to ${o.to.toLowerCase()}`).join("; ")}.</p>}

        <fieldset className="wd-keep"><legend>Distinctive marks (kept exactly where they are)</legend>
          {spec.marks.map((m, i) => (
            <div className="sk-mark" key={i}>
              <label>What<input aria-label={`Mark ${i + 1} what`} value={m.what} onChange={(e) => setMark(i, { what: e.target.value })} placeholder="a small scar" /></label>
              <label>Where<input aria-label={`Mark ${i + 1} where`} value={m.where} onChange={(e) => setMark(i, { where: e.target.value })} placeholder="the left eyebrow" /></label>
              <button type="button" className="an-x" aria-label={`Remove mark ${i + 1}`} onClick={() => edit({ marks: spec.marks.filter((_, n) => n !== i) })}><X size={13} aria-hidden="true" /></button>
            </div>
          ))}
          <button type="button" className="an-add" onClick={() => edit({ marks: [...spec.marks, { what: "", where: "" }] })}><Plus size={13} aria-hidden="true" /> Add a mark</button>
        </fieldset>

        <div className="wd-fields">
          <label>Complexion (your words)<input value={spec.complexion} onChange={(e) => edit({ complexion: e.target.value })} placeholder="for example warm olive" /></label>
          <label>Undertone (your words)<input value={spec.undertone} onChange={(e) => edit({ undertone: e.target.value })} placeholder="for example golden" /></label>
          <label>Makeup<input value={spec.makeup} onChange={(e) => edit({ makeup: e.target.value })} placeholder="none, or describe it" /></label>
        </div>
        <p className="helper">Complexion and undertone are only what you write. Nothing else in the profile is chosen from them.</p>

        <fieldset className="wd-keep"><legend><ShieldCheck size={14} aria-hidden="true" /> What a skin refinement must not change</legend>
          {PROTECT_CHOICES.map((c) => <label key={c.id}><input type="checkbox" checked={spec.protect.includes(c.id)} onChange={(e) => edit({ protect: e.target.checked ? [...spec.protect, c.id] : spec.protect.filter((x) => x !== c.id) })} /> {c.label}</label>)}
        </fieldset>

        <button type="button" className="wd-more" onClick={() => setMore((m) => !m)} aria-expanded={more}>{more ? "Hide" : "Show"} regional controls</button>
        {more && (
          <div className="wd-fields" aria-label="Regional controls">
            {SKIN_REGIONS.map((r) => (
              <label key={r}>{r[0].toUpperCase() + r.slice(1)}
                <select aria-label={`${r} texture`} value={spec.regions[r]?.texture ?? ""} onChange={(e) => edit({ regions: { ...spec.regions, [r]: { ...spec.regions[r], texture: (e.target.value || undefined) as SkinControls["textureDetail"] | undefined } } })}><option value="">Texture as above</option>{TEXTURE.map((l) => <option key={l.id} value={l.id}>{l.label} texture</option>)}</select>
                <select aria-label={`${r} finish`} value={spec.regions[r]?.finish ?? ""} onChange={(e) => edit({ regions: { ...spec.regions, [r]: { ...spec.regions[r], finish: (e.target.value || undefined) as SkinControls["surfaceFinish"] | undefined } } })}><option value="">Finish as above</option>{FINISH.map((l) => <option key={l.id} value={l.id}>{l.label} finish</option>)}</select>
              </label>
            ))}
            <p className="helper">Regional wishes are written into the request as wording. Picture models cannot reliably limit a change to one region, so check each candidate.</p>
          </div>
        )}

        <label>Temporary conditions (sweat, dirt, wetness; one per line)<textarea rows={2} value={spec.conditions.join("\n")} onChange={(e) => edit({ conditions: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) })} /></label>
        <p className="helper">Temporary conditions are kept apart: they never change the approved profile.</p>

        {problem && <p className="helper warn" role="alert">{problem}</p>}
        <p className="wd-why" aria-live="polite">{skinLine(spec)}</p>
        <div className="wd-actions">
          <button className="primary" onClick={save} disabled={!!problem || (!!current && !unsaved)}>{current ? "Save as a new version" : "Save and approve the profile"}</button>
          <span className="helper">{current ? `Approved profile in use: ${SKIN_PRESETS.find((p) => p.id === current.preset)?.label}.` : "No profile approved yet."} {unsaved ? "You have changes that are not saved." : ""}</span>
        </div>
      </div>
    </section>
  );
}
