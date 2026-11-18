import { ArrowRight, Download, FilePlus2, FolderOpen, ImagePlus } from "lucide-react";
import { StatTiles } from "./StatTiles";
import type { GoldenPathInput, GoldenStep } from "../domain/goldenPath";
import { heroSummary } from "../domain/projectHero";
import { thumbFor } from "../domain/styleGallery";
import type { StyleBible } from "../domain/visualDevelopment";

interface Counts { scenes: number; characters: number; props: number; sets: number }

/** The top of the Projects home: the title, how far along the production is, one big button for what to do next, and the look of the film as a picture. */
export function ProjectHero({ title, filePath, style, golden, counts, onNew, onOpen, onSave, onContinue, onWorkspace }: {
  title: string;
  filePath: string | null | undefined;
  style: StyleBible;
  golden: GoldenPathInput;
  counts: Counts;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onContinue: (step: GoldenStep) => void;
  onWorkspace: (name: string) => void;
}) {
  const { percent, next, button, status } = heroSummary(golden);
  const picture = style.locked || style.name ? thumbFor(style) : null;
  const palette = style.palette.length ? style.palette : ["#1b1815", "#d1b47b"];
  return (
    <div className="ph" role="group" aria-label="Project">
      <div className="ph-main">
        <span className="eyebrow">{filePath ?? "AUTOSAVED PRODUCTION"}</span>
        <h2>{title}</h2>
        <p className="ph-status">{status}</p>
        <div className="ph-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Production progress">
          <span style={{ width: `${percent}%` }} />
        </div>
        <small className="ph-percent">{percent}% of the way to a delivery package</small>
        <div className="ph-actions">
          <button className="primary ph-go" onClick={() => (next ? onContinue(next) : onWorkspace("Deliver"))}>{button} <ArrowRight size={16} aria-hidden="true" /></button>
          {!golden.hasScript && golden.assetCount === 0 && <button className="secondary" onClick={() => onWorkspace("Design")} title="No script needed: add a character, costume, prop or set from an image you already have and build its sheets, poses and expressions"><ImagePlus size={15} /> Start from images</button>}
          <button className="secondary" onClick={onNew}><FilePlus2 size={15} /> New</button>
          <button className="secondary" onClick={onOpen}><FolderOpen size={15} /> Open…</button>
          <button className="secondary" onClick={onSave}><Download size={15} /> Save</button>
        </div>
      </div>
      <figure className="ph-look">
        {picture ? <img src={picture} alt={`${style.name}: the same scene in this look`} /> : <div className="ph-swatch" style={{ background: `linear-gradient(135deg, ${palette.join(", ")})` }} role="img" aria-label="Palette of the visual style" />}
        <figcaption>
          <small>{style.locked ? "LOCKED LOOK" : "LOOK (NOT LOCKED)"}</small>
          <b>{style.name || "No style chosen"}</b>
          <span className="ph-palette" aria-hidden="true">{palette.slice(0, 5).map((c) => <i key={c} style={{ background: c }} />)}</span>
        </figcaption>
      </figure>
      <StatTiles scenes={counts.scenes} characters={counts.characters} props={counts.props} sets={counts.sets} approved={golden.approvedCount} total={golden.assetCount} />
    </div>
  );
}
