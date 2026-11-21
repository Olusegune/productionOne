import { fingerprint, schematic, type ProportionProfile, type SchematicShape } from './proportions'

/**
 * A proportion guide: a plain grey figure on white with a ruler in head units, drawn from the target proportions. It is sent to the image model as a second reference so
 * the model has something to MATCH (words alone lose to a reference picture that shows a different body). It is not a picture of the character: the prompt says to take
 * only the proportions from it. The drawing is deterministic: the same proportions give the same image.
 */
export const GUIDE_WIDTH = 512

export const guideName = (p: ProportionProfile): string => `guide_${fingerprint(p)}.png`

const f = (n: number) => Math.round(n * 100) / 100

export function guideSvg(p: ProportionProfile): string {
  const art = schematic(p)
  const find = (id: string): SchematicShape => art.shapes.find((s) => s.id === id) as SchematicShape
  const head = find('head'), torso = find('torso'), hips = find('hips'), neck = find('neck'), floor = find('floor')
  const pad = 14
  const top = head.y - pad
  const viewH = floor.y + pad - top
  const cx = head.x + (head.w ?? 0) / 2
  const grey = '#8b9099', mid = '#7a7f88'
  const parts: string[] = []
  // the ruler: one line per head height, numbered from the crown
  const unit = head.h ?? 36
  const marks = Math.floor((floor.y - head.y) / unit + 0.001)
  for (let i = 0; i <= marks; i++) {
    const y = head.y + i * unit
    parts.push(`<line x1="8" x2="${f(art.width - 8)}" y1="${f(y)}" y2="${f(y)}" stroke="#c7ccd4" stroke-width="0.6"/><text x="10" y="${f(y - 2)}" font-family="Arial, sans-serif" font-size="8" fill="#6b7078">${i}</text>`)
  }
  parts.push(`<line x1="8" x2="${f(art.width - 8)}" y1="${f(floor.y)}" y2="${f(floor.y)}" stroke="#9aa0a8" stroke-width="0.9"/>`)
  const limb = (a: SchematicShape, w: number) => `<line x1="${f(a.x)}" y1="${f(a.y)}" x2="${f(a.x2 ?? a.x)}" y2="${f(a.y2 ?? a.y)}" stroke="${grey}" stroke-width="${w}" stroke-linecap="round"/>`
  for (const k of ['l', 'r']) {
    parts.push(limb(find(`arm-${k}-upper`), 9), limb(find(`arm-${k}-fore`), 7.5), limb(find(`hand-${k}`), find(`hand-${k}`).weight ?? 6))
    parts.push(limb(find(`leg-${k}-upper`), 13), limb(find(`leg-${k}-lower`), 10), limb(find(`foot-${k}`), 6))
  }
  parts.push(`<rect x="${f(neck.x)}" y="${f(neck.y - 1)}" width="${f(neck.w ?? 0)}" height="${f((neck.h ?? 0) + 2)}" rx="3" fill="${mid}"/>`)
  parts.push(`<rect x="${f(torso.x)}" y="${f(torso.y)}" width="${f(torso.w ?? 0)}" height="${f(torso.h ?? 0)}" rx="${f(torso.corner ?? 14)}" fill="${grey}"/>`)
  parts.push(`<rect x="${f(hips.x)}" y="${f(hips.y)}" width="${f(hips.w ?? 0)}" height="${f(hips.h ?? 0)}" rx="${f(hips.corner ?? 8)}" fill="${mid}"/>`)
  parts.push(`<ellipse cx="${f(cx)}" cy="${f(head.y + (head.h ?? 0) / 2)}" rx="${f((head.w ?? 0) / 2)}" ry="${f((head.h ?? 0) / 2)}" fill="${grey}"/>`)
  const width = art.width
  const scale = GUIDE_WIDTH / width
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${GUIDE_WIDTH}" height="${Math.round(viewH * scale)}" viewBox="0 ${f(top)} ${width} ${f(viewH)}"><rect x="0" y="${f(top)}" width="${width}" height="${f(viewH)}" fill="#ffffff"/>${parts.join('')}</svg>`
}

/** What the prompt says about the guide. Used only when the guide is attached. */
export const guideLine = 'The last attached image is a plain PROPORTION GUIDE: a grey figure on white with a ruler in head units. Match its proportions exactly: the figure\'s height in head units, leg length, arm length, shoulder width and hand size. Ignore its colour, shading and style; it is not a picture of the character and nothing from it is copied except the proportions.'
