import { CategoryIcon } from "../components/CategoryIcon";
import { useEffect, useState } from "react";
import { BibleTree, AssetInspector } from "../components/bible";
import { ArtDirectionBar } from "../components/ArtDirectionBar";
import { isTauri } from "../appHelpers";
import { AssetLab } from "../components/AssetLab";
import { CharacterBible } from "../components/CharacterBible";
import { SheetStudio } from "../components/SheetStudio";
import { MotionDemo } from "../components/MotionDemo";
import { VoiceAudition } from "../components/VoiceAudition";
import { BatchAudio } from "../components/BatchAudio";
import { type ProviderId } from "../domain/providerRegistry";
import { Eyebrow } from "../components/Eyebrow";
import { Library, Copy, Plus, ListOrdered, Pause, Play, Download } from "lucide-react";
import { RealImage } from "../components/RealImage";
import { type PromptPackage, pauseQueue, resumeQueue, cancelJob, retryJob } from "../domain/productionStudio";
import type { ImageModelRecord, SheetPlan } from "../domain/visualDevelopment";
import type { AnalysisResult, GenerationJob } from "../domain/productionStudio";
import type { DemoClip } from "../domain/demoClips";
import type { ImageJob, QueueState } from "../domain/generationQueue";
import type { SheetType, StyleBible } from "../domain/visualDevelopment";
import type { NewAssetKind } from "../domain/readingActions";
import type { Dispatch, SetStateAction, RefObject } from "react";
import { ProportionPanel } from "../components/ProportionPanel";
import { FitPanel } from "../components/FitPanel";
import { costShort, priceFor } from "../domain/pricing";
import { profileFromWorld, type WorldRules } from "../domain/worldRules";
import type { FitRule } from "../domain/fit";
import { madeWithEarlierProportions } from "../domain/characterLayers";
import { approve as approveJob } from "../domain/generationQueue";
import type { ProportionProfile } from "../domain/proportions";
import { enqueue } from "../domain/generationQueue";
import { readModelChoice } from "../data/modelChoice";
import { RemoveAsset } from "../components/RemoveAsset";
import type { ProjectSlice } from "../domain/removeAsset";

/** The Design workspace. Extracted from App.tsx; everything it needs arrives as props. */
export interface DesignViewProps {
  activePromptPackage: PromptPackage | null;
  analysis: AnalysisResult;
  approveAsset: (index: number) => void;
  assetOutputs: Record<string, string>;
  assetRefs: Record<string, string[]>;
  clips: DemoClip[];
  copyPrompt: () => Promise<void>;
  exportAllPrompts: () => Promise<void>;
  exportPrompt: (format: "txt" | "md" | "json" | "csv") => void;
  focusSheetType: SheetType | undefined;
  generateImageDirect: () => Promise<void>;
  generatingImage: boolean;
  importAsset: (file: File) => Promise<void>;
  jobs: GenerationJob[];
  modelRecommendations: (ImageModelRecord & { score: number; reason: string; })[];
  onAddAsset: (kind: NewAssetKind, name: string, gender: string, withImage: boolean, extras?: { description?: string; layout?: string; makeConcept?: boolean }) => void;
  /** Adds one asset per chosen image, named from the file names. */
  onAddMany?: (kind: NewAssetKind) => void;
  onSheetApproved: (job: ImageJob, primary: boolean) => void;
  onSheetUnapproved: (job: ImageJob) => void;
  openAiConfigured: boolean;
  plannedSheets: SheetPlan[];
  promptMode: keyof PromptPackage;
  providersOpen: boolean;
  queue: QueueState;
  queueAsset: () => void;
  reviseSelectedAsset: () => void;
  runQueue: () => Promise<void>;
  selectedAsset: number;
  setAnalysis: Dispatch<SetStateAction<AnalysisResult>>;
  setAssetRefs: (update: (r: Record<string, string[]>) => Record<string, string[]>) => void;
  setClips: (update: (c: DemoClip[]) => DemoClip[]) => void;
  setCredentialProvider: Dispatch<SetStateAction<ProviderId>>;
  setFocusSheetType: Dispatch<SetStateAction<SheetType | undefined>>;
  setJobs: Dispatch<SetStateAction<GenerationJob[]>>;
  setLocalOpen: Dispatch<SetStateAction<boolean>>;
  setNotice: Dispatch<SetStateAction<string>>;
  setPromptMode: Dispatch<SetStateAction<keyof PromptPackage>>;
  setProvidersOpen: Dispatch<SetStateAction<boolean>>;
  setQueue: (update: (q: QueueState) => QueueState) => void;
  setSelectedAsset: Dispatch<SetStateAction<number>>;
  setSheetNotes: Dispatch<SetStateAction<Record<string, string>>>;
  setSheetSettings: Dispatch<SetStateAction<Record<string, string>>>;
  sheetSettings: Record<string, string>;
  proportions: Record<string, ProportionProfile>;
  world: WorldRules;
  setWorld: Dispatch<SetStateAction<WorldRules>>;
  fitRules: Record<string, FitRule[]>;
  setFitRules: Dispatch<SetStateAction<Record<string, FitRule[]>>>;
  setProportions: Dispatch<SetStateAction<Record<string, ProportionProfile>>>;
  setStyleBible: Dispatch<SetStateAction<StyleBible>>;
  sheetNotes: Record<string, string>;
  studioControl: RefObject<{ generateFirst: () => void; } | null>;
  styleBible: StyleBible;
  /** Everything a removal touches, and how to put a changed copy back (used by "Remove from project" and its Undo). */
  slice?: ProjectSlice;
  applySlice?: (next: ProjectSlice) => void;
}

type Section = "sheets" | "identity" | "motion" | "voice";
const sections: Array<{ id: Section; label: string }> = [
  { id: "sheets", label: "Sheets" },
  { id: "identity", label: "Identity" },
  { id: "motion", label: "Motion" },
  { id: "voice", label: "Voice and sound" },
];

/** True while the window is wide enough for the side inspector (it is hidden below 1281 px). */
function useWide(): boolean {
  const query = "(min-width: 1281px)";
  const [wide, setWide] = useState(() => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : true));
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(query);
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return wide;
}

export function DesignView(p: DesignViewProps) {
  const [section, setSection] = useState<Section>("sheets");
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const wide = useWide();
  const inInspector = wide && section === "sheets";
  const { activePromptPackage, analysis, approveAsset, assetOutputs, assetRefs, clips, copyPrompt, exportAllPrompts, exportPrompt, focusSheetType, generateImageDirect, generatingImage, importAsset, jobs, modelRecommendations, onAddAsset, onAddMany, onSheetApproved, onSheetUnapproved, openAiConfigured, plannedSheets, promptMode, providersOpen, queue, queueAsset, reviseSelectedAsset, runQueue, selectedAsset, setAnalysis, setAssetRefs, setClips, setCredentialProvider, setFocusSheetType, setJobs, setLocalOpen, setNotice, setPromptMode, setProvidersOpen, setQueue, setSelectedAsset, setSheetNotes, setSheetSettings, setStyleBible, sheetNotes, sheetSettings, studioControl, styleBible, proportions, setProportions, world, setWorld, fitRules, setFitRules } = p;
  return (
<div className="po-design">
            <BibleTree outputs={assetOutputs} assets={analysis.assets} story={analysis.story} queue={queue} selected={selectedAsset} onSelect={setSelectedAsset} onAddAsset={onAddAsset} onAddMany={onAddMany} />
            <div className="po-canvas design-workspace">
            <ArtDirectionBar
              style={styleBible}
              onChange={setStyleBible}
              sheetCount={plannedSheets.length}
            />
            <div className="as-head">
              <div className="as-title"><b>{analysis.assets[selectedAsset]?.name ?? "No asset selected"}</b>{analysis.assets[selectedAsset] && <small className="cat-tag"><CategoryIcon type={analysis.assets[selectedAsset].type} size={13} /> {analysis.assets[selectedAsset].type} · {analysis.assets[selectedAsset].status === "approved" ? "approved" : "planned"}</small>}</div>
              {p.slice && p.applySlice && <RemoveAsset slice={p.slice} assetId={analysis.assets[selectedAsset]?.id} apply={p.applySlice} />}
              <div className="as-tabs" role="tablist" aria-label="Asset Studio sections">
                {sections.map((x) => <button key={x.id} role="tab" id={`as-tab-${x.id}`} aria-selected={section === x.id} aria-controls={`sec-${x.id}`} tabIndex={section === x.id ? 0 : -1} className={section === x.id ? "on" : ""} onClick={() => setSection(x.id)}>{x.label}</button>)}
              </div>
            </div>
            <div id="sec-identity" role="tabpanel" aria-labelledby="as-tab-identity" hidden={section !== "identity"}>
            <AssetLab
              asset={analysis.assets[selectedAsset]}
              onChange={(asset) => setAnalysis((current) => ({ ...current, assets: current.assets.map((item) => item.id === asset.id ? asset : item) }))}
              notify={setNotice}
            />
            {analysis.assets[selectedAsset]?.type === "character" && (() => {
              const a = analysis.assets[selectedAsset];
              return <ProportionPanel
                asset={a}
                profile={proportions[a.id]}
                startFrom={() => profileFromWorld(world, a.id)}
                world={world}
                onSetWorld={(w) => setWorld(w)}
                onChange={(next) => setProportions((cur) => { const m = { ...cur }; if (next) m[a.id] = next; else delete m[a.id]; return m; })}
                onGenerate={(asset, prompt) => {
                  const choice = readModelChoice();
                  setQueue((q) => enqueue(q, [{ assetId: asset.id, variant: "default", sheetType: "shape-candidate", viewKey: "candidate", label: "Proportion candidate", prompt, aspect: "2:3", fullBody: true, provider: choice.provider, model: choice.modelId, references: [], outputName: (revision: number) => `${asset.id}_proportion-candidate_v${String(revision).padStart(2, "0")}` }], Date.now(), true).state);
                }}
                candidates={queue.jobs.filter((j) => j.assetId === a.id && j.sheetType === "shape-candidate").map((j) => ({ id: j.id, path: j.outputPath, status: j.status }))}
                approvedViews={queue.jobs.filter((j) => j.assetId === a.id && j.sheetType !== "shape-candidate" && j.approved).length}
                cost={costShort(1, priceFor(readModelChoice().provider, readModelChoice().modelId, queue.perImageUsd))}
                referencePath={assetOutputs[a.id]}
                others={analysis.assets.filter((x) => x.type === "character" && x.id !== a.id).map((x) => ({ id: x.id, name: x.name }))}
                onApplyTo={(ids, applied) => setProportions((cur) => { const m = { ...cur }; for (const id of ids) m[id] = { ...applied, id }; return m; })}
                onOpenSheets={() => setSection("sheets")}
                notify={setNotice}
              />;
            })()}
            {analysis.assets[selectedAsset]?.type === "character" && proportions[analysis.assets[selectedAsset].id] && (() => {
              const a = analysis.assets[selectedAsset];
              const profile = proportions[a.id];
              const choice = readModelChoice();
              const ask = (sheetType: string, viewKey: string, label: string, prompt: string, references: string[], name: string) =>
                setQueue((q) => enqueue(q, [{ assetId: a.id, variant: "default", sheetType, viewKey, label, prompt, aspect: sheetType === "scale-fit" ? "16:9" : "2:3", fullBody: true, provider: choice.provider, model: choice.modelId, references, outputName: (revision: number) => `${a.id}_${name}_v${String(revision).padStart(2, "0")}` }], Date.now(), true).state);
              return <FitPanel
                asset={a}
                profile={profile}
                rules={fitRules[a.id] ?? []}
                onRules={(rules: FitRule[]) => setFitRules((cur) => ({ ...cur, [a.id]: rules }))}
                people={analysis.assets.filter((x) => x.type === "character" && proportions[x.id]).map((x) => ({ name: x.name, profile: proportions[x.id] }))}
                onGenerateScaleSheet={(prompt) => ask("scale-fit", "sheet", "Scale and Fit reference", prompt, [], "scale-fit")}
                originalPath={assetRefs[a.id]?.[0]}
                redesignCandidates={queue.jobs.filter((j) => j.assetId === a.id && j.sheetType === "redesign-candidate").map((j) => ({ id: j.id, path: j.outputPath, status: j.status, approved: j.approved }))}
                onGenerateRedesign={(req) => ask(req.sheetType, req.viewKey, req.label, req.prompt, req.references, "redesign-candidate")}
                onApproveCandidate={(id) => setQueue((q) => approveJob(q, id))}
                cost={costShort(1, priceFor(choice.provider, choice.modelId, queue.perImageUsd))}
                staleViews={queue.jobs.filter((j) => j.assetId === a.id && j.approved && madeWithEarlierProportions(j.provenance, profile)).length}
                notify={setNotice}
              />;
            })()}
            </div>
            <div id="sec-sheets" role="tabpanel" aria-labelledby="as-tab-sheets" hidden={section !== "sheets"}>
            <CharacterBible onSection={setSection} asset={analysis.assets[selectedAsset]} onSheet={setFocusSheetType} notify={setNotice} jobs={queue.jobs} dialogueLines={analysis.story?.scenes.reduce((n, s) => n + s.dialogue.filter((d) => d.speaker.toUpperCase() === analysis.assets[selectedAsset]?.name.toUpperCase()).length, 0) ?? 0} />
            <SheetStudio
              assets={analysis.assets}
              scenes={analysis.scenes}
              story={analysis.story}
              assetIndex={selectedAsset}
              style={styleBible}
              queue={queue}
              setQueue={setQueue}
              desktop={isTauri}
              providersVersion={Number(providersOpen)}
              onApproved={onSheetApproved}
              onUnapproved={onSheetUnapproved}
              notify={setNotice}
              openProviders={() => setProvidersOpen(true)}
              openLocal={() => setLocalOpen(true)}
              controlRef={studioControl}
              refs={assetRefs}
              setRefs={setAssetRefs}
              onPatchAsset={(id, patch) => setAnalysis((cur) => ({ ...cur, assets: cur.assets.map((a) => (a.id === id ? { ...a, ...patch } : a)) }))}
              onAssetStyle={(id, style) => setAnalysis((cur) => ({ ...cur, assets: cur.assets.map((a) => { if (a.id !== id) return a; if (style) return { ...a, style }; const { style: _dropped, ...rest } = a; return rest; }) }))}
              notesByAsset={sheetNotes}
              proportions={proportions}
              setNotesByAsset={setSheetNotes}
              settings={sheetSettings}
              setSettings={setSheetSettings}
              focusSheetType={focusSheetType}
              controlsSlot={inInspector ? slot : null}
            />
            </div>
            <div id="sec-motion" role="tabpanel" aria-labelledby="as-tab-motion" hidden={section !== "motion"}>
            <MotionDemo
              asset={analysis.assets[Math.min(selectedAsset, Math.max(0, analysis.assets.length - 1))]}
              queue={queue}
              clips={clips}
              setClips={setClips}
              style={styleBible}
              desktop={isTauri}
              notify={setNotice}
              openProviders={() => setProvidersOpen(true)}
            />
            </div>
            <div id="sec-voice" role="tabpanel" aria-labelledby="as-tab-voice" hidden={section !== "voice"}>
            <VoiceAudition
              asset={analysis.assets[Math.min(selectedAsset, Math.max(0, analysis.assets.length - 1))]}
              story={analysis.story}
              clips={clips}
              setClips={setClips}
              desktop={isTauri}
              notify={setNotice}
              providersVersion={Number(providersOpen)}
              openProviders={(id) => { if (id) setCredentialProvider(id as ProviderId); setProvidersOpen(true); }}
              onChange={(asset) => setAnalysis((current) => ({ ...current, assets: current.assets.map((item) => item.id === asset.id ? asset : item) }))}
            />
            <BatchAudio
              assets={analysis.assets}
              story={analysis.story}
              clips={clips}
              setClips={setClips}
              desktop={isTauri}
              notify={setNotice}
              providersVersion={Number(providersOpen)}
              openProviders={(id) => { if (id) setCredentialProvider(id as ProviderId); setProvidersOpen(true); }}
              onAssetChange={(asset) => setAnalysis((current) => ({ ...current, assets: current.assets.map((item) => item.id === asset.id ? asset : item) }))}
            />
            </div>
            <details className="po-classic">
            <summary>Prompt Studio, model hub, imports and quality tools</summary>
            <section className="three-column">
              <div className="panel asset-browser">
                <div className="panel-heading">
                  <div>
                    <Eyebrow icon={Library}>SHARED ASSET REGISTRY</Eyebrow>
                    <h3>Production assets</h3>
                  </div>
                </div>
                {analysis.assets.map((asset, index) => (
                  <button
                    className={selectedAsset === index ? "selected" : ""}
                    key={asset.id}
                    onClick={() => setSelectedAsset(index)}
                  >
                    <span className={`kind ${asset.type}`}>
                      <CategoryIcon type={asset.type} size={14} />
                    </span>
                    <span>
                      <b>{asset.name}</b>
                      <small>
                        {asset.id} ·{" "}
                        {
                          plannedSheets.filter(
                            (sheet) => sheet.assetId === asset.id,
                          ).length
                        }{" "}
                        sheets
                      </small>
                    </span>
                    <i className={asset.status}>{asset.status}</i>
                  </button>
                ))}
              </div>
              <div className="panel design-preview">
                {analysis.assets[selectedAsset] && activePromptPackage && (
                  <>
                    <div className="panel-heading">
                      <div>
                        <span className="eyebrow">
                          {analysis.assets[selectedAsset].type.toUpperCase()} ·{" "}
                          {analysis.assets[selectedAsset].id}
                        </span>
                        <h3>{analysis.assets[selectedAsset].name}</h3>
                      </div>
                      <span
                        className={`status ${analysis.assets[selectedAsset].status}`}
                      >
                        {analysis.assets[selectedAsset].status}
                      </span>
                    </div>
                    <RealImage
                      path={assetOutputs[analysis.assets[selectedAsset].id]}
                      label={`Approved reference for ${analysis.assets[selectedAsset].name}`}
                      empty="No approved reference yet. Generate or add one above."
                    />
                    <div className="prompt-tabs">
                      {(
                        [
                          "universal",
                          "compact",
                          "technical",
                          "negative",
                        ] as Array<keyof PromptPackage>
                      ).map((mode) => (
                        <button
                          className={promptMode === mode ? "active" : ""}
                          onClick={() => setPromptMode(mode)}
                          key={mode}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                    <div className="prompt-box">
                      <span>{promptMode.toUpperCase()} PROMPT</span>
                      {promptMode === "universal" ? <textarea className="asset-prompt-editor" aria-label="Editable asset prompt" value={activePromptPackage[promptMode]} onChange={(e) => setAnalysis((current) => ({ ...current, assets: current.assets.map((item, index) => index === selectedAsset ? { ...item, prompt: e.target.value } : item) }))} /> : <p>{activePromptPackage[promptMode]}</p>}
                    </div>
                    <div className="prompt-actions">
                      <button className="secondary" onClick={copyPrompt}>
                        <Copy size={13} /> Copy
                      </button>
                      {(["txt", "md", "json", "csv"] as const).map((format) => (
                        <button
                          className="secondary"
                          key={format}
                          onClick={() => exportPrompt(format)}
                        >
                          {format.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    <div className="model-match">
                      <span>RECOMMENDED MODEL</span>
                      <b>{modelRecommendations[0]?.name}</b>
                      <small>
                        {modelRecommendations[0]?.score}/100 ·{" "}
                        {modelRecommendations[0]?.reason}
                      </small>
                    </div>
                    <div className="image-generation-gate">
                      <button
                        className="primary"
                        disabled={
                          !openAiConfigured ||
                          generatingImage
                        }
                        onClick={generateImageDirect}
                      >
                        {generatingImage
                          ? "Generating…"
                          : "Generate verified image"}
                      </button>
                      <small>
                        {openAiConfigured
                          ? "OpenAI credential configured."
                          : "Configure OpenAI in Global production tools."}{" "}
                        Provider pricing is not assumed; confirm the ceiling
                        against your account.
                      </small>
                    </div>
                    <div className="button-row">
                      <button
                        className="primary"
                        onClick={() => approveAsset(selectedAsset)}
                      >
                        Approve identity
                      </button>
                      <label className="secondary file-button">
                        Import & QA
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void importAsset(file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <button className="secondary" onClick={queueAsset}>
                        <Plus size={14} /> Queue prompt package
                      </button>
                      <button
                        className="secondary"
                        onClick={reviseSelectedAsset}
                      >
                        Revise & selectively regenerate
                      </button>
                    </div>
                    {assetOutputs[analysis.assets[selectedAsset].id] && (
                      <p className="helper">
                        Verified labeled reference:{" "}
                        {assetOutputs[analysis.assets[selectedAsset].id]}
                      </p>
                    )}
                  </>
                )}
              </div>
              <div className="panel">
                <div className="panel-heading">
                  <div>
                    <Eyebrow icon={ListOrdered}>DURABLE QUEUE</Eyebrow>
                    <h3>Production jobs</h3>
                  </div>
                  <div className="queue-controls">
                    <button
                      title="Pause queue"
                      onClick={() => setJobs(pauseQueue)}
                    >
                      <Pause size={12} />
                    </button>
                    <button
                      title="Resume queue"
                      onClick={() => setJobs(resumeQueue)}
                    >
                      <Play size={12} />
                    </button>
                  </div>
                </div>
                <div className="queue-list">
                  {jobs.length === 0 ? (
                    <p className="empty">No jobs queued.</p>
                  ) : (
                    jobs.map((job) => (
                      <div key={job.id}>
                        <span>
                          <b>{job.id}</b>
                          <small>
                            {job.assetId}
                            {job.outputPath ? ` · ${job.outputPath}` : ""}
                            {job.error ? ` · ${job.error}` : ""}
                          </small>
                        </span>
                        <i className={job.status}>{job.status}</i>
                        {job.status !== "complete" &&
                          job.status !== "cancelled" && (
                            <button
                              title={`Cancel ${job.id}`}
                              onClick={() =>
                                setJobs((current) => cancelJob(current, job.id))
                              }
                            >
                              ×
                            </button>
                          )}
                        {(job.status === "failed" ||
                          job.status === "cancelled") && (
                          <button
                            title={`Retry ${job.id}`}
                            onClick={() =>
                              setJobs((current) => retryJob(current, job.id))
                            }
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
                <button
                  className="primary full"
                  onClick={runQueue}
                  disabled={!jobs.some((j) => j.status === "queued")}
                >
                  <Play size={14} /> Process next job
                </button>
                <button className="secondary full" onClick={exportAllPrompts}>
                  <Download size={14} /> Export all prompts
                </button>
                <p className="helper">
                  A job completes only after its output package is written.
                  Queue state survives restart.
                </p>
              </div>
            </section>
            </details>
            </div>
            <AssetInspector asset={analysis.assets[Math.min(selectedAsset, Math.max(0, analysis.assets.length - 1))]} story={analysis.story} slotRef={inInspector ? setSlot : undefined} />
          </div>
  );
}
