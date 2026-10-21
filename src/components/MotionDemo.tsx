import { useEffect, useMemo, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { Film } from "lucide-react";
import { buildMotionPrompt, clipName, motionPresets, type DemoClip, type MotionKey } from "../domain/demoClips";
import type { QueueState } from "../domain/generationQueue";
import type { ExtractedAsset } from "../domain/productionStudio";
import { mergeVideoModels, type DiscoveredCatalog } from "../domain/imageCatalog";
import { primaryViewKeys } from "../domain/sheetSpecs";
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
  const [discovered, setDiscovered] = useState<DiscoveredCatalog>({});
  useEffect(() => {
    if (desktop) void invoke<DiscoveredCatalog>("model_catalog").then((c) => setDiscovered(c ?? {})).catch(() => {});
  }, [desktop]);
  const models = useMemo(() => mergeVideoModels(discovered), [discovered]);
  const [model, setModel] = useState(models[0].id);
  const [motion, setMotion] = useState<MotionKey>("turntable");
  const [custom, setCustom] = useState("");
  const [duration, setDuration] = useState(5);
  const [price, setPrice] = useState("");
  const [ceiling, setCeiling] = useState("");
  const [agree, setAgree] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  if (!asset || asset.type === "set" || asset.type === "environment") return null;
  const anchor = queue.jobs.find((j) => j.assetId === asset.id && j.approved && j.outputPath && primaryViewKeys.includes(j.viewKey));
  const mine = clips.filter((c) => c.assetId === asset.id);
  const per = Number(price);
  const total = Number(ceiling);
  const ready = !!anchor && per > 0 && total >= per && agree && !running && (motion !== "custom" || custom.trim().length > 4);

  const run = async () => {
    if (!anchor?.outputPath) return;
    setRunning(true);
    setError("");
    const prompt = buildMotionPrompt(motion, custom, asset.name, style);
    try {
      const path = await invoke<string>("generate_video", { model, prompt, aspect: "3:4", reference: anchor.outputPath, outputName: clipName(asset.id, motion), duration });
      setClips((list) => [...list, { id: `CLIP-${asset.id}-${Date.now().toString(36)}`, assetId: asset.id, assetName: asset.name, motion, model, path, prompt, duration, createdAt: Date.now() }]);
      notify(`Motion demo saved for ${asset.name}.`);
      setAgree(false);
    } catch (e) {
      const message = String(e);
      setError(message);
      if (/No kie key/i.test(message)) openProviders();
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="panel motion-demo" aria-label="Motion demo">
      <div className="panel-heading">
        <div><span className="eyebrow">MOTION DEMO · VIDEO</span><h3>{asset.name}: turnaround and pose clip</h3></div>
      </div>
      {!desktop && <p className="helper">Video generation runs in the Windows app.</p>}
      {!anchor && <p className="helper">Approve a front view first. The clip is made from your approved reference so the character stays the same.</p>}
      {anchor && (
        <>
          <div className="sheet-controls">
            <label><span>Motion</span>
              <select value={motion} onChange={(e) => setMotion(e.target.value as MotionKey)}>
                {(Object.keys(motionPresets) as Array<keyof typeof motionPresets>).map((k) => <option key={k} value={k}>{motionPresets[k].label}</option>)}
                <option value="custom">Your own description</option>
              </select></label>
            <label><span>Video model (Kie.ai)</span>
              <input list="video-models" value={model} onChange={(e) => setModel(e.target.value)} aria-label="Video model id" />
              <datalist id="video-models">{models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</datalist></label>
            <label><span>Length (seconds)</span>
              <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>{[5, 8, 10].map((d) => <option key={d}>{d}</option>)}</select></label>
            <label><span>Price for this clip (USD)</span><input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} aria-label="Price for this clip in dollars" /></label>
            <label><span>Spending ceiling (USD)</span><input inputMode="decimal" value={ceiling} onChange={(e) => setCeiling(e.target.value)} aria-label="Video spending ceiling in dollars" /></label>
          </div>
          {motion === "custom" && <label className="settings-field"><span>Describe the motion</span><input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. turns slowly and raises the lantern" /></label>}
          <p className="helper">{models.find((m) => m.id === model)?.note ?? "Custom Kie.ai model id: capabilities and price are not known to this app."} Video costs more than images. Enter the price Kie shows for this model; failed or long-running tasks may still be billed.</p>
          <label className="agree"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> I approve spending up to this ceiling on one clip.</label>
          <div className="sheet-actions-row">
            <button className="primary" disabled={!ready || !desktop} onClick={() => void run()}><Film size={15} /> {running ? "Making the clip… (a few minutes)" : "Generate motion demo"}</button>
            {!ready && !running && <span className="helper">{!(per > 0 && total >= per) ? "Enter a price and a ceiling at least that large." : !agree ? "Tick the approval box to continue." : ""}</span>}
          </div>
          {error && <p className="helper warn" role="alert">{error}</p>}
        </>
      )}
      {mine.length > 0 && (
        <div className="clip-grid">
          {mine.slice().reverse().map((c) => (
            <figure key={c.id}>
              <video controls loop muted playsInline src={convertFileSrc(c.path)} aria-label={`${c.assetName} ${c.motion} demo`} />
              <figcaption><b>{c.motion === "custom" ? "Custom motion" : motionPresets[c.motion].label}</b><small>{c.model} · {c.duration}s</small></figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
