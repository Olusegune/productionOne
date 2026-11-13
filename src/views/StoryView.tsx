import type { RefObject } from "react";
import { ListChecks, ScanText } from "lucide-react";
import { EditableInventory } from "../components/EditableInventory";
import { Eyebrow } from "../components/Eyebrow";
import { ReadingPanel } from "../components/ReadingPanel";
import { ScriptTemplatePicker } from "../components/ScriptTemplatePicker";
import type { AnalysisResult } from "../domain/productionStudio";

/** The Story workspace: the script on one side, what the engine found on the other. */
export function StoryView(props: {
  script: string;
  setScript: (text: string) => void;
  scriptArea: RefObject<HTMLTextAreaElement | null>;
  analysis: AnalysisResult;
  setAnalysis: (update: AnalysisResult | ((current: AnalysisResult) => AnalysisResult)) => void;
  desktop: boolean;
  notify: (message: string) => void;
  onImport: () => void;
  onAnalyze: () => void;
  onJump: (line: number) => void;
  onAddProp: (name: string) => void;
  onUseAge: (character: string, value: string) => void;
  onAddAsset: () => void;
}) {
  const { script, analysis, notify } = props;
  return (
    <section className="two-column studio-page">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <Eyebrow icon={ScanText}>SCRIPT INTELLIGENCE</Eyebrow>
            <h3>Source material</h3>
          </div>
          <div className="button-row">
            <button className="secondary" onClick={props.onImport}>Import script</button>
            <button className="primary" onClick={props.onAnalyze}>Analyze script</button>
          </div>
        </div>
        <ScriptTemplatePicker onUse={(text) => { props.setScript(text); notify("Template loaded. Review it before analyzing."); }} notify={notify} />
        <textarea ref={props.scriptArea} className="script-editor" value={script} onChange={(e) => props.setScript(e.target.value)} aria-label="Script source" />
        <p className="helper">Scene headings, source dialogue, characters, sets, and used props are extracted locally. Suggested dialogue is never mixed with source dialogue.</p>
      </div>
      <div className="panel">
        <div className="panel-heading">
          <div>
            <Eyebrow icon={ListChecks}>EDITABLE INVENTORY</Eyebrow>
            <h3>{analysis.scenes.length} scenes · {analysis.assets.length} assets</h3>
          </div>
        </div>
        <ReadingPanel story={analysis.story} onJump={props.onJump} desktop={props.desktop} onStory={(story) => props.setAnalysis((a) => ({ ...a, story }))} notify={notify} onAddProp={props.onAddProp} onUseAge={props.onUseAge} />
        <EditableInventory analysis={analysis} onChange={props.setAnalysis} onAdd={props.onAddAsset} />
      </div>
    </section>
  );
}
