import { useEffect, useMemo, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Music2, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import type { QueueState } from "../domain/generationQueue";
import type { ScriptScene, ShotRecord } from "../domain/productionStudio";
import { frameForShot } from "../domain/direct";

/** Plays the shots in order using the frames made for them, with slow camera moves, dialogue as subtitles and an optional temp track. Shots with no frame yet show a plain card. */
export function Animatic({ shots, queue, scenes }: { shots: ShotRecord[]; queue: QueueState; scenes: ScriptScene[] }) {
  const starts = useMemo(() => { let t = 0; return shots.map((s) => { const at = t; t += s.duration; return at; }); }, [shots]);
  const total = shots.reduce((n, s) => n + s.duration, 0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioName, setAudioName] = useState("");
  const audio = useRef<HTMLAudioElement>(null);
  const last = useRef(0);

  let index = 0;
  starts.forEach((s, i) => { if (s <= time) index = i; });
  const shot = shots[index];
  const local = shot ? Math.min(1, Math.max(0, (time - starts[index]) / Math.max(0.1, shot.duration))) : 0;
  const frame = shot ? frameForShot(queue, shot.id) : undefined;

  useEffect(() => {
    if (!playing) return;
    last.current = performance.now();
    let id = 0;
    const tick = (now: number) => {
      const dt = (now - last.current) / 1000;
      last.current = now;
      setTime((t) => { const n = t + dt; if (n >= total) { setPlaying(false); return total; } return n; });
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing, total]);

  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    if (playing) { if (Math.abs(el.currentTime - time) > 0.4) el.currentTime = time; void el.play().catch(() => {}); } else el.pause();
  }, [playing, audioUrl]);

  const seek = (t: number) => { setTime(t); if (audio.current) audio.current.currentTime = t; };
  const step = (d: number) => { const i = Math.min(shots.length - 1, Math.max(0, index + d)); seek(starts[i] ?? 0); };
  const move = shot?.movement ?? "static";
  const transform = (() => {
    const p = local;
    switch (move) {
      case "push-in": case "dolly": return `scale(${1 + 0.12 * p})`;
      case "pull-out": return `scale(${1.12 - 0.12 * p})`;
      case "pan": case "track": return `scale(1.1) translateX(${(-3 + 6 * p).toFixed(2)}%)`;
      case "tilt": case "crane": return `scale(1.1) translateY(${(3 - 6 * p).toFixed(2)}%)`;
      case "handheld": return `scale(1.04) translate(${(Math.sin(time * 5) * 0.4).toFixed(2)}%, ${(Math.cos(time * 4) * 0.4).toFixed(2)}%)`;
      case "orbit": return `scale(1.08) rotate(${(-1 + 2 * p).toFixed(2)}deg)`;
      default: return "none";
    }
  })();

  if (!shots.length) return null;
  const heading = shot ? scenes.find((s) => s.id === shot.sceneId)?.heading : "";
  return (
    <section className="panel animatic" aria-label="Animatic">
      <div className="panel-heading">
        <div><span className="eyebrow">Animatic</span><h3>{total.toFixed(1)} seconds · {shots.length} shots</h3></div>
        <label className="secondary file-button"><Music2 size={14} /> {audioName || "Add a temp track"}
          <input type="file" accept="audio/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setAudioUrl(URL.createObjectURL(f)); setAudioName(f.name); } e.target.value = ""; }} />
        </label>
      </div>
      <div className="an-stage">
        {frame?.outputPath ? <img key={shot.id} src={convertFileSrc(frame.outputPath)} alt={`Frame for ${shot.id}`} style={{ transform }} /> : <div className="an-empty"><b>{shot?.title ?? shot?.id}</b><span>No frame yet for this shot</span></div>}
        <div className="an-info"><b>{shot?.id}</b><span>{heading}</span></div>
        {shot?.dialogue && <p className="an-sub"><b>{shot.speaker}</b> {shot.dialogue}</p>}
      </div>
      <div className="an-controls">
        <button onClick={() => step(-1)} aria-label="Previous shot"><SkipBack size={16} /></button>
        <button className="primary" onClick={() => { if (time >= total) seek(0); setPlaying((p) => !p); }} aria-label={playing ? "Pause" : "Play"}>{playing ? <Pause size={16} /> : <Play size={16} />}</button>
        <button onClick={() => step(1)} aria-label="Next shot"><SkipForward size={16} /></button>
        <input type="range" min={0} max={total} step={0.05} value={time} onChange={(e) => seek(Number(e.target.value))} aria-label="Timeline" />
        <span className="an-time">{time.toFixed(1)} / {total.toFixed(1)}s</span>
      </div>
      <div className="an-strip" role="list">
        {shots.map((s, i) => <button role="listitem" key={s.id} className={i === index ? "on" : ""} style={{ flexGrow: s.duration }} onClick={() => seek(starts[i])} title={`${s.id} · ${s.duration}s`}><span className={frameForShot(queue, s.id) ? "has" : ""} /></button>)}
      </div>
      {audioUrl && <audio ref={audio} src={audioUrl} preload="auto" />}
    </section>
  );
}
