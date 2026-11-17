import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Check, ChevronLeft, ChevronRight, Minus, Plus, RotateCcw, X } from "lucide-react";
import type { ImageJob } from "../domain/generationQueue";

export interface LightboxItem { job: ImageJob; label: string }

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

const decidable = (j: ImageJob) => j.status === "needs-review" || j.status === "completed";
const canApprove = (j: ImageJob) => decidable(j) && !j.approved;
const canReject = (j: ImageJob) => decidable(j) && !j.rejected;
const canUndo = (j: ImageJob) => j.status === "completed" && (j.approved || j.rejected);

/** Full-resolution viewer: wheel or +/- to zoom, drag to pan, double-click for 100%, arrows to move between views, A to approve, R to reject, U to take a decision back. */
export function Lightbox(props: {
  items: LightboxItem[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  onApprove: (job: ImageJob) => void;
  onReject: (job: ImageJob) => void;
  /** Takes a decision back (approved or rejected -> waiting). Optional so a viewer without it keeps working. */
  onReconsider?: (job: ImageJob) => void;
}) {
  const { items, index, onIndex, onClose, onApprove, onReject, onReconsider } = props;
  const item = items[index];
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const natural = useRef<{ w: number; h: number } | null>(null);
  const stage = useRef<HTMLDivElement>(null);

  const reset = useCallback(() => { setScale(1); setPan({ x: 0, y: 0 }); }, []);
  useEffect(() => { reset(); natural.current = null; }, [index, reset]);
  const go = useCallback((d: number) => onIndex((index + d + items.length) % items.length), [index, items.length, onIndex]);
  const zoom = useCallback((factor: number) => setScale((s) => clamp(s * factor, 1, 8)), []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "+" || e.key === "=") zoom(1.4);
      else if (e.key === "-") zoom(1 / 1.4);
      else if (e.key === "0") reset();
      else if (e.key.toLowerCase() === "a" && item && canApprove(item.job)) onApprove(item.job);
      else if (e.key.toLowerCase() === "r" && item && canReject(item.job)) onReject(item.job);
      else if (e.key.toLowerCase() === "u" && item && canUndo(item.job) && onReconsider) onReconsider(item.job);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [go, zoom, reset, onClose, onApprove, onReject, onReconsider, item]);

  if (!item || !item.job.outputPath) return null;
  const { job } = item;
  const path = job.outputPath ?? "";
  const hundred = () => {
    const n = natural.current; const box = stage.current;
    if (!n || !box) return 2.5;
    const fit = Math.min(box.clientWidth / n.w, box.clientHeight / n.h);
    return clamp(1 / fit, 1, 8);
  };

  // Rendered on the page itself: inside a panel with a blur effect, a "fixed" overlay is confined to that panel.
  return createPortal(
    <div className="lb" role="dialog" aria-modal="true" aria-label={`${item.label} full size`}>
      <div className="lb-top">
        <div className="lb-title"><b>{item.label}</b><span>{job.assetId} · {job.sheetType} · v{job.revision}{job.width ? ` · ${job.width}×${job.height}px` : ""}</span></div>
        <div className="lb-tools">
          <button onClick={() => zoom(1 / 1.4)} aria-label="Zoom out"><Minus size={16} /></button>
          <span className="lb-zoom">{Math.round(scale * 100)}%</span>
          <button onClick={() => zoom(1.4)} aria-label="Zoom in"><Plus size={16} /></button>
          <button onClick={reset} aria-label="Fit to screen"><RotateCcw size={15} /></button>
          <button onClick={onClose} aria-label="Close viewer"><X size={18} /></button>
        </div>
      </div>
      <div
        className={`lb-stage${scale > 1 ? " zoomed" : ""}`}
        ref={stage}
        onWheel={(e) => zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15)}
        onMouseDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; }}
        onMouseMove={(e) => { if (drag.current && scale > 1) setPan({ x: drag.current.px + e.clientX - drag.current.x, y: drag.current.py + e.clientY - drag.current.y }); }}
        onMouseUp={() => { drag.current = null; }}
        onMouseLeave={() => { drag.current = null; }}
        onDoubleClick={() => { if (scale > 1) reset(); else setScale(hundred()); }}
      >
        <img
          src={convertFileSrc(path)}
          alt={`${item.label}, full size`}
          draggable={false}
          onLoad={(e) => { natural.current = { w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight }; }}
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
        />
        {items.length > 1 && <button className="lb-nav prev" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Previous view"><ChevronLeft size={26} /></button>}
        {items.length > 1 && <button className="lb-nav next" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Next view"><ChevronRight size={26} /></button>}
      </div>
      <div className="lb-bottom">
        <div className="lb-strip">
          {items.map((it, i) => <button key={it.job.id} className={i === index ? "on" : ""} onClick={() => onIndex(i)} title={it.label}><img src={convertFileSrc(it.job.outputPath!)} alt={it.label} loading="lazy" /></button>)}
        </div>
        <div className="lb-info">
          {job.qaNotes.map((n) => <small key={n} className="qa-note">{n}</small>)}
          <small>{job.provider} · {job.model}</small>
        </div>
        {job.status === "needs-review" && (
          <div className="lb-actions">
            <button className="primary" onClick={() => onApprove(job)}><Check size={15} /> Approve <kbd>A</kbd></button>
            <button className="secondary" onClick={() => onReject(job)}>Reject <kbd>R</kbd></button>
          </div>
        )}
        {job.status === "completed" && (
          <div className="lb-actions">
            <span className="lb-state">{job.approved ? "Approved" : job.rejected ? "Rejected" : "Completed"}</span>
            {canApprove(job) && <button className="primary" onClick={() => onApprove(job)}><Check size={15} /> Approve <kbd>A</kbd></button>}
            {canReject(job) && <button className="secondary" onClick={() => onReject(job)}>Reject <kbd>R</kbd></button>}
            {canUndo(job) && onReconsider && <button className="tertiary" onClick={() => onReconsider(job)}>{job.approved ? "Take back approval" : "Not decided"} <kbd>U</kbd></button>}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
