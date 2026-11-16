/** "#1e4a52" to a plain colour word a prompt can use ("dark teal"). Only for wording: the exact hex is sent too. */
export function describeColour(hex: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim())
  if (!m) return ''
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => parseInt(x, 16) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  const depth = l < 0.18 ? 'very dark ' : l < 0.35 ? 'dark ' : l > 0.8 ? 'pale ' : l > 0.65 ? 'light ' : ''
  if (l > 0.92) return 'white'
  if (l < 0.06) return 'black'
  if (s < 0.12) return `${depth}${l < 0.35 ? 'charcoal grey' : 'grey'}`.trim()
  let h = 0
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
  }
  h = (h * 60 + 360) % 360
  const hue = h < 15 || h >= 345 ? 'red' : h < 40 ? 'orange' : h < 65 ? 'yellow' : h < 160 ? 'green' : h < 200 ? 'teal' : h < 255 ? 'blue' : h < 290 ? 'purple' : 'magenta'
  return `${depth}${hue}`.trim()
}
