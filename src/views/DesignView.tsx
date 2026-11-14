import { BibleTree, AssetInspector } from "../components/bible";
import { ArtDirectionBar } from "../components/ArtDirectionBar";
import { SectionNav } from "../components/SectionNav";
import { designSections, isTauri } from "../appHelpers";
import { AssetLab } from "../components/AssetLab";
import { CharacterBible } from "../components/CharacterBible";
import { SheetStudio } from "../components/SheetStudio";
import { MotionDemo } from "../components/MotionDemo";
import { VoiceAudition } from "../components/VoiceAudition";
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
import type { Dispatch, SetStateAction, RefObject } from "react";

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
  onAddCharacter: (name: string) => void;
  onSheetApproved: (job: ImageJob, primary: boolean) => void;
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
  setStyleBible: Dispatch<SetStateAction<StyleBible>>;
  sheetNotes: Record<string, string>;
  studioControl: RefObject<{ generateFirst: () => void; } | null>;
  styleBible: StyleBible;
}

export function DesignView(p: DesignViewProps) {
  const { activePromptPackage, analysis, approveAsset, assetOutputs, assetRefs, clips, copyPrompt, exportAllPrompts, exportPrompt, focusSheetType, generateImageDirect, generatingImage, importAsset, jobs, modelRecommendations, onAddCharacter, onSheetApproved, openAiConfigured, plannedSheets, promptMode, providersOpen, queue, queueAsset, reviseSelectedAsset, runQueue, selectedAsset, setAnalysis, setAssetRefs, setClips, setCredentialProvider, setFocusSheetType, setJobs, setLocalOpen, setNotice, setPromptMode, setProvidersOpen, setQueue, setSelectedAsset, setSheetNotes, setStyleBible, sheetNotes, studioControl, styleBible } = p;
  return (
<div className="po-design">
            <BibleTree assets={analysis.assets} story={analysis.story} queue={queue} selected={selectedAsset} onSelect={setSelectedAsset} onAddCharacter={onAddCharacter} />
            <div className="po-canvas design-workspace">
            <ArtDirectionBar
              style={styleBible}
              onChange={setStyleBible}
              sheetCount={plannedSheets.length}
            />
            <SectionNav sections={designSections} />
            <div id="sec-identity">
            <AssetLab
              asset={analysis.assets[selectedAsset]}
              onChange={(asset) => setAnalysis((current) => ({ ...current, assets: current.assets.map((item) => item.id === asset.id ? asset : item) }))}
              notify={setNotice}
            />
            </div>
            <CharacterBible asset={analysis.assets[selectedAsset]} onSheet={setFocusSheetType} notify={setNotice} jobs={queue.jobs} dialogueLines={analysis.story?.scenes.reduce((n, s) => n + s.dialogue.filter((d) => d.speaker.toUpperCase() === analysis.assets[selectedAsset]?.name.toUpperCase()).length, 0) ?? 0} />
            <div id="sec-sheets">
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
              notify={setNotice}
              openProviders={() => setProvidersOpen(true)}
              openLocal={() => setLocalOpen(true)}
              controlRef={studioControl}
              refs={assetRefs}
              setRefs={setAssetRefs}
              notesByAsset={sheetNotes}
              setNotesByAsset={setSheetNotes}
              focusSheetType={focusSheetType}
            />
            </div>
            <div id="sec-motion">
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
            <div id="sec-voice">
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
                      {asset.type.slice(0, 2)}
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
            <AssetInspector asset={analysis.assets[Math.min(selectedAsset, Math.max(0, analysis.assets.length - 1))]} story={analysis.story} />
          </div>
  );
}
