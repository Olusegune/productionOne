import { describe, expect, it } from 'vitest'
import { enqueue, emptyQueue, type ImageJob } from './generationQueue'
import type { ExtractedAsset } from './productionStudio'
import { defaultStyleBible } from './visualDevelopment'
import { staleRevisions } from './variationGraph'
import { reconcileWithQueue, variationFiles, currentPath } from './variationSync'
import { approvedPicture, emptyVariations, findRevision, type FitSpec, type LookSpec, type VariationState } from './variations'
import { defaultKeep, fitCapability, fitFrontView, fitPrompt, fitRequests, garmentPrompt, garmentRequests, garmentText, garmentViews } from './wardrobe'
import { garmentAssetId, garmentPicture, newGarment, reviseGarment, startFit, syncWardrobe } from './wardrobeFlow'

const T = '2026-11-27T00:00:00.000Z'
const style = defaultStyleBible
const mara: ExtractedAsset = { id: 'CHAR-MARA', name: 'MARA', type: 'character', sceneIds: [], status: 'approved', age: '30s', gender: 'female', role: 'harbour pilot', never: 'never without the scar', description: 'A weathered harbour pilot in a long navy coat with brass buttons.' }
const tom: ExtractedAsset = { id: 'CHAR-TOM', name: 'TOM', type: 'character', sceneIds: [], status: 'approved', age: '60s', gender: 'male' }
const jacket = { description: 'A waxed cotton field jacket with a corduroy collar and four patch pockets.', category: 'Coat or jacket', details: { colour: 'deep green', closures: 'brass snaps' } }

const done = (jobs: ImageJob[], patch: (j: ImageJob, i: number) => Partial<ImageJob>): ImageJob[] =>
  jobs.map((j, i) => ({ ...j, status: 'needs-review' as const, outputPath: `C:/out/${j.id}.jpg`, ...patch(j, i) }))

function withGarment() {
  const g = newGarment(emptyVariations(), [mara, tom], { name: 'Field jacket', spec: jacket, now: T })
  const requests = garmentRequests({ style, provider: 'kie', model: 'google/nanobanana-2-1', assetId: g.assetId, assetName: 'Field jacket', garment: g.ref, garmentName: 'Field jacket', spec: jacket })
  const q = enqueue(emptyQueue(), requests, 1).state
  return { ...g, requests, jobs: q.jobs }
}

describe('designing a garment (a jacket that is not in the character’s picture)', () => {
  it('makes a candidate garment and a costume asset to hold its pictures', () => {
    const g = newGarment(emptyVariations(), [mara], { name: 'Field jacket', spec: jacket, now: T })
    expect(g.ref).toEqual({ id: 'GAR-001', revision: 1 })
    expect(findRevision(g.variations, g.ref)?.status).toBe('candidate')
    expect(g.assets.find((a) => a.id === garmentAssetId('GAR-001'))).toMatchObject({ type: 'costume', name: 'Field jacket', status: 'planned' })
    expect(g.assets).toHaveLength(2)
  })

  it('describes the garment from the person’s own fields, and says Custom is allowed', () => {
    const text = garmentText({ ...jacket, category: 'Custom', pieces: ['jacket', 'scarf'], details: { ...jacket.details, era: '1940s coastal Britain' } })
    expect(text).toMatch(/waxed cotton field jacket/)
    expect(text).toMatch(/Pieces: jacket, scarf/)
    expect(text).toMatch(/Era and culture: 1940s coastal Britain/)
    expect(text).toMatch(/Colour and pattern: deep green/)
    expect(text).not.toMatch(/Category/)
  })

  it('asks for clothing only: no person, no character description, neutral light, and the project’s style', () => {
    const p = garmentPrompt({ style, name: 'Field jacket', spec: jacket, view: garmentViews[0] })
    expect(p).toMatch(/waxed cotton field jacket/)
    expect(p).toMatch(/Show the garment only: no person/)
    expect(p).toMatch(/Neutral, even reference lighting/)
    expect(p).toContain(style.name)
    expect(p).not.toMatch(/navy coat|MARA/)
  })

  it('queues three clothing views linked to the revision, with no references when there is no earlier picture', () => {
    const { requests } = withGarment()
    expect(requests.map((r) => r.viewKey)).toEqual(['garment-front', 'garment-back', 'garment-detail'])
    expect(requests.every((r) => r.references.length === 0 && r.variation?.id === 'GAR-001' && r.variation.role === 'garment-preview')).toBe(true)
  })

  it('a new version of a garment continues from the approved picture of the earlier one', () => {
    const { variations, jobs, ref } = withGarment()
    const shown = reconcileWithQueue(variations, done(jobs, () => ({})))
    const picked = reconcileWithQueue(shown, done(jobs, (j, i) => ({ approved: i === 0, updatedAt: 9 })))
    const pic = garmentPicture(picked, ref.id)
    expect(pic?.path).toBe(`C:/out/${jobs[0].id}.jpg`)
    const next = reviseGarment(picked, ref.id, { ...jacket, description: `${jacket.description} With a storm flap.` }, T)
    const reqs = garmentRequests({ style, provider: 'kie', model: 'm', assetId: garmentAssetId(ref.id), assetName: 'Field jacket', garment: next.ref, garmentName: 'Field jacket', spec: jacket, source: pic?.path })
    expect(reqs[0].references).toEqual([pic?.path])
    expect(reqs[0].prompt).toMatch(/attached picture is the approved design of this garment/)
    expect(findRevision(next.variations, next.ref)?.parent).toEqual(ref)
  })
})

describe('following the queue', () => {
  it('attaches finished pictures to the candidate once, however often it runs', () => {
    const { variations, jobs, ref } = withGarment()
    const finished = done(jobs, () => ({}))
    const a = reconcileWithQueue(variations, finished)
    expect(findRevision(a, ref)?.media).toHaveLength(3)
    expect(reconcileWithQueue(a, finished)).toBe(a)
  })

  it('ignores a picture that is still being made or failed', () => {
    const { variations, jobs } = withGarment()
    expect(reconcileWithQueue(variations, jobs)).toBe(variations)
    expect(reconcileWithQueue(variations, jobs.map((j) => ({ ...j, status: 'failed' as const, outputPath: 'C:/x.jpg' })))).toBe(variations)
  })

  it('approving one picture approves the garment and records which picture was chosen', () => {
    const { variations, jobs, ref } = withGarment()
    const out = reconcileWithQueue(variations, done(jobs, (_j, i) => ({ approved: i === 1 })))
    const rev = findRevision(out, ref)!
    expect(rev.status).toBe('approved')
    expect(approvedPicture(rev)?.jobId).toBe(jobs[1].id)
    expect(rev.media.filter((m) => m.role === 'approved')).toHaveLength(1)
  })

  it('turning down every picture turns the garment down; one waiting picture keeps it open', () => {
    const { variations, jobs, ref } = withGarment()
    const all = reconcileWithQueue(variations, done(jobs, () => ({ rejected: true })))
    expect(findRevision(all, ref)?.status).toBe('rejected')
    const some = reconcileWithQueue(variations, done(jobs, (_j, i) => ({ rejected: i < 2, status: i < 2 ? 'needs-review' : 'queued' })))
    expect(findRevision(some, ref)?.status).toBe('candidate')
  })

  it('never changes an approved garment’s pictures when more arrive later', () => {
    const { variations, jobs, ref } = withGarment()
    const out = reconcileWithQueue(variations, done(jobs, (_j, i) => ({ approved: i === 0 })))
    const before = JSON.stringify(findRevision(out, ref))
    const late = done(jobs, (_j, i) => ({ approved: i === 0 })).concat(done([{ ...jobs[0], id: 'late', variation: jobs[0].variation }], () => ({})))
    expect(JSON.stringify(findRevision(reconcileWithQueue(out, late), ref))).toBe(before)
  })

  it('finds a picture where the queue says it is now, even after a relink', () => {
    const { variations, jobs, ref } = withGarment()
    const out = reconcileWithQueue(variations, done(jobs, () => ({})))
    const media = findRevision(out, ref)!.media[0]
    const moved = jobs.map((j) => ({ ...j, outputPath: `D:/moved/${j.id}.jpg` }))
    expect(currentPath(media, moved)).toBe(`D:/moved/${media.jobId}.jpg`)
    expect(variationFiles(out, moved).every((f) => f.absolutePath.startsWith('D:/moved/'))).toBe(true)
  })
})

/** An approved garment with an approved picture, ready to fit. */
function approvedGarment(): { variations: VariationState; ref: ReturnType<typeof newGarment>['ref']; path: string } {
  const { variations, jobs, ref } = withGarment()
  const out = reconcileWithQueue(variations, done(jobs, (_j, i) => ({ approved: i === 0 })))
  return { variations: out, ref, path: garmentPicture(out, ref.id)!.path }
}

describe('fitting a garment to a character', () => {
  it('needs an approved garment', () => {
    const { variations, ref } = withGarment()
    expect(() => startFit(variations, { character: mara, garment: ref, garmentName: 'Field jacket', keep: defaultKeep, now: T })).toThrow(/Approve the garment/)
  })

  it('names the reference pictures by role, keeps the face and body, and drops the clothing the character was wearing', () => {
    const p = fitPrompt({ style, character: mara, garmentName: 'Field jacket', garment: jacket, keep: defaultKeep, view: fitFrontView })
    expect(p).toMatch(/Reference image 1 is the approved character/)
    expect(p).toMatch(/Reference image 2 is the approved garment design/)
    expect(p).toMatch(/Do not copy the clothing the character wears in reference image 1/)
    expect(p).toMatch(/Keep exactly the same: the face, skin tone and hairstyle; the body build and proportions; the standing pose/)
    expect(p).toMatch(/waxed cotton field jacket/)
    expect(p).not.toMatch(/navy coat|brass buttons/)
    expect(p).toMatch(/never without the scar/)
  })

  it('leaves out what the person did not ask to keep', () => {
    const p = fitPrompt({ style, character: mara, garmentName: 'Field jacket', garment: jacket, keep: ['face'], view: fitFrontView })
    expect(p).toMatch(/Keep exactly the same: the face, skin tone and hairstyle\./)
    expect(p).not.toMatch(/standing pose/)
  })

  it('queues the fit with the character picture first and the garment picture second, filed as its own look', () => {
    const { variations, ref, path } = approvedGarment()
    const fit = startFit(variations, { character: mara, garment: ref, garmentName: 'Field jacket', keep: defaultKeep, now: T })
    const [req] = fitRequests({ style, provider: 'kie', model: 'google/nanobanana-2-1', character: mara, lookName: fit.variant, fit: fit.ref, garment: ref, garmentName: 'Field jacket', garmentSpec: jacket, keep: defaultKeep, characterPicture: 'C:/mara/front.jpg', garmentPicture: path })
    expect(req.references).toEqual(['C:/mara/front.jpg', path])
    expect(req.assetId).toBe('CHAR-MARA')
    expect(req.variant).toBe('MARA in Field jacket')
    expect(req.viewKey).toBe('costume-front')
    expect(req.variation).toMatchObject({ id: fit.ref.id, role: 'fit-candidate' })
    expect(req.variation?.uses?.map((u) => u.role)).toEqual(['reference-1-character', 'reference-2-garment'])
  })

  it('reuses the garment on another character with a separate fit, and a second try is a new revision of the same fit', () => {
    const { variations, ref } = approvedGarment()
    const a = startFit(variations, { character: mara, garment: ref, garmentName: 'Field jacket', keep: defaultKeep, now: T })
    const b = startFit(a.variations, { character: tom, garment: ref, garmentName: 'Field jacket', keep: ['face'], now: T })
    expect(a.ref.id).not.toBe(b.ref.id)
    expect((findRevision(b.variations, b.ref)?.spec as FitSpec).characterId).toBe('CHAR-TOM')
    expect((findRevision(b.variations, a.ref)?.spec as FitSpec).keep).toEqual(defaultKeep)
    const again = startFit(b.variations, { character: mara, garment: ref, garmentName: 'Field jacket', keep: defaultKeep, now: T })
    expect(again.ref).toEqual({ id: a.ref.id, revision: 2 })
  })

  it('refuses a model that cannot see pictures, and says why', () => {
    expect(fitCapability(true)).toEqual({ ok: true })
    const no = fitCapability(false)
    expect(no.ok).toBe(false)
    expect(!no.ok && no.message).toMatch(/cannot receive reference pictures/)
  })
})

describe('approving an outfit', () => {
  function fitted() {
    const { variations, ref, path } = approvedGarment()
    const fit = startFit(variations, { character: mara, garment: ref, garmentName: 'Field jacket', keep: defaultKeep, now: T })
    const [req] = fitRequests({ style, provider: 'kie', model: 'm', character: mara, lookName: fit.variant, fit: fit.ref, garment: ref, garmentName: 'Field jacket', garmentSpec: jacket, keep: defaultKeep, characterPicture: 'C:/mara/front.jpg', garmentPicture: path })
    const q = enqueue(emptyQueue(), [req], 1).state
    return { fit, variations: fit.variations, jobs: q.jobs, ref }
  }

  it('makes a production look from the approved outfit, once, pinned to that fit revision', () => {
    const { fit, variations, jobs } = fitted()
    const approved = syncWardrobe(variations, done(jobs, () => ({ approved: true })), T)
    const looks = approved.entities.filter((e) => e.kind === 'look')
    expect(looks).toHaveLength(1)
    expect(looks[0]).toMatchObject({ name: 'MARA in Field jacket', characterId: 'CHAR-MARA' })
    expect(looks[0].revisions[0].status).toBe('approved')
    expect(looks[0].revisions[0].spec as LookSpec).toMatchObject({ fit: fit.ref, queueVariant: 'MARA in Field jacket' })
    expect(syncWardrobe(approved, done(jobs, () => ({ approved: true })), T)).toBe(approved)
  })

  it('does not make a look while the outfit is only a candidate', () => {
    const { variations, jobs } = fitted()
    expect(syncWardrobe(variations, done(jobs, () => ({})), T).entities.filter((e) => e.kind === 'look')).toHaveLength(0)
  })

  it('changing the base garment marks the outfit and its look stale and nothing else', () => {
    const { variations, jobs, ref } = fitted()
    const approved = syncWardrobe(variations, done(jobs, () => ({ approved: true })), T)
    expect(staleRevisions(approved)).toEqual([])
    const next = reviseGarment(approved, ref.id, { ...jacket, description: 'changed' }, T)
    // Approve the new revision the same way the queue would.
    const reqs = garmentRequests({ style, provider: 'kie', model: 'm', assetId: garmentAssetId(ref.id), assetName: 'Field jacket', garment: next.ref, garmentName: 'Field jacket', spec: jacket })
    const newJobs = enqueue(emptyQueue(), reqs, 2).state.jobs
    const after = syncWardrobe(next.variations, [...done(jobs, () => ({ approved: true })), ...done(newJobs, (_j, i) => ({ approved: i === 0 }))], T)
    const ids = staleRevisions(after).map((s) => s.ref.id).sort()
    expect(ids).toEqual(['FIT-001', 'LOOK-001'])
  })

  it('keeps the base character’s own approvals out of it: the look files pictures under its own name', () => {
    const { variations, jobs } = fitted()
    expect(jobs.every((j) => j.assetId === 'CHAR-MARA' && j.variant === 'MARA in Field jacket')).toBe(true)
    expect(variations.entities.some((e) => e.id === 'CHAR-MARA')).toBe(false)
  })
})
