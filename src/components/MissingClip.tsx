import { Trash2 } from "lucide-react";
import type { DemoClip } from "../domain/demoClips";

/** Stands in for a clip whose file is not on this computer. The line or prompt stays so the clip can be made again. */
export function MissingClip({ clip, onRemove }: { clip: DemoClip; onRemove: () => void }) {
  const what = clip.kind === "audio" ? (clip.line ? `“${clip.line.slice(0, 60)}”` : "This audio clip") : "This video clip";
  return (
    <figure className="clip-missing">
      <div className="clip-missing-body" role="status">
        <b>File missing</b>
        <small>{what} is not on this computer, for example because the project was opened somewhere its files are not. Make it again, or remove it from the list.</small>
      </div>
      <figcaption><button className="tertiary" onClick={onRemove}><Trash2 size={13} aria-hidden="true" /> Remove from list</button></figcaption>
    </figure>
  );
}
