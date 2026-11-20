import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { helpChapters, helpImages, searchHelp } from './helpContent'
import pkg from '../../package.json'

describe('the in-app guide', () => {
  it('has the chapters a new user needs, in a sensible order', () => {
    const ids = helpChapters.map((c) => c.id)
    for (const id of ['welcome', 'setup', 'start', 'style', 'design', 'shape', 'direct', 'review', 'looks', 'assistant', 'deliver', 'windows', 'trouble', 'glossary']) expect(ids).toContain(id)
    expect(ids.indexOf('welcome')).toBe(0)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('every chapter says something, every step is a sentence, and block titles are unique within a chapter', () => {
    for (const c of helpChapters) {
      expect(c.title.length).toBeGreaterThan(5)
      expect(c.summary.length).toBeGreaterThan(10)
      expect(c.blocks.length).toBeGreaterThan(0)
      expect(new Set(c.blocks.map((b) => b.title)).size).toBe(c.blocks.length)
      for (const b of c.blocks) {
        expect(b.text.join(' ').length).toBeGreaterThan(40)
        for (const s of b.steps ?? []) expect(s.length).toBeGreaterThan(8)
      }
    }
  })
  it('every screenshot the guide points to exists and is a real picture from the app', () => {
    expect(helpImages.length).toBeGreaterThanOrEqual(12)
    for (const f of helpImages) {
      expect(existsSync(`public/${f}`), f).toBe(true)
      const bytes = readFileSync(`public/${f}`)
      expect(bytes.length, f).toBeGreaterThan(15000)
      expect(bytes.subarray(0, 4).toString('latin1'), f).toBe('RIFF')
    }
    for (const c of helpChapters) for (const b of c.blocks) if (b.image) expect(b.image.caption.length).toBeGreaterThan(10)
  })
  it('teaches the tour, the quick start and the cost estimates', () => {
    const all = JSON.stringify(helpChapters)
    expect(all).toMatch(/Take the 1-minute tour/)
    expect(all).toMatch(/Make my first picture/)
    expect(all).toMatch(/nothing is made or charged until you press the button/i)
    expect(all).toMatch(/typical price/)
    expect(helpImages).toContain('help/15-quickstart.webp')
  })
  it('names the real screens and the real labels', () => {
    const all = JSON.stringify(helpChapters)
    for (const label of ['Analyze script', 'Add to the bible', 'Test one first', 'Turn on the Director', 'Plan the coverage', 'Approve', 'Lock style', 'Use this style', 'Provider Settings', 'Looks and grade', 'Blocking map', 'Visual review', 'Start']) expect(all, label).toContain(label)
  })
  it('says honestly what the Assistant needs for a storyboard', () => {
    const text = JSON.stringify(helpChapters.find((c) => c.id === 'assistant')!)
    expect(text).toMatch(/one line per beat/i)
    expect(text).toMatch(/storyboard is planned from scenes/i)
    expect(text).toMatch(/matched|attached to that character/i)
    expect(text).toMatch(/price per picture/)
  })
  it('search finds chapters by any word in them, needs every word, and an empty search lists all', () => {
    expect(searchHelp('')).toHaveLength(helpChapters.length)
    expect(searchHelp('blocking').map((c) => c.id)).toContain('direct')
    expect(searchHelp('credential manager').map((c) => c.id)).toContain('setup')
    expect(searchHelp('zzzz nothing')).toEqual([])
    expect(searchHelp('PROPORTIONS').map((c) => c.id)).toContain('shape')
  })
})

describe('the splash screen', () => {
  const html = readFileSync('public/splash.html', 'utf8')
  it('can be skipped and has Help, and no longer uses a serif display face', () => {
    expect(html).toMatch(/id="close"/)
    expect(html).toMatch(/aria-label="Skip the intro"/)
    expect(html).toMatch(/id="help"/)
    expect(html).toMatch(/splash_dismiss/)
    expect(html).toMatch(/splash_help/)
    expect(html).not.toMatch(/Georgia|Fraunces|Times/)
    expect(html).toMatch(/font-family:"Geist"/)
    expect(html).toMatch(/Escape/)
  })
  it('uses the bundled font file and shows the version of this build', () => {
    expect(existsSync('public/fonts/geist-latin.woff2')).toBe(true)
    expect(html).toContain('/fonts/geist-latin.woff2')
    expect(html).toContain(`<b>${pkg.version}</b>`)
  })
})
