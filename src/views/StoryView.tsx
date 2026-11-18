import { useMemo, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { FileInput, FileText, ScanText, X } from "lucide-react";
import { CastBoard } from "../components/CastBoard";
import { ReadingPanel } from "../components/ReadingPanel";
import { ScriptTemplatePicker } from "../components/ScriptTemplatePicker";
import type { AnalysisResult } from "../domain/productionStudio";
import { explainStory } from "../engine/explain";

type Tab = "assets" | "questions" | "reading";

/** The Story workspace: the script on one side, the breakdown (assets, questions, reading) on the other. */
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
  /** Approved picture per asset id, for thumbnails. */
  outputs?: Record<string, string>;
  /** Opens an asset where its sheets are made. */
  onOpenAsset?: (assetId: string) => void;
  /** Folds one set into another. */
  onMergeSets?: (keepId: string, dropId: string) => void;
}) {
  const { script, analysis, notify } = props;
  const [tab, setTab] = useState<Tab>("assets");
  const [templates, setTemplates] = useState(false);
  const story = analysis.story;
  const questions = useMemo(() => (story && story.scenes.length ? explainStory(story).needsReview : 0), [story]);
  const empty = script.trim() === "";
  const lines = empty ? 0 : script.split("\n").length;
  const tabs: Array<{ id: Tab; label: string; count?: number }> = [
    { id: "assets", label: "Assets", count: analysis.assets.length },
    { id: "questions", label: "Questions", count: questions },
    { id: "reading", label: "Reading" },
  ];
  const useTemplate = (text: string) => { props.setScript(text); setTemplates(false); notify("Template loaded. Review it before analyzing."); };

  return (
    <section className="sv studio-page" aria-label="Script">
      <header className="sv-head">
        <div>
          <h2>Script breakdown</h2>
          <p>{analysis.scenes.length} {analysis.scenes.length === 1 ? "scene" : "scenes"} · {analysis.assets.length} {analysis.assets.length === 1 ? "asset" : "assets"}{story ? <> · <span className="pill">{story.format}</span></> : null}</p>
        </div>
        <div className="sv-toolbar" role="toolbar" aria-label="Script actions">
          {!empty && <button className="tertiary" onClick={() => setTemplates(true)}><FileText size={15} aria-hidden="true" /> Templates</button>}
          <button className="secondary" onClick={props.onImport}><FileInput size={15} aria-hidden="true" /> Import script</button>
          <button className="primary" onClick={props.onAnalyze}><ScanText size={15} aria-hidden="true" /> Analyze script</button>
        </div>
      </header>

      <div className="sv-body">
        <div className="sv-source">
          <div className="sv-source-head"><b>Source</b><small>{empty ? "empty" : `${lines} line${lines === 1 ? "" : "s"}`}</small></div>
          {empty && (
            <div className="sv-empty">
              <p>Paste your script below, press <b>Import script</b>, or start from a template.</p>
              <ScriptTemplatePicker onUse={useTemplate} notify={notify} />
            </div>
          )}
          <textarea ref={props.scriptArea} className="script-editor" value={script} onChange={(e) => props.setScript(e.target.value)} aria-label="Script source" />
          <details className="sv-note">
            <summary>How the script is read</summary>
            <p>Scene headings, source dialogue, characters, sets and used props are found on this computer, for free. Suggested dialogue is never mixed with source dialogue. Each finding links back to the line it came from.</p>
          </details>
        </div>

        <div className="sv-breakdown">
          <div className="sv-tabs" role="tablist" aria-label="Breakdown">
            {tabs.map((t) => (
              <button key={t.id} role="tab" id={`sv-tab-${t.id}`} aria-selected={tab === t.id} aria-controls="sv-panel" tabIndex={tab === t.id ? 0 : -1} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
                {t.label}{t.count !== undefined && <span className={`sv-count${t.id === "questions" && t.count > 0 ? " warn" : ""}`}>{t.count}</span>}
              </button>
            ))}
          </div>
          <div id="sv-panel" role="tabpanel" aria-labelledby={`sv-tab-${tab}`} className="sv-panel">
            {tab === "assets" && <CastBoard analysis={analysis} onChange={props.setAnalysis} onAdd={props.onAddAsset} onJump={props.onJump} outputs={props.outputs} onOpenAsset={props.onOpenAsset} onMergeSets={props.onMergeSets} />}
            {tab === "questions" && <ReadingPanel bare part="questions" story={story} onJump={props.onJump} desktop={props.desktop} notify={notify} />}
            {tab === "reading" && <ReadingPanel bare part="reading" story={story} onJump={props.onJump} desktop={props.desktop} onStory={(next) => props.setAnalysis((a) => ({ ...a, story: next }))} notify={notify} onAddProp={props.onAddProp} onUseAge={props.onUseAge} />}
          </div>
        </div>
      </div>

      {templates && createPortal(
        <div className="modal-backdrop" role="presentation" onClick={() => setTemplates(false)}>
          <section className="sheet sv-templates" role="dialog" aria-modal="true" aria-label="Script templates" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === "Escape") setTemplates(false); }}>
            <div className="panel-heading"><h3>Script templates</h3><button className="icon-button" aria-label="Close templates" onClick={() => setTemplates(false)}><X size={16} /></button></div>
            <p className="helper">Loading a template replaces the script on screen. Your project is not saved until you save it.</p>
            <ScriptTemplatePicker onUse={useTemplate} notify={notify} />
          </section>
        </div>,
        document.body,
      )}
    </section>
  );
}
