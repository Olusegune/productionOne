import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react'
import { RealImage } from './RealImage'
import '../compare.css'

export const MIN_ZOOM = 1
export const MAX_ZOOM = 6
export const ZOOM_STEP = 0.5
/** How far "Top crop" zooms in. The picture opens scrolled to its top centre, which is where a figure's head is. */
export const CROP_ZOOM = 2.5

export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z * 100) / 100))

/** How far along its scrollable range a pane is, from 0 to 1 (0 when it cannot scroll). */
export const scrollRatio = (pos: number, scrollSize: number, viewSize: number): number => (scrollSize > viewSize ? Math.min(1, Math.max(0, pos / (scrollSize - viewSize))) : 0)

export type ZoomView = 'full' | 'crop'

/**
 * Two panes that zoom and scroll together ("Sync zoom") or on their own. Nothing here changes a picture or a file: it only decides how much of each is shown.
 * `resetKey` is the picture being looked at; a different picture starts again from the chosen view.
 */
export function useZoomSync(resetKey: string) {
  const [sync, setSync] = useState(true)
  const [view, setViewState] = useState<ZoomView>('full')
  const [zoom, setZoom] = useState<[number, number]>([MIN_ZOOM, MIN_ZOOM])
  const panes = useRef<Array<HTMLDivElement | null>>([null, null])
  const lock = useRef(false)

  const setView = (v: ZoomView) => { setViewState(v); const z = v === 'crop' ? CROP_ZOOM : MIN_ZOOM; setZoom([z, z]) }
  // A different picture starts from the chosen view again.
  const first = useRef(true)
  useLayoutEffect(() => { if (first.current) { first.current = false; return } const z = view === 'crop' ? CROP_ZOOM : MIN_ZOOM; setZoom([z, z]) }, [resetKey]) // eslint-disable-line react-hooks/exhaustive-deps
  // Opening a crop, or a new picture, shows the top centre.
  useLayoutEffect(() => {
    for (const el of panes.current) { if (!el) continue; el.scrollTop = 0; el.scrollLeft = view === 'crop' ? Math.max(0, (el.scrollWidth - el.clientWidth) / 2) : 0 }
  }, [view, resetKey, zoom[0], zoom[1]]) // eslint-disable-line react-hooks/exhaustive-deps

  const zoomBoth = (delta: number) => setZoom(([a, b]) => [clampZoom(a + delta), clampZoom(b + delta)])
  const zoomOne = (index: 0 | 1, delta: number) => setZoom(([a, b]) => {
    if (sync) return [clampZoom(a + delta), clampZoom(a + delta)]
    return index === 0 ? [clampZoom(a + delta), b] : [a, clampZoom(b + delta)]
  })
  const fit = () => { setViewState('full'); setZoom([MIN_ZOOM, MIN_ZOOM]) }
  const onScroll = useCallback((index: 0 | 1) => {
    if (!sync || lock.current) return
    const a = panes.current[index], b = panes.current[index === 0 ? 1 : 0]
    if (!a || !b) return
    lock.current = true
    b.scrollLeft = scrollRatio(a.scrollLeft, a.scrollWidth, a.clientWidth) * Math.max(0, b.scrollWidth - b.clientWidth)
    b.scrollTop = scrollRatio(a.scrollTop, a.scrollHeight, a.clientHeight) * Math.max(0, b.scrollHeight - b.clientHeight)
    requestAnimationFrame(() => { lock.current = false })
  }, [sync])
  return { sync, setSync, view, setView, zoom, zoomBoth, zoomOne, fit, onScroll, panes }
}

export type ZoomState = ReturnType<typeof useZoomSync>

export function ZoomToolbar({ z }: { z: ZoomState }) {
  const level = Math.round(z.zoom[0] * 100)
  return (
    <div className="rv-zoombar" role="toolbar" aria-label="Zoom">
      <div className="rv-seg" role="group" aria-label="What to show">
        <button type="button" className={z.view === 'full' ? 'on' : ''} aria-pressed={z.view === 'full'} onClick={() => z.setView('full')}>Full image</button>
        <button type="button" className={z.view === 'crop' ? 'on' : ''} aria-pressed={z.view === 'crop'} onClick={() => z.setView('crop')} title="Zooms in on the top of the picture, where a figure's face is">Top crop</button>
      </div>
      <label className="rv-sync"><input type="checkbox" checked={z.sync} onChange={(e) => z.setSync(e.target.checked)} /> Sync zoom</label>
      <div className="rv-zoomctl">
        <button type="button" className="icon-button" onClick={() => z.zoomBoth(-ZOOM_STEP)} disabled={z.zoom[0] <= MIN_ZOOM && z.zoom[1] <= MIN_ZOOM} aria-label="Zoom out"><ZoomOut size={16} aria-hidden="true" /></button>
        <output className="rv-zoomlevel" aria-label="Zoom level">{z.sync ? `${level}%` : `${Math.round(z.zoom[0] * 100)}% · ${Math.round(z.zoom[1] * 100)}%`}</output>
        <button type="button" className="icon-button" onClick={() => z.zoomBoth(ZOOM_STEP)} disabled={z.zoom[0] >= MAX_ZOOM && z.zoom[1] >= MAX_ZOOM} aria-label="Zoom in"><ZoomIn size={16} aria-hidden="true" /></button>
        <button type="button" className="icon-button" onClick={z.fit} aria-label="Fit the whole picture" title="Fit the whole picture"><Maximize2 size={16} aria-hidden="true" /></button>
      </div>
    </div>
  )
}

/** One picture inside a zoom pane. Ctrl and the mouse wheel zoom it (both panes when synced); scrolling moves around it. */
export function ZoomImage({ z, index, path, label, empty }: { z: ZoomState; index: 0 | 1; path?: string; label: string; empty: string }) {
  const level = z.zoom[index]
  return (
    <div
      className={`rv-image rv-zoom${level > 1 ? ' zoomed' : ''}`}
      ref={(el) => { z.panes.current[index] = el }}
      onScroll={() => z.onScroll(index)}
      onWheel={(e) => { if (e.ctrlKey) { e.preventDefault(); z.zoomOne(index, e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP) } }}
      data-zoom={level}
    >
      <div className="rv-zoom-inner" style={{ width: `${level * 100}%` }}><RealImage path={path} label={label} empty={empty} /></div>
    </div>
  )
}
