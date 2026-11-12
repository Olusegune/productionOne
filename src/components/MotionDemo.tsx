import { useEffect, useMemo, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { Film } from "lucide-react";
import { buildMotionPrompt, clipName, motionKeysFor, presetFor, type DemoClip, type MotionKey } from "../domain/demoClips";
import type { QueueState } from "../domain/generationQueue";
import type { ExtractedAsset } from "../domain/productionStudio";
import { mergeVideoModels, type DiscoveredCatalog } from "../domain/imageCatalog";
import { identityFacts, primaryViewKeys } from "../domain/sheetSpecs";
import { useLocalAi } from "../data/localAi";
import type { StyleBible } from "../domain/visualDevelopment";

/** A short motion clip (turnaround, walk, pose) made from an approved reference. It is a demo of the design, not part of the sheets. */
export function MotionDemo(props: {
  asset?: ExtractedAsset;
  queue: QueueState;
  clips: DemoClip[];
  setClips: (update: (clips: DemoClip[]) => DemoClip[]) => void;
  style: StyleBible;
  desktop: boolean;
  notify: (message: string) => void;
  openProviders: () => void;
}) {
  const { asset, queue, clips, setClips, style, desktop, notify, openProviders } = props;
  const local = useLocalAi(desktop);
  const localVideo = local.templates.filter((t) => t.kind === "video" && t.ready);
  const [where, setWhere] = useState<string>("kie");
  const [discovered, setDiscovered] = useState<DiscoveredCatalog>({});
  useEffect(() => {
    if (desktop) void invoke<DiscoveredCatalog>("model_catalog").then((c) => setDiscovered(c ?? {})).catch(() => {});
  }, [desktop]);
  const models = useMemo(() => mergeVideoModels(discovered), [discovered]);
  const [model, setModel] = useState(models[0].id);
  const [motion, setMotion] = useState<MotionKey>("turntable");
  const [custom, setCustom] = useState("");
  const [duration, setDuration] = useState(5);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  if (!asset || asset.type === "set" || asset.type === "environment") return null;
  const anchor = queue.jobs.find((j) => j.assetId === asset.id && j.approved && j.outputPath && primaryViewKeys.includes(j.viewKey));
  const mine = clips.filter((c) => c.assetId === asset.id && c.kind !== "audio");
  const motionKeys = motionKeysFor(asset.type, asset.name) as Array<Exclude<MotionKey, "custom">>;
  const ready = !!anchor && !running && (motion !== "custom" || custom.trim().length > 4);

  const run = async () => {
    if (!anchor?.outputPath) return;
    setRunning(true);
    setError("");
    const prompt = buildMotionPrompt(motion, custom, asset.name, style, identityFacts(asset));
    try {
      const useLocal = where.startsWith("local:") && local.status.comfyui[0];
      const path = useLocal
        ? await invoke<string>("comfy_generate_video", { base: local.status.comfyui[0].url, model: where.slice(6), prompt, aspect: "3:4", reference: anchor.outputPath, outputName: clipName(asset.id, motion), duration })
        : await invoke<string>("generate_video", { model, prompt, aspect: "3:4", reference: anchor.outputPath, outputName: clipName(asset.id, motion), duration });
      setClips((list) => [...list, { id: `CLIP-${asset.id}-${Date.now().toString(36)}`, assetId: asset.id, assetName: asset.name, motion, model: where.startsWith("local:") ? `ComfyUI · ${where.slice(6)}` : model, path, prompt, duration, createdAt: Date.now() }]);
      notify(`Motion demo saved for ${asset.name}.`);
    } catch (e) {
      const message = String(e);
      setError(message);
      if (/No kie key/i.test(message)) openProviders();
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="panel motion-demo" id="motion-audition" tabIndex={-1} aria-label="Motion audition">
      <div className="panel-heading">
        <div><span className="eyebrow">MOTION AUDITION · VIDEO</span><h3>{asset.name}: see how {asset.type === "character" ? "they move" : "it moves"}</h3></div>
      </div>
      {!desktop && <p className="helper">Video generation runs in the Windows app.</p>}
      {!anchor && <p className="helper">Approve a front view first. The clip is made from your approved reference so the character stays the same.</p>}
      {anchor && (
        <>
          <div className="sheet-controls">
            <label><span>Motion</span>
              <select value={motion} onChange={(e) => setMotion(e.target.value as MotionKey)}>
                {motionKeys.map((k) => <option key={k} value={k}>{presetFor(k).label}</option>)}
                <option value="custom">Your own description</option>
              </select></label>
            <label><span>Make it with</span>
              <select value={where} onChange={(e) => setWhere(e.target.value)} aria-label="Where to make the clip">
                {localVideo.map((t) => <option key={t.id} value={`local:${t.id}`}>On this computer: {t.title}</option>)}
                <option value="kie">Kie.ai (cloud)</option>
              </select></label>
            {where === "kie" && <label><span>Video model (Kie.ai)</span>
              <input list="video-models" value={model} onChange={(e) => setModel(e.target.value)} aria-label="Video model id" />
              <datalist id="video-models">{models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</datalist></label>}
            <label><span>Length (seconds)</span>
              <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>{[5, 8, 10].map((d) => <option key={d}>{d}</option>)}</select></label>
          </div>
          {motion === "custom" && <label className="settings-field"><span>Describe the motion</span><input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. turns slowly and raises the lantern" /></label>}
          <p className="helper">{where.startsWith("local:") ? "Made on this computer: free and offline. A few minutes on a mid-range graphics card." : `${models.find((m) => m.id === model)?.note ?? "Custom Kie.ai model id: capabilities and price are not known to this app."} Video usually costs more than an image; your provider bills the account behind your key.`}</p>
          <div className="sheet-actions-row">
            <button className="primary" disabled={!ready || !desktop} onClick={() => void run()}><Film size={15} /> {running ? "Making the clip… (a few minutes)" : "Generate motion demo"}</button>
          </div>
          {error && <p className="helper warn" role="alert">{error}</p>}
        </>
      )}
      {mine.length > 0 && (
        <div className="clip-grid">
          {mine.slice().reverse().map((c) => (
            <figure key={c.id}>
              <video controls loop muted playsInline src={convertFileSrc(c.path)} aria-label={`${c.assetName} ${c.motion} demo`} />
              <figcaption><b>{c.motion === "custom" ? "Custom motion" : presetFor(c.motion).label}</b><small>{c.model} · {c.duration}s</small></figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
