import type { Dispatch, SetStateAction } from "react";
import { DirectRoom } from "../components/DirectRoom";
import type { ProportionProfile } from "../domain/proportions";
import type { SceneState } from "../domain/sceneState";
import type { LookState } from "../domain/grade";
import { Eyebrow } from "../components/Eyebrow";
import { Clapperboard, Pause, Play, ArrowLeft, ArrowRight, Copy, Trash2, Plus } from "lucide-react";
import { type ShotRecord } from "../domain/productionStudio";
import { isTauri } from "../appHelpers";
import type { AnalysisResult } from "../domain/productionStudio";
import type { QueueState } from "../domain/generationQueue";
import type { StyleBible } from "../domain/visualDevelopment";

/** The Direct workspace. Extracted from App.tsx; everything it needs arrives as props. */
export interface DirectViewProps {
  activeShot: ShotRecord;
  addShot: () => void;
  analysis: AnalysisResult;
  animaticPlaying: boolean;
  animaticTime: number;
  assetRefs: Record<string, string[]>;
  deleteShot: () => void;
  duplicateShot: () => void;
  moveShot: (direction: -1 | 1) => void;
  patchShot: (field: keyof ShotRecord, value: string | number | string[]) => void;
  providersOpen: boolean;
  queue: QueueState;
  selectedShot: number;
  setAnimaticPlaying: Dispatch<SetStateAction<boolean>>;
  setAnimaticTime: Dispatch<SetStateAction<number>>;
  setLocalOpen: Dispatch<SetStateAction<boolean>>;
  setNotice: Dispatch<SetStateAction<string>>;
  setProvidersOpen: Dispatch<SetStateAction<boolean>>;
  setQueue: (update: (q: QueueState) => QueueState) => void;
  setSelectedShot: Dispatch<SetStateAction<number>>;
  setShots: Dispatch<SetStateAction<ShotRecord[]>>;
  setStoryboardsEnabled: Dispatch<SetStateAction<boolean>>;
  shots: ShotRecord[];
  storyboardsEnabled: boolean;
  styleBible: StyleBible;
  title: string;
  totalAnimaticDuration: number;
  format: string;
  setFormat: (aspect: string) => void;
  proportions?: Record<string, ProportionProfile>;
  looks?: LookState;
  setLooks?: Dispatch<SetStateAction<LookState>>;
  sceneStates?: Record<string, SceneState>;
  setSceneStates?: Dispatch<SetStateAction<Record<string, SceneState>>>;
}

export function DirectView(p: DirectViewProps) {
  const { activeShot, addShot, analysis, animaticPlaying, animaticTime, assetRefs, deleteShot, duplicateShot, moveShot, patchShot, providersOpen, queue, selectedShot, setAnimaticPlaying, setAnimaticTime, setLocalOpen, setNotice, setProvidersOpen, setQueue, setSelectedShot, setShots, setStoryboardsEnabled, shots, storyboardsEnabled, styleBible, title, totalAnimaticDuration, format, setFormat } = p;
  return (
<div className="dr-wrap">
            <DirectRoom
              analysis={analysis}
              shots={shots}
              setShots={(u) => setShots(u)}
              queue={queue}
              setQueue={setQueue}
              style={styleBible}
              assetRefs={assetRefs}
              desktop={isTauri}
              providersVersion={Number(providersOpen)}
              enabled={storyboardsEnabled}
              setEnabled={setStoryboardsEnabled}
              title={title}
              format={format}
              proportions={p.proportions}
              looks={p.looks}
              setLooks={p.setLooks}
              sceneStates={p.sceneStates}
              setSceneStates={p.setSceneStates}
              setFormat={setFormat}
              notify={setNotice}
              openProviders={() => setProvidersOpen(true)}
              openLocal={() => setLocalOpen(true)}
            />
            {storyboardsEnabled && (
              <details className="po-classic">
                <summary>Classic shot editor and video prompt compiler</summary>
          <section className="studio-page legacy-ui">
            <div className="optional-banner">
              <div>
                <Eyebrow icon={Clapperboard}>OPTIONAL WORKFLOW</Eyebrow>
                <h2>Director’s Room</h2>
                <p>Enable shot planning without rebuilding the project.</p>
              </div>
              <button
                className={storyboardsEnabled ? "primary" : "secondary"}
                onClick={() => setStoryboardsEnabled(!storyboardsEnabled)}
              >
                {storyboardsEnabled
                  ? "Storyboarding enabled"
                  : "Enable storyboarding"}
              </button>
            </div>
            {storyboardsEnabled ? (
              <div className="two-column">
                <div className="panel shot-preview">
                  <div className="real-empty" role="img" aria-label="No storyboard frame">
                    Storyboard frames for {activeShot.id} are not generated yet. This preview shows only real frames.
                  </div>
                  <div className="timeline">
                    <span
                      style={{
                        width: `${totalAnimaticDuration ? (animaticTime / totalAnimaticDuration) * 100 : 0}%`,
                      }}
                    />
                    <button
                      className="timeline-play"
                      aria-label={animaticPlaying ? "Pause the animatic" : "Play the animatic"}
                      onClick={() => setAnimaticPlaying((value) => !value)}
                    >
                      {animaticPlaying ? (
                        <Pause size={14} />
                      ) : (
                        <Play size={14} />
                      )}
                    </button>
                    <b>
                      {animaticTime.toFixed(1)} /{" "}
                      {totalAnimaticDuration.toFixed(1)}s
                    </b>
                    <small>
                      {activeShot.id} · {activeShot.action}
                    </small>
                  </div>
                  <div className="editor-actions">
                    <button
                      className="secondary"
                      onClick={() => moveShot(-1)}
                      disabled={selectedShot === 0}
                    >
                      <ArrowLeft size={13} /> Earlier
                    </button>
                    <button
                      className="secondary"
                      onClick={() => moveShot(1)}
                      disabled={selectedShot === shots.length - 1}
                    >
                      Later <ArrowRight size={13} />
                    </button>
                    <button className="secondary" onClick={duplicateShot}>
                      <Copy size={13} /> Duplicate
                    </button>
                    <button className="secondary danger" onClick={deleteShot}>
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                  <div className="shot-strip">
                    {shots.map((shot, index) => (
                      <button
                        className={index === selectedShot ? "selected" : ""}
                        key={shot.id}
                        onClick={() => {
                          setSelectedShot(index);
                          setAnimaticPlaying(false);
                          setAnimaticTime(
                            shots
                              .slice(0, index)
                              .reduce(
                                (total, item) => total + item.duration,
                                0,
                              ),
                          );
                        }}
                      >
                        <span>{shot.id}</span>
                        <b>{shot.cameraFraming}</b>
                        <small>
                          {shot.duration.toFixed(1)}s · {shot.storyboardStatus}
                        </small>
                      </button>
                    ))}
                    <button onClick={addShot}>
                      <Plus /> Add shot
                    </button>
                  </div>
                </div>
                <div className="panel shot-form">
                  <span className="eyebrow">SHOT EDITOR · {activeShot.id}</span>
                  <h3>Performance & camera direction</h3>
                  {(
                    [
                      ["action", "Action"],
                      ["dialogue", "Dialogue (source)"],
                      ["emotionalObjective", "Emotional objective"],
                      ["facialActing", "Facial acting"],
                      ["bodyLanguage", "Body language"],
                      ["microAnimation", "Micro-animation"],
                      ["cameraFraming", "Camera framing"],
                      ["cameraMovement", "Camera movement"],
                      ["soundEffects", "Sound effects"],
                      ["ambience", "Ambience"],
                    ] as Array<[keyof ShotRecord, string]>
                  ).map(([field, label]) => (
                    <label key={field}>
                      <span>{label}</span>
                      <input
                        value={String(activeShot[field])}
                        onChange={(e) => patchShot(field, e.target.value)}
                      />
                    </label>
                  ))}
                  <label>
                    <span>Duration</span>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={activeShot.duration}
                      onChange={(e) =>
                        patchShot("duration", Number(e.target.value))
                      }
                    />
                  </label>
                  <button
                    className="primary full"
                    onClick={() => patchShot("storyboardStatus", "approved")}
                  >
                    Approve shot plan
                  </button>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <Clapperboard size={34} />
                <h3>Storyboarding is off</h3>
                <p>Asset production and delivery remain fully available.</p>
              </div>
            )}
          </section>
              </details>
            )}
          </div>
  );
}
