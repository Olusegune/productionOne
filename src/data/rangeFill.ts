/**
 * Draws the filled part of every slider. A slider's fill is a CSS gradient that needs to know how far along the handle is, so this keeps a `--p` percentage on each
 * range input up to date (when you drag it, and when the app changes it). It only sets a style variable: it never changes a value.
 */
export function paintRange(el: HTMLInputElement): void {
  const min = Number(el.min || 0), max = Number(el.max || 100), v = Number(el.value)
  const p = max > min ? Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100)) : 0
  el.style.setProperty('--p', `${p}%`)
}

export function paintAllRanges(root: ParentNode = document): void {
  root.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach(paintRange)
}

export function startRangeFill(): () => void {
  if (typeof document === 'undefined') return () => {}
  let queued = false
  const schedule = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; paintAllRanges() }) }
  const onInput = (e: Event) => { const t = e.target; if (t instanceof HTMLInputElement && t.type === 'range') paintRange(t) }
  document.addEventListener('input', onInput, true)
  const mo = new MutationObserver(schedule)
  mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['value', 'min', 'max'] })
  schedule()
  return () => { document.removeEventListener('input', onInput, true); mo.disconnect() }
}
