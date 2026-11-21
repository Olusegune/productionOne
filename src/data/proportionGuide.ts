import { guideName, guideSvg } from '../domain/proportionGuide'
import type { ProportionProfile } from '../domain/proportions'

const cache = new Map<string, string>()

/** Draws the proportion guide for a profile as a PNG, in the page. */
export async function renderGuidePng(profile: ProportionProfile): Promise<string> {
  const svg = guideSvg(profile)
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  const img = new Image()
  img.decoding = 'async'
  await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('The guide could not be drawn')); img.src = url })
  const width = img.naturalWidth || 512, height = img.naturalHeight || 768
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('The guide could not be drawn')
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)
  return canvas.toDataURL('image/png')
}

/**
 * The path of the proportion guide for this profile in the app's pictures folder, drawn and saved the first time and reused after. Returns null when it cannot be made
 * (not the desktop app, or a drawing problem): the picture request then goes ahead with the words alone.
 */
export async function ensureGuide(profile: ProportionProfile | undefined): Promise<string | null> {
  if (!profile || typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return null
  const name = guideName(profile)
  const known = cache.get(name)
  if (known) return known
  try {
    const dataUrl = await renderGuidePng(profile)
    const { invoke } = await import('@tauri-apps/api/core')
    const path = await invoke<string>('save_guide_image', { name, dataUrl })
    cache.set(name, path)
    return path
  } catch { return null }
}
