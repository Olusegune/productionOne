import { describe, expect, it } from 'vitest'
import { approveRevision, emptyVariations, findEntity, latestApproved, type SkinSpec, type VariationState } from './variations'
import { approvedSkin, newSkin, recordSkin, withPreset } from './skin'
import { canApproveRefinement, refusedLocally, originalFor, providerLead, refinementBlocker, refinementCost, refinementSummary, skinCapability, skinLookName, skinRefinementPrompt, skinRequests, skinViews, sourceForView, startSkinRefinement } from './skinRefine'
import { emptyQueue, enqueue, type ImageJob, type QueueState } from './generationQueue'
import { defaultStyleBible } from './visualDevelopment'
import type { ExtractedAsset } from './productionStudio'

const mara = { id: 'CHAR-MARA', name: 'Mara', type: 'character', sceneIds: [], status: 'approved', age: '34', gender: 'female' } as ExtractedAsset
const photo = { ...defaultStyleBible, family: 'Realistic 3D', name: 'Photoreal cinematic CG', rendering: 'photographic' }
const stylized = { ...defaultStyleBible, family: 'Family 3D', name: 'Family 3D Feature', rendering: 'stylized 3D' }
const flat2d = { ...defaultStyleBible, family: '2D', name: 'Ink', rendering: 'flat 2D line art' }

const job = (over: Partial<ImageJob>): ImageJob => ({ id: 'J', key: 'k', assetId: 'CHAR-MARA', variant: 'Canonical', sheetType: 'Identity', viewKey: 'full-front', label: 'x', prompt: 'p', aspect: '3:4', fullBody: true, provider: 'kie', model: 'm', references: [], useAnchor: false, outputName: 'o', revision: 1, status: 'completed', attempts: 1, maxAttempts: 3, qaNotes: [], approved: true, rejected: false, createdAt: 1, updatedAt: 1, outputPath: 'C:/m/full.jpg', ...over } as ImageJob)
const queue = (jobs: ImageJob[], perImageUsd: number | null = 0.04): QueueState => ({ ...emptyQueue(), jobs, perImageUsd })

function withProfile(extra: Partial<SkinSpec> = {}): VariationState {
  const made = recordSkin(emptyVariations(), { ...withPreset(newSkin(mara.id), 'natural'), complexion: 'warm olive', undertone: 'golden', marks: [{ what: 'a small scar', where: 'the left eyebrow' }], protect: ['facial-structure', 'complexion', 'age', 'expression', 'hair', 'marks', 'wardrobe'], ...extra }, 'Mara', 'a')
  if ('error' in made) throw new Error(made.error)
  return approveRevision(made.state, made.ref)
}

describe('1 and 2: the request preserves identity, complexion, marks, age and wardrobe', () => {
  const spec = approvedSkin(withProfile(), mara.id)!.spec
  const prompt = (provider = 'kie') => skinRefinementPrompt({ style: photo, character: mara, spec, view: skinViews[0], provider })

  it('says what is protected, what is refined, and what must not change', () => {
    const p = prompt()
    expect(p).toMatch(/Preserve the facial structure, the complexion, the apparent age, the expression, the hairstyle, the distinctive marks and the wardrobe\./)
    expect(p).toMatch(/Refine only the skin rendering with subtle region-specific texture, restrained highlights, natural tonal variation and age-appropriate fine detail\. Preserve soft transitions without smoothing the face into plastic or adding exaggerated pores\./)
    expect(p).toMatch(/Do not replace the face, change the apparent age, change the expression, redesign the costume, or change the pose or background\./)
    expect(p).toMatch(/Reference image 1 is the approved picture of Mara\. It fixes who this is\./)
  })
  it('quotes the complexion, undertone and marks exactly as written', () => {
    const p = prompt()
    expect(p).toContain('Complexion (the person\'s own description, keep it): warm olive.')
    expect(p).toContain('Undertone (the person\'s own description, keep it): golden.')
    expect(p).toContain('keep each exactly where it is: a small scar (the left eyebrow)')
  })
  it('does not turn a skin request into an age, costume or lighting change', () => {
    const p = prompt()
    expect(p).not.toMatch(/older|younger|wrinkle|aged|redesign the face/i)
    expect(p).not.toMatch(/key light|rim light|backlight|LUT|grade|grading/i)
  })
  it('never applies a universal "remove yellow" filter: a warm undertone the person wrote is respected, and a neutral one keeps the usual guidance', () => {
    const run = (undertone: string, complexion = 'olive') => skinRefinementPrompt({ style: photo, character: mara, spec: { ...spec, undertone, complexion }, view: skinViews[0], provider: 'openai', model: 'gpt-image-1' })
    expect(run('neutral')).toMatch(/no yellow, sepia or golden tint/)
    expect(run('golden')).not.toMatch(/no yellow, sepia or golden tint/)
    expect(run('neutral', 'warm olive')).not.toMatch(/no yellow, sepia or golden tint/)
    expect(run('golden')).not.toMatch(/Neutral white balance/)
  })
  it('adapts only the opening sentence to the provider; everything else is the same', () => {
    const [a, b, c] = [prompt('kie'), prompt('openai'), prompt('fal')]
    expect(providerLead('kie')).not.toBe(providerLead('openai'))
    const strip = (p: string, provider: string) => p.replace(providerLead(provider), '')
    expect(strip(a, 'kie')).toBe(strip(b, 'openai'))
    expect(strip(a, 'kie')).toBe(strip(c, 'fal'))
    expect(b).toContain('Using reference image 1 as the exact subject')
  })
})

describe('4 and 9: capability, references and actionable errors', () => {
  const state = withProfile()
  const ok = skinCapability(true, 'nano')
  it('a model that cannot take references is refused with what to do; one that can says it edits the whole picture', () => {
    const no = skinCapability(false, 'plain-model')
    expect(no.ok).toBe(false)
    expect(!no.ok && no.message).toMatch(/cannot take the approved picture as a reference.*Choose a model that takes references/)
    expect(ok.ok && ok.limitation).toMatch(/edits the whole picture.*cannot be limited to one region/)
  })
  it('names the first missing thing: style, profile, picture, then model', () => {
    const base = { state, character: mara, identityPicture: 'C:/m/full.jpg', capability: ok, style: photo }
    expect(refinementBlocker(base)).toBeUndefined()
    expect(refinementBlocker({ ...base, style: stylized })).toMatch(/not photorealistic.*never pushed toward realism/)
    expect(refinementBlocker({ ...base, style: flat2d })).toMatch(/not photorealistic/)
    expect(refinementBlocker({ ...base, state: emptyVariations() })).toMatch(/Save and approve the skin profile first/)
    expect(refinementBlocker({ ...base, identityPicture: undefined })).toMatch(/Approve Mara's front view first.*nothing to start from/)
    expect(refinementBlocker({ ...base, capability: skinCapability(false) })).toMatch(/cannot take the approved picture/)
  })
  it('a profile that is only a candidate does not count as approved', () => {
    const cand = recordSkin(emptyVariations(), newSkin(mara.id), 'Mara', 'a'); if ('error' in cand) throw new Error()
    expect(refinementBlocker({ style: photo, state: cand.state, character: mara, identityPicture: 'x', capability: ok })).toMatch(/Save and approve the skin profile first/)
  })
})

describe('3 and 10: requests, explicit execution and cost history', () => {
  const state = withProfile()
  const started = startSkinRefinement(state, { character: mara, identityJob: { id: 'J-FULL', revision: 2 }, now: 'n' })
  if ('error' in started) throw new Error(started.error)
  const q = queue([job({ id: 'J-FULL', revision: 2 }), job({ id: 'J-PORT', viewKey: 'portrait', outputPath: 'C:/m/portrait.jpg', fullBody: false })])
  const sources = { portrait: sourceForView(q, mara, 'portrait') as string, 'full-front': sourceForView(q, mara, 'full-front') as string }
  const requests = skinRequests({ style: photo, provider: 'kie', model: 'nano', character: mara, lookName: started.variant, skin: started.ref, spec: started.spec, sources })

  it('building a request spends nothing: only enqueue puts work in the queue, and it does so once per view with one reference each', () => {
    expect(q.jobs.filter((j) => j.variation)).toHaveLength(0)
    expect(requests.map((r) => r.viewKey)).toEqual(['portrait', 'full-front'])
    for (const r of requests) { expect(r.references).toHaveLength(1); expect(r.useAnchor).toBe(false); expect(r.variation).toMatchObject({ id: started.ref.id, revision: started.ref.revision, role: 'skin-candidate' }) }
    const result = enqueue(q, requests, 1, true)
    expect(result.added).toBe(2)
    const made = result.state.jobs.filter((j) => j.variation?.role === 'skin-candidate')
    expect(made.map((j) => j.variant)).toEqual([skinLookName('Mara'), skinLookName('Mara')])
    expect(made.every((j) => j.approved === false)).toBe(true) // generated candidates are never approved automatically
  })
  it('each view is refined from the approved original of that view; the front view is the fallback', () => {
    expect(sources.portrait).toBe('C:/m/portrait.jpg')
    expect(sources['full-front']).toBe('C:/m/full.jpg')
    expect(originalFor(q, mara, 'portrait')).toBe('C:/m/portrait.jpg')
    expect(sourceForView(queue([job({ id: 'J-FULL' })]), mara, 'portrait')).toBe('C:/m/full.jpg')
    expect(sourceForView(queue([]), mara, 'portrait')).toBeUndefined()
  })
  it('the refinement is a new candidate revision under its own look name; the approved profile and original are untouched', () => {
    const entity = findEntity(started.variations, started.ref.id)!
    expect(started.ref.revision).toBe(2)
    expect(entity.revisions[0].status).toBe('approved')
    expect(entity.revisions[1]).toMatchObject({ status: 'candidate', parent: { id: started.ref.id, revision: 1 } })
    expect(latestApproved(entity)?.n).toBe(1)
    expect(started.variant).toBe('Mara, refined skin')
    expect((entity.revisions[1].spec as SkinSpec)).toMatchObject({ variant: 'Mara, refined skin', identityJobId: 'J-FULL', identityRevision: 2 })
    expect('error' in startSkinRefinement(emptyVariations(), { character: mara, now: 'n' })).toBe(true)
  })
  it('retries add to the spend and never replace it', () => {
    const jobs = [job({ id: 'A', attempts: 1, variation: { id: 'SKN-001', revision: 2, role: 'skin-candidate' } }), job({ id: 'B', attempts: 3, variation: { id: 'SKN-001', revision: 2, role: 'skin-candidate' } }), job({ id: 'C', attempts: 5, variation: { id: 'SKN-002', revision: 1, role: 'skin-candidate' } })]
    expect(refinementCost(queue(jobs), 'SKN-001')).toEqual({ pictures: 2, attempts: 4, refused: 0, usd: 0.16 })
    const retried = jobs.map((j) => (j.id === 'A' ? { ...j, attempts: 2 } : j))
    expect(refinementCost(queue(retried), 'SKN-001')).toEqual({ pictures: 2, attempts: 5, refused: 0, usd: 0.2 })
    expect(refinementCost(queue(jobs, null), 'SKN-001').usd).toBeNull()
    expect(refinementCost(queue([]), 'SKN-001')).toEqual({ pictures: 0, attempts: 0, refused: 0, usd: 0 })
  })
})

describe('requests refused on this computer are not charged', () => {
  const outside = 'Only images in the Production One assets folder can be previewed (this one is at C:/other/a.png) The request was not accepted.'
  it('are recognised, counted apart, and left out of the estimate; a real failure still counts', () => {
    const linked = { id: 'SKN-001', revision: 2, role: 'skin-candidate' }
    const jobs = [job({ id: 'A', status: 'failed', attempts: 1, error: outside, variation: linked, approved: false }), job({ id: 'B', status: 'failed', attempts: 1, error: 'Provider error 500', variation: linked, approved: false }), job({ id: 'C', status: 'completed', attempts: 2, variation: linked })]
    expect(refusedLocally(jobs[0])).toBe(true)
    expect(refusedLocally(jobs[1])).toBe(false)
    expect(refusedLocally({ ...jobs[0], providerTaskId: 'T1' })).toBe(false)
    expect(refinementCost(queue(jobs), 'SKN-001')).toEqual({ pictures: 3, attempts: 3, refused: 1, usd: 0.12 })
  })
})

describe('identity and surface are separate decisions', () => {
  it('better-looking skin alone never approves a candidate; identity must be confirmed', () => {
    expect(canApproveRefinement({ identity: false, surface: true }, true)).toMatchObject({ ok: false })
    expect(canApproveRefinement({ identity: false, surface: true }, true).why).toMatch(/Better-looking skin is not enough on its own/)
    expect(canApproveRefinement({ identity: true, surface: false }, true).ok).toBe(true)
    expect(canApproveRefinement({ identity: true, surface: true }, true).why).toMatch(/Identity preserved and the surface judged better/)
    expect(canApproveRefinement({ identity: true, surface: true }, false)).toMatchObject({ ok: false })
  })
  it('summarises what is protected and what is meant to change', () => {
    const s = refinementSummary(approvedSkin(withProfile(), mara.id)!.spec)
    expect(s.protectedItems).toEqual(['Facial structure', 'Complexion', 'Age', 'Expression', 'Hair', 'Distinctive marks', 'Wardrobe'])
    expect(s.intended[0]).toMatch(/Skin texture, highlights and tonal variation/)
    expect(s.intended[1]).toBe('Marks kept where they are: a small scar (the left eyebrow)')
  })
})

describe('approval flows from the queue into the record, and downstream sheets follow', () => {
  it('approving a refined picture makes the candidate revision approved with that picture; the original profile and picture are unchanged; the variant is offered for sheets', async () => {
    const { reconcileWithQueue } = await import('./variationSync')
    const { lookNamesFor } = await import('./wardrobeFlow')
    const state = withProfile()
    const started = startSkinRefinement(state, { character: mara, now: 'n' })
    if ('error' in started) throw new Error()
    const q = queue([job({ id: 'J-FULL' }), job({ id: 'J-PORT', viewKey: 'portrait', outputPath: 'C:/m/portrait.jpg', fullBody: false })])
    const reqs = skinRequests({ style: photo, provider: 'kie', model: 'nano', character: mara, lookName: started.variant, skin: started.ref, spec: started.spec, sources: { portrait: 'C:/m/portrait.jpg', 'full-front': 'C:/m/full.jpg' } })
    const made = enqueue(q, reqs, 1, true).state.jobs.filter((j) => j.variation).map((j) => ({ ...j, status: 'completed' as const, outputPath: `C:/m/refined-${j.viewKey}.jpg` }))
    // Finished but not approved: the revision stays a candidate with its pictures attached.
    const waiting = reconcileWithQueue(started.variations, made)
    const e1 = findEntity(waiting, started.ref.id)!
    expect(e1.revisions[1].status).toBe('candidate')
    expect(e1.revisions[1].media.map((m) => m.view).sort()).toEqual(['full-front', 'portrait'])
    expect(lookNamesFor(waiting, mara.id)).toEqual([]) // not offered for sheets until approved
    // The person approves the full-front: the revision is approved with that picture as the chosen one.
    const approvedJobs = made.map((j) => (j.viewKey === 'full-front' ? { ...j, approved: true } : j))
    const after = reconcileWithQueue(waiting, approvedJobs)
    const e2 = findEntity(after, started.ref.id)!
    expect(e2.revisions[1].status).toBe('approved')
    expect(e2.revisions[1].media.find((m) => m.role === 'approved')?.view).toBe('full-front')
    expect(e2.revisions[0].status).toBe('approved')
    expect(e2.revisions[0].media).toEqual([])
    expect(approvedSkin(after, mara.id)?.ref.revision).toBe(2)
    expect(lookNamesFor(after, mara.id)).toEqual(['Mara, refined skin'])
  })
  it('turning down every picture rejects the candidate and keeps the approved profile', async () => {
    const { reconcileWithQueue } = await import('./variationSync')
    const started = startSkinRefinement(withProfile(), { character: mara, now: 'n' })
    if ('error' in started) throw new Error()
    const q = queue([])
    const reqs = skinRequests({ style: photo, provider: 'kie', model: 'nano', character: mara, lookName: started.variant, skin: started.ref, spec: started.spec, sources: { portrait: 'a', 'full-front': 'b' } })
    const jobs = enqueue(q, reqs, 1, true).state.jobs.filter((j) => j.variation).map((j) => ({ ...j, status: 'completed' as const, outputPath: `C:/m/${j.viewKey}.jpg`, rejected: true }))
    const after = reconcileWithQueue(started.variations, jobs)
    const e = findEntity(after, started.ref.id)!
    expect(e.revisions[1].status).toBe('rejected')
    expect(approvedSkin(after, mara.id)?.ref.revision).toBe(1)
  })
})
