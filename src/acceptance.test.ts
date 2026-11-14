import { describe, expect, it } from 'vitest'
import { parseStory } from './engine/story'
import { analyzeScript } from './domain/productionStudio'
import { validatePackageContract } from './domain/packageContract'

const acceptanceScript = `Title: Lantern House\n\nINT. LANTERN HOUSE - NIGHT\nMARA\nThe compass is cold.\nShe lifts the brass compass.\n\nEXT. LANTERN HOUSE - DAWN\nMARA enters wearing a field coat now.\n\nJONAH\nThe compass hangs from his belt.`

describe('deterministic acceptance project', () => {
  it('keeps evidence, shared environment, wardrobe change and recurring prop traceable', () => {
    const story = parseStory(acceptanceScript)
    const analysis = analyzeScript(acceptanceScript)
    expect(story.scenes.length).toBeGreaterThanOrEqual(2)
    expect(story.characters.length).toBeGreaterThanOrEqual(2)
    expect(analysis.assets.some((asset) => /compass/i.test(asset.name))).toBe(true)
    expect(story.variants.some((variant) => variant.kind === 'wardrobe')).toBe(true)
    expect(story.scenes.every((scene) => scene.action.length + scene.dialogue.length > 0)).toBe(true)
  })
  it('rejects a verified package with a stale required revision', () => {
    const errors = validatePackageContract({ format: 'production-one-package', schemaVersion: 1, mode: 'verified', status: 'production-ready', projectId: 'ACCEPTANCE-001', entries: [{ id: 'A1', revisionId: 'R2', relativePath: 'Approved References/a.png', sha256: 'x', size: 1, approved: true, stale: true, required: true }] }, [{ relativePath: 'Approved References/a.png', sha256: 'x', size: 1 }])
    expect(errors.join(' ')).toMatch(/current and approved/)
  })
})
