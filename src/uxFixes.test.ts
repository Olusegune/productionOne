import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (p: string) => readFileSync(p, 'utf8')

describe('UX fixes found in the 0.55 QA pass', () => {
  it('the Design screen drops its empty right column when the rail is hidden (1280 px and below)', () => {
    const css = read('src/refine.css')
    expect(css).toMatch(/@media \(max-width: 1280px\)[\s\S]*\.po-shell \.po-design \{ grid-template-columns: minmax\(220px, 26vw\) minmax\(0, 1fr\); \}/)
    expect(css).toMatch(/\.po-shell \.po-design > \.po-inspector \{ display: none; \}/)
  })
  it('the style bar gives the style picker a full row so it no longer shrinks to an ellipsis', () => {
    const css = read('src/refine.css')
    expect(css).toMatch(/\.ad-compact \.ad-name \{ flex: 1 1 100%; \}/)
    expect(css).toMatch(/\.ad-compact \.style-browser-trigger \{ width: 100%/)
  })
  it('the animatic play button has a name, and the Director header and shot chips read properly', () => {
    expect(read('src/views/DirectView.tsx')).toMatch(/aria-label=\{animaticPlaying \? "Pause the animatic" : "Play the animatic"\}/)
    const room = read('src/components/DirectRoom.tsx')
    expect(room).toMatch(/shots\.length === 1 \? "shot" : "shots"/)
    expect(room).toMatch(/frameCount === 1 \? "a frame" : "frames"/)
    expect(room).toMatch(/\{s\.size \?\? "MS"\} · \{s\.lens \?\? 40\}mm/)
  })
  it('a new screen starts at its top, including after a screen that focuses a field as it opens', () => {
    const app = read('src/App.tsx')
    expect(app).toMatch(/A new screen starts at its top/)
    expect(app).toMatch(/window\.setTimeout\(top, 120\)/)
  })
})
