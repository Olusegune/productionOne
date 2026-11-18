import { moreShapes, projectFormats, ratioOf } from "../domain/formats";

/** A small outline of the shape, drawn at the right proportions. */
function Glyph({ aspect }: { aspect: string }) {
  const r = ratioOf(aspect) || 1;
  const w = r >= 1 ? 26 : Math.round(26 * r);
  const h = r >= 1 ? Math.round(26 / r) : 26;
  return <span className="fmt-glyph" aria-hidden="true" style={{ width: w, height: h }} />;
}

/**
 * The shape of the finished project: frames, video and previews all follow it.
 * Named presets for the common cases (TikTok, Instagram, cinema) and every other shape under "More shapes".
 */
export function FormatPicker({ value, onChange, compact = false }: { value: string; onChange: (aspect: string) => void; compact?: boolean }) {
  const preset = projectFormats.find((f) => f.aspect === value);
  return (
    <div className={`fmt${compact ? " compact" : ""}`} role="group" aria-label="Project format">
      <div className="fmt-row">
        {projectFormats.map((f) => (
          <button key={f.id} type="button" className={`fmt-opt${value === f.aspect ? " on" : ""}`} aria-pressed={value === f.aspect} onClick={() => onChange(f.aspect)} title={f.use}>
            <Glyph aspect={f.aspect} />
            <span className="fmt-name">{f.label}</span>
            <span className="fmt-ratio">{f.aspect}</span>
          </button>
        ))}
        <label className="fmt-more">
          <span>More shapes</span>
          <select aria-label="More shapes" value={preset ? "" : value} onChange={(e) => e.target.value && onChange(e.target.value)}>
            {preset && <option value="">Choose…</option>}
            {!preset && !moreShapes.includes(value) && <option value={value}>{value}</option>}
            {moreShapes.filter((s) => !projectFormats.some((f) => f.aspect === s)).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>
      {!compact && <p className="fmt-note">{preset ? `${preset.use}.` : "A custom shape."} Frames, video and previews follow this. Change it any time: frames you already made keep their shape and are marked.</p>}
    </div>
  );
}
