import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseProjectFile } from '../data/projectFile'
import { DEMO_STYLE_NAMES, demo2DProject, demo2DRequests, demoAssets2D, styleByName } from './demo2d'
import { artifactGuidance } from './cleanGuidance'
import { addSupplied, anchorFor, approve, emptyQueue, enqueue } from './generationQueue'
import { analyzeScript } from './productionStudio'
import { buildViewPrompt, sheetTypesFor, viewsFor } from './sheetSpecs'
import { FAMILIES_2D, adaptViewFor2D, compile2D, existing2DSpecs, is2D, styleFingerprint, styles2D } from './style2d'
import { TWO_D, filterStyles } from './styleGallery'
import { buildShotPrompt, planCoverage } from './direct'
import { defaultStyleBible, stylePresets, styleGuidance } from './visualDevelopment'

const all2D = stylePresets.filter(is2D)
/** The presets that were generated with a real model and looked at (2026-11-19). */
const liveTested = ['2d-clean-digital-cel', '2d-watercolor-storybook', '2d-flat-vector', '2d-graphic-novel', '2d-pixel-low']
const originalNames = ['Restrained Cinematic Realism', 'Watercolor Storybook', 'Stylized 3D Feature', 'Graphic Novel Noir', 'Documentary Naturalism', 'Family 3D Feature', 'Hand-Painted Fantasy Anime', 'Cel-Shaded Action', 'Stop-Motion Handmade', 'Graphic Ink and Gouache', 'Retro Futurist', 'Techno Industrial', 'Mythic Epic', 'Neon Graphic Future', 'Dark Fairy Tale', 'Architectural Visualization', 'Photographic Editorial']

const words = (s: string) => new Set(s.toLowerCase().match(/[a-z]{4,}/g) ?? [])
const similarity = (a: string, b: string) => { const x = words(a); const y = words(b); let both = 0; x.forEach((w) => { if (y.has(w)) both += 1 }); return both / Math.max(1, x.size + y.size - both) }

describe('the existing styles are untouched', () => {
  it('keeps every original preset, by name, in the same order, with its own text', () => {
    expect(stylePresets.slice(0, originalNames.length).map((s) => s.name)).toEqual(originalNames)
    const watercolor = stylePresets.find((s) => s.name === 'Watercolor Storybook')!
    expect(watercolor.description).toMatch(/Hand-painted storybook shapes/)
    expect(watercolor.palette).toEqual(['#203447', '#d9b77b', '#91a9a3', '#efe1bd'])
    expect(stylePresets.find((s) => s.name === 'Stylized 3D Feature')!.spec2d).toBeUndefined()
    expect(stylePresets.find((s) => s.name === 'Stylized 3D Feature')!.family).toBeUndefined()
  })
  it('does not change the default style, or the words used for a style that is not 2D', () => {
    expect(defaultStyleBible.name).toBe('Restrained Cinematic Realism')
    expect(defaultStyleBible.spec2d).toBeUndefined()
    const expected = [defaultStyleBible.name, defaultStyleBible.description, defaultStyleBible.rendering, defaultStyleBible.materials, defaultStyleBible.lighting].join('. ')
    expect(styleGuidance(defaultStyleBible)).toBe(expected)
    expect(styleGuidance(defaultStyleBible, 'scene')).toBe(expected)
  })
  it('has no duplicate preset names, because a preset is identified by its name', () => {
    const names = stylePresets.map((s) => s.name)
    expect(new Set(names).size).toBe(names.length)
  })
  it('adds a 2D spec to five existing presets and nothing else about them', () => {
    expect(Object.keys(existing2DSpecs).sort()).toEqual(['Cel-Shaded Action', 'Graphic Ink and Gouache', 'Graphic Novel Noir', 'Hand-Painted Fantasy Anime', 'Watercolor Storybook'])
    for (const name of Object.keys(existing2DSpecs)) expect(stylePresets.find((s) => s.name === name)!.spec2d?.id).toBe(existing2DSpecs[name].id)
  })
})

describe('the 2D library', () => {
  it('covers every family that was asked for', () => {
    const count = (family: string) => all2D.filter((s) => s.spec2d!.family2d === family).length
    expect(count(FAMILIES_2D.drawn)).toBe(8)
    expect(count(FAMILIES_2D.anime)).toBeGreaterThanOrEqual(5)
    expect(count(FAMILIES_2D.paint)).toBeGreaterThanOrEqual(8)
    expect(count(FAMILIES_2D.graphic)).toBe(8)
    expect(count(FAMILIES_2D.ink)).toBeGreaterThanOrEqual(6)
    expect(count(FAMILIES_2D.pixel)).toBe(2)
    expect(all2D.length).toBeGreaterThanOrEqual(38)
  })
  it('gives each preset a stable id, a version, a name and a short description', () => {
    const ids = all2D.map((s) => s.spec2d!.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const s of all2D) {
      expect(s.spec2d!.id).toMatch(/^2d-[a-z0-9-]+$/)
      expect(s.spec2d!.version).toBe(1)
      expect(s.description.length).toBeGreaterThan(30)
      expect(s.description.length).toBeLessThan(200)
      expect(s.palette).toHaveLength(4)
    }
  })
  it('keeps the look, the animation approach and the output format apart', () => {
    for (const s of all2D) {
      const spec = s.spec2d!
      expect(spec.output).toMatch(/not vector artwork/i)
      expect(spec.output).toMatch(/not an animation file/i)
      expect(spec.animation.length).toBeGreaterThan(8)
      expect(spec.visualStatus).toBe(liveTested.includes(spec.id) ? 'live-tested' : 'unverified')
      if (spec.visualStatus === 'live-tested') expect(spec.liveNote).toMatch(/One test only/)
      else expect(spec.liveNote).toBeUndefined()
      expect(spec.preview.provenance).toMatch(/not an example image/i)
      expect(spec.avoid.length).toBeGreaterThanOrEqual(3)
    }
  })
  it('compiles meaningfully different instructions for every preset, not the same text under another name', () => {
    const compiled = all2D.map((s) => ({ name: s.name, text: compile2D(s, 'technical') }))
    expect(new Set(compiled.map((c) => c.text)).size).toBe(compiled.length)
    let worst = { a: '', b: '', score: 0 }
    for (let i = 0; i < compiled.length; i++) for (let j = i + 1; j < compiled.length; j++) {
      const score = similarity(compiled[i].text, compiled[j].text)
      if (score > worst.score) worst = { a: compiled[i].name, b: compiled[j].name, score }
    }
    expect(worst.score, `${worst.a} and ${worst.b} are too alike`).toBeLessThan(0.7)
    for (const s of all2D) {
      const sp = s.spec2d!
      for (const field of [sp.line, sp.shape, sp.shading]) expect(field.length).toBeGreaterThan(15)
      expect(sp.texture.length).toBeGreaterThan(3)
    }
    const lines = all2D.map((s) => s.spec2d!.line)
    expect(new Set(lines).size).toBe(lines.length)
    const shading = all2D.map((s) => s.spec2d!.shading)
    expect(new Set(shading).size).toBe(shading.length)
  })
  it('treats technical sheets and scenes differently', () => {
    for (const s of all2D) {
      expect(compile2D(s, 'technical')).not.toBe(compile2D(s, 'scene'))
      expect(compile2D(s, 'technical')).toMatch(/no scenery|no cast shadow|plain flat field/i)
    }
  })
  it('says what each style is not, in terms that fit that style', () => {
    const pixel = compile2D(styleByName('Low-resolution pixel art'))
    expect(pixel).toMatch(/pixel/i)
    expect(pixel).toMatch(/anti-aliased|mixed pixel sizes/)
    const vector = compile2D(styleByName('Flat vector'))
    expect(vector).toMatch(/gradients/)
    expect(vector).not.toMatch(/pigment|brush marks/)
    const water = compile2D(styleByName('Watercolor Storybook'))
    expect(water).toMatch(/pigment|granulation/)
    expect(water).toMatch(/opaque flat vector fills/)
  })
})

describe('finding styles', () => {
  const filter = (query: string, family = 'All') => filterStyles(stylePresets, { query, family, onlyFavorites: false, favorites: new Set() })
  it('has a 2D chip that shows exactly the 2D styles', () => {
    expect(filter('', TWO_D).map((s) => s.name).sort()).toEqual(all2D.map((s) => s.name).sort())
    expect(filter('', TWO_D).every(is2D)).toBe(true)
  })
  it('finds styles by name, by family and by what they look like', () => {
    expect(filter('pixel', TWO_D).map((s) => s.name)).toEqual(expect.arrayContaining(['Low-resolution pixel art', 'Detailed pixel art']))
    expect(filter('watercolor', TWO_D).map((s) => s.name)).toEqual(expect.arrayContaining(['Watercolor Storybook', 'Ink and watercolor']))
    expect(filter('comics and ink').length).toBeGreaterThanOrEqual(5)
    expect(filter('noir').map((s) => s.name)).toContain('Graphic Novel Noir')
    expect(filter('cel', TWO_D).map((s) => s.name)).toContain('Clean digital cel animation')
    expect(filter('halftone').map((s) => s.name)).toContain('Halftone / vintage print')
  })
  it('keeps the other styles findable', () => {
    expect(filter('stop-motion').map((s) => s.name)).toContain('Stop-Motion Handmade')
    expect(filter('', 'Stylized 3D').length).toBeGreaterThan(5)
  })
})

describe('a 2D style reaches the request and keeps photographic and 3D defaults out', () => {
  const photoWords = [/natural skin with visible fine texture/i, /pores, not smoothed/i, /5500K/i, /beauty-filter/i, /neutral white balance/i, /photographic frame/i, /subsurface/i, /physically based/i]
  const requests = (name: string) => demo2DRequests(styleByName(name))
  it('puts the compiled style into every view of every asset type', () => {
    for (const name of DEMO_STYLE_NAMES) {
      const style = styleByName(name)
      const list = requests(name)
      expect(list.length).toBeGreaterThanOrEqual(20)
      for (const r of list) {
        expect(r.prompt, `${name} / ${r.assetName} / ${r.label}`).toContain(`2D art style "${name}"`)
        expect(r.prompt).toContain('Avoid:')
        expect(r.prompt).toContain('not a 3D render and not a photograph')
        for (const bad of photoWords) expect(r.prompt, `${name} ${r.label} must not contain ${bad}`).not.toMatch(bad)
        expect(r.prompt).toContain(style.spec2d!.avoid[0])
      }
    }
  })
  it('uses the technical wording for characters and props and the scene wording for places', () => {
    const list = requests('Clean digital cel animation')
    const technical = styleByName('Clean digital cel animation').spec2d!.technical
    const scene = styleByName('Clean digital cel animation').spec2d!.scene
    for (const r of list) {
      if (r.assetName === 'Harbour office') { expect(r.prompt).toContain(scene); expect(r.prompt).not.toContain(technical) }
      else { expect(r.prompt).toContain(technical); expect(r.prompt).not.toContain(scene) }
    }
  })
  it('covers the character turnaround, expressions, poses and costume, the prop and the place', () => {
    const list = requests('Flat vector')
    const sheets = new Set(list.map((r) => `${r.assetName}:${r.sheetType}`))
    for (const s of ['Mira:Turnaround', 'Mira:Expressions', 'Mira:Poses', 'Mira:Wardrobe', 'Brass lantern:Multi-view', 'Harbour office:Establishing', 'Harbour office:Layout']) expect(sheets.has(s), s).toBe(true)
    expect(list.filter((r) => r.sheetType === 'Turnaround').map((r) => r.viewKey)).toEqual(['front', 'three-quarter-front', 'side', 'three-quarter-rear', 'rear'])
  })
  it('redraws each view instead of mirroring one, and treats photos as identity only', () => {
    const style = styleByName('Graphic novel')
    const view = viewsFor('character', 'Turnaround').find((v) => v.key === 'rear')!
    const p = buildViewPrompt({ style, asset: demoAssets2D()[0], variant: 'Canonical', sheetType: 'Turnaround', view, anchored: true, photoRefs: true })
    expect(p).toMatch(/redraw it, do not mirror or flip another view/)
    expect(p).toMatch(/IDENTITY references only/)
    expect(p).not.toMatch(/same skin tone/)
  })
  it('offers a deliberate reinterpretation that says identity may not carry over exactly', () => {
    const style = styleByName('Watercolor Storybook')
    const view = viewsFor('character', 'Turnaround')[0]
    const p = buildViewPrompt({ style, asset: demoAssets2D()[0], variant: 'Canonical', sheetType: 'Turnaround', view, reinterpret: true })
    expect(p).toMatch(/new design revision/)
    expect(p).toMatch(/Identity may not carry over exactly/)
    const plain = buildViewPrompt({ style, asset: demoAssets2D()[0], variant: 'Canonical', sheetType: 'Turnaround', view })
    expect(plain).not.toMatch(/new design revision/)
  })
  it('rewrites phrases that suit a photograph or a 3D render, only for a 2D style', () => {
    expect(adaptViewFor2D('Large face close-up, skin texture visible, believable anatomy, macro close-up')).toBe('Large face close-up, skin drawn in this style, clear, well-constructed anatomy, large close-up')
    const detail = viewsFor('character', 'Detail').find((v) => v.key === 'face')!
    const asset = demoAssets2D()[0]
    expect(buildViewPrompt({ style: styleByName('Flat vector'), asset, variant: 'Canonical', sheetType: 'Detail', view: detail })).not.toMatch(/skin texture visible/)
    expect(buildViewPrompt({ style: defaultStyleBible, asset, variant: 'Canonical', sheetType: 'Detail', view: detail })).toMatch(/skin texture visible/)
  })
  it('keeps a non-2D style on the same prompt path as before', () => {
    const view = viewsFor('character', 'Turnaround')[0]
    const p = buildViewPrompt({ style: defaultStyleBible, asset: demoAssets2D()[0], variant: 'Canonical', sheetType: 'Turnaround', view })
    expect(p).toContain(`Visual style bible: ${styleGuidance(defaultStyleBible)}.`)
    expect(p).toMatch(/Natural skin with visible fine texture and pores/)
    expect(p).not.toMatch(/2D art style/)
  })
  it('puts the compiled request into the job and remembers which style it was made in', () => {
    const style = styleByName('Gouache illustration')
    const r = demo2DRequests(style)[0]
    const { state } = enqueue(emptyQueue(), [{ assetId: r.assetId, variant: 'Canonical', sheetType: r.sheetType, viewKey: r.viewKey, label: r.label, prompt: r.prompt, aspect: '3:4', fullBody: true, provider: 'google', model: 'm', references: [], styleName: style.name, styleFp: styleFingerprint(style), outputName: (n) => `x_v${n}` }])
    expect(state.jobs[0].prompt).toContain('2D art style "Gouache illustration"')
    expect(state.jobs[0].styleName).toBe('Gouache illustration')
    expect(state.jobs[0].styleFp).toBe(styleFingerprint(style))
  })
  it('notices a changed style and leaves approvals alone', () => {
    const style = styleByName('Flat vector')
    const before = styleFingerprint(style)
    expect(styleFingerprint(style)).toBe(before)
    expect(styleFingerprint({ ...style, lineTreatment: 'A thick brush line' })).not.toBe(before)
    expect(styleFingerprint({ ...style, description: 'Something else' })).not.toBe(before)
    expect(styleFingerprint(styleByName('Bold geometric'))).not.toBe(before)
    const r = demo2DRequests(style)[0]
    let q = enqueue(emptyQueue(), [{ assetId: r.assetId, variant: 'Canonical', sheetType: r.sheetType, viewKey: r.viewKey, label: r.label, prompt: r.prompt, aspect: '3:4', fullBody: true, provider: 'google', model: 'm', references: [], styleFp: before, outputName: (n) => `x_v${n}` }]).state
    q = { ...q, jobs: q.jobs.map((j) => ({ ...j, status: 'needs-review' as const, outputPath: 'C:/a.png' })) }
    q = approve(q, q.jobs[0].id)
    expect(q.jobs[0].approved).toBe(true)
    expect(q.jobs[0].styleFp).toBe(before)
  })
})

describe('quality settings and style-aware texture', () => {
  it('keeps intentional texture and never adds a warm or neutral cast to a 2D style', () => {
    for (const s of all2D) {
      const g = artifactGuidance(s, 'gpt-image-1')
      if (s.spec2d!.intentionalTexture) { expect(g, s.name).toMatch(/own paper grain, brush, pencil or print texture/); expect(g).not.toMatch(/without visible noise/) } else expect(g, s.name).toMatch(/clean and even/)
      expect(g).not.toMatch(/yellow|sepia|golden|white balance|pores and|waxy/i)
    }
  })
  it('still guides a photographic style the way it always did', () => {
    expect(artifactGuidance(defaultStyleBible, 'gpt-image-1')).toMatch(/Natural skin with visible fine texture and pores/)
    expect(artifactGuidance(defaultStyleBible, 'gpt-image-1')).toMatch(/no yellow, sepia or golden tint/)
  })
})

describe('places stay the same place', () => {
  const style = styleByName('Watercolor Storybook')
  const set = demoAssets2D()[2]
  it('repeats the fixed layout in every view of the place and says not to move landmarks', () => {
    for (const sheet of ['Establishing', 'Layout'] as const) for (const view of viewsFor('set', sheet)) {
      const p = buildViewPrompt({ style, asset: set, variant: 'Canonical', sheetType: sheet, view, anchored: view.key === 'reverse' })
      expect(p).toContain('Fixed layout of this place, the same in every view')
      expect(p).toContain('The door is on the left wall')
      expect(p).toMatch(/do not move, add or remove these landmarks/)
    }
  })
  it('still says every view is the same place when no layout was written', () => {
    const p = buildViewPrompt({ style, asset: { ...set, layout: undefined }, variant: 'Canonical', sheetType: 'Establishing', view: viewsFor('set', 'Establishing')[0] })
    expect(p).toMatch(/Every view of this place shows the same architecture, layout, landmarks and prop positions/)
  })
  it('puts the layout into every storyboard shot set in that place, and uses a drawn layout instead of a lens', () => {
    const analysis = analyzeScript(['Title: T', '', 'INT. HARBOUR OFFICE - DAY', '', 'MIRA, a pilot, holds the brass lantern.', '', 'MIRA', 'We sail at dawn.'].join('\n'))
    const place = analysis.assets.find((a) => a.type === 'set')!
    const withLayout = { ...analysis, assets: analysis.assets.map((a) => (a.id === place.id ? { ...a, layout: 'Door on the left, desk in the centre' } : a)) }
    const shots = planCoverage(withLayout)
    const shot = shots.find((s) => s.assetIds.includes(place.id)) ?? shots[0]
    const style2d = styleByName('Clean digital cel animation')
    const p = buildShotPrompt({ ...shot, assetIds: [...new Set([...shot.assetIds, place.id])] }, withLayout, style2d, [])
    expect(p).toContain('Fixed layout of this place (the same in every shot set here): Door on the left, desk in the centre')
    expect(p).toContain('drawn layout, no photographic lens effects')
    expect(p).not.toMatch(/\d+mm lens/)
    expect(p).toContain('2D art style "Clean digital cel animation"')
    const photo = buildShotPrompt(shot, withLayout, defaultStyleBible, [])
    expect(photo).toMatch(/\d+mm lens/)
  })
})

describe('the approved reference is what later sheets are built from', () => {
  it('uses the newest approved revision as the anchor and ignores one that is not approved', () => {
    const base = { assetId: 'DEMO-CHAR-001', variant: 'Canonical', sheetType: 'Turnaround', viewKey: 'front', label: 'Front', aspect: '3:4', fullBody: true }
    let q = addSupplied(emptyQueue(), { ...base, path: 'C:/v1.png', width: 1, height: 1 }).state
    const job = q.jobs[0]
    expect(anchorFor(q, job)).toBe('C:/v1.png')
    q = { ...q, jobs: [...q.jobs, { ...job, id: 'rev2', revision: 2, approved: false, status: 'needs-review', outputPath: 'C:/v2-unapproved.png' }] }
    expect(anchorFor(q, job)).toBe('C:/v1.png')
    q = approve(q, 'rev2')
    expect(anchorFor(q, job)).toBe('C:/v2-unapproved.png')
  })
})

describe('saving, reopening and old projects', () => {
  it('keeps a 2D style, an asset override, a description and a layout through save and reopen', () => {
    const project = demo2DProject(styleByName('Clean digital cel animation'))
    const assets = project.studio.analysis.assets.map((a, i) => (i === 0 ? { ...a, style: { ...styleByName('Flat vector'), locked: false } } : a))
    const saved = { ...project, studio: { ...project.studio, analysis: { ...project.studio.analysis, assets } } }
    const reopened = parseProjectFile(JSON.stringify(saved))
    expect(reopened.ok).toBe(true)
    if (!reopened.ok) return
    const s = reopened.file.studio
    expect(s.styleBible?.spec2d?.id).toBe('2d-clean-digital-cel')
    expect(compile2D(s.styleBible!, 'technical')).toBe(compile2D(styleByName('Clean digital cel animation'), 'technical'))
    expect(s.analysis.assets[0].style?.name).toBe('Flat vector')
    expect(s.analysis.assets[0].style?.spec2d?.id).toBe('2d-flat-vector')
    expect(s.analysis.assets[0].description).toMatch(/weathered harbour pilot/)
    expect(s.analysis.assets[2].layout).toMatch(/door is on the left wall/)
    expect(s.format).toBe('16:9')
  })
  it('includes the whole 2D specification in the style JSON that is exported with a production bible', () => {
    const style = styleByName('Screen-print / limited-ink aesthetic')
    const exported = JSON.parse(JSON.stringify(style))
    expect(exported.spec2d.avoid.length).toBeGreaterThan(2)
    expect(exported.spec2d.output).toMatch(/raster/)
    expect(exported.spec2d.id).toBe('2d-screenprint')
  })
  it('opens a project saved before 2D styles existed with its style unchanged', () => {
    const legacyStyle = { name: 'Watercolor Storybook', description: 'Hand-painted storybook shapes, soft edges, visible pigment variation, and expressive simplified forms.', palette: ['#203447', '#d9b77b', '#91a9a3', '#efe1bd'], materials: 'Paper grain, watercolor wash, dry-brush edges', rendering: 'Hand-painted 2D watercolor', lighting: 'Soft diffused daylight', locked: true, revision: 3 }
    const text = JSON.stringify({ format: 'production-one-project', version: 1, title: 'Old', savedAt: '2026-01-01T00:00:00.000Z', graph: { schemaVersion: 1, nodes: [], edges: [] }, studio: { script: '', analysis: { scenes: [], assets: [{ id: 'A', name: 'Amina', type: 'character', sceneIds: [], status: 'planned' }] }, shots: [], jobs: [], storyboardsEnabled: false, model: 'Seedance 2.0', styleBible: legacyStyle } })
    const parsed = parseProjectFile(text)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const style = parsed.file.studio.styleBible!
    expect(style).toEqual(legacyStyle)
    expect(style.spec2d).toBeUndefined()
    expect(styleGuidance(style)).toBe([style.name, style.description, style.rendering, style.materials, style.lighting].join('. '))
    expect(parsed.file.studio.analysis.assets[0].style).toBeUndefined()
  })
  it('stores no machine-specific paths in a 2D style, and no keys', () => {
    for (const s of all2D) {
      const json = JSON.stringify(s)
      expect(json).not.toMatch(/[A-Za-z]:[\\/]|\/Users\/|\/home\/|file:\/\/|https?:\/\//)
      expect(json).not.toMatch(/api[_-]?key|secret|password/i)
    }
  })
})

describe('the demonstration project', () => {
  it('is deterministic: the same style gives the same project and the same prompts every time', () => {
    for (const name of DEMO_STYLE_NAMES) {
      expect(JSON.stringify(demo2DProject(styleByName(name)))).toBe(JSON.stringify(demo2DProject(styleByName(name))))
      expect(demo2DRequests(styleByName(name))).toEqual(demo2DRequests(styleByName(name)))
    }
  })
  it('makes different prompts for each of the five styles for the same views', () => {
    const lists = DEMO_STYLE_NAMES.map((n) => demo2DRequests(styleByName(n)))
    expect(new Set(lists.map((l) => l.length)).size).toBe(1)
    for (let i = 0; i < lists[0].length; i++) expect(new Set(lists.map((l) => l[i].prompt)).size).toBe(DEMO_STYLE_NAMES.length)
  })
  it('asks for the character, prop and place in the order of the real workflow', () => {
    const assets = demoAssets2D()
    expect(assets.map((a) => a.type)).toEqual(['character', 'prop', 'set'])
    expect(sheetTypesFor('set')).toContain('Layout')
  })

  // Run once with WRITE_2D_DEMO=1 to (re)write the saved demonstration projects and the prompt listing. Skipped otherwise.
  it.runIf(process.env.WRITE_2D_DEMO === '1')('writes the demonstration projects and the prompt listing', () => {
    const dir = resolve(process.cwd(), 'samples/2d-style-demo')
    mkdirSync(dir, { recursive: true })
    const lines = ['# 2D style demonstration: compiled prompts', '', 'Made by `src/domain/demo2d.ts`. These are the requests Production One would send, for one character (Mira), one prop (Brass lantern) and one place (Harbour office), in five representative 2D styles. **They are prompts only: nothing was generated and no image model was called.** They show that each style reaches the request; they do not show how any model draws it.', '']
    for (const name of DEMO_STYLE_NAMES) {
      const style = styleByName(name)
      writeFileSync(resolve(dir, `${style.spec2d!.id}.pone`), JSON.stringify(demo2DProject(style), null, 2))
      lines.push(`## ${name}`, '', `Project file: \`samples/2d-style-demo/${style.spec2d!.id}.pone\``, '')
      const first = demo2DRequests(style)
      const seen = new Set<string>()
      for (const r of first.filter((x) => { const k = `${x.assetName}:${x.sheetType}`; if (seen.has(k)) return false; seen.add(k); return true })) {
        lines.push(`### ${r.assetName}: ${r.sheetType}, ${r.label}`, '', '```text', r.prompt, '```', '')
      }
    }
    const cat = ['# 2D style catalog', '', `${all2D.length} presets in ${Object.keys(FAMILIES_2D).length} families. Written by \`src/domain/style2d.test.ts\` from \`src/domain/style2d.ts\` (the data is the source of truth; run the test with WRITE_2D_DEMO=1 to refresh this file).`, '', 'Every preset describes **how a picture looks**. The animation approach it suits is listed separately, and what Production One actually makes is always **one flat 2D raster reference picture per view**: not vector artwork, not a layered file, not a rigged puppet, not an animation file, not frame-by-frame animation. Visual quality is **unverified** for every preset except five that were live-tested once (Clean digital cel animation, Watercolor Storybook, Flat vector, Graphic novel, Low-resolution pixel art: see `docs/2D_LIVE_TEST_2026-11-19.md`); the preview shown in the app is a schematic swatch drawn from the settings, not a generated example.', '', 'Presets marked *existing* were already in the app; they keep their name, text and palette and only gain the structured 2D settings.', '']
    for (const family of Object.values(FAMILIES_2D)) {
      cat.push(`## ${family.replace('2D · ', '')}`, '', '| Preset | Id | What it looks like | Line | Shading | Texture | Suits |', '|---|---|---|---|---|---|---|')
      for (const st of all2D.filter((x) => x.spec2d!.family2d === family)) {
        const sp = st.spec2d!
        const old = Object.keys(existing2DSpecs).includes(st.name)
        cat.push(`| ${st.name}${old ? ' *(existing)*' : ''} | \`${sp.id}\` | ${sp.summary} | ${sp.line} | ${sp.shading} | ${sp.texture}${sp.intentionalTexture ? ' (kept on purpose)' : ''} | ${sp.animation} |`)
      }
      cat.push('')
    }
    writeFileSync(resolve(process.cwd(), 'docs/STYLE_CATALOG_2D.md'), cat.join('\n'))
    writeFileSync(resolve(process.cwd(), 'docs/2D_STYLE_DEMO.md'), lines.join('\n'))
    expect(styles2D.length).toBeGreaterThan(30)
  })
})
