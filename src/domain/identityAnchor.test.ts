import { describe, expect, it } from 'vitest'
import { anchorStatus, suggestReferenceModel } from './identityAnchor'
import type { CatalogModel } from './imageCatalog'

const m = (provider: CatalogModel['provider'], id: string, references: boolean, source: CatalogModel['source'] = 'built-in'): CatalogModel => ({ provider, id, name: id, source, references, note: '' })

describe('suggestReferenceModel', () => {
  const catalog = [m('kie', 'bytedance/seedream-5-flash', false), m('kie', 'google/pro-image-to-image', true), m('kie', 'google/nanobanana-2-1', true), m('openai', 'gpt-image-1.5', false), m('google', 'gemini-nano-banana-2.1', true)]
  it('prefers a nano-banana style model on the provider already in use', () => {
    expect(suggestReferenceModel(catalog, { provider: 'kie', modelId: 'bytedance/seedream-5-flash' }, { kie: true, google: true })?.id).toBe('google/nanobanana-2-1')
  })
  it('only suggests providers that have a key', () => {
    expect(suggestReferenceModel(catalog, { provider: 'kie', modelId: 'x' }, { kie: false, google: true })?.id).toBe('gemini-nano-banana-2.1')
    expect(suggestReferenceModel(catalog, { provider: 'kie', modelId: 'x' }, {})).toBeUndefined()
  })
  it('never suggests a model without references', () => {
    expect(suggestReferenceModel([m('kie', 'a', false)], { provider: 'kie', modelId: 'a' }, { kie: true })).toBeUndefined()
  })
})

describe('anchorStatus', () => {
  it('says plainly when the model cannot hold identity', () => {
    expect(anchorStatus({ takesReferences: false }).kind).toBe('no-references')
  })
  it('waits for an approved front view', () => {
    expect(anchorStatus({ takesReferences: true }).kind).toBe('waiting-for-anchor')
  })
  it('reports a locked anchor', () => {
    const s = anchorStatus({ takesReferences: true, anchorPath: 'C:/a.jpg', anchorLabel: 'Front' })
    expect(s.kind).toBe('locked')
    expect(s.message).toContain('Front')
  })
})
