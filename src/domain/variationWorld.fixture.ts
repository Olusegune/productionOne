import { emptyQueue, enqueue, type ImageJob, type JobRequest } from './generationQueue'
import type { ExtractedAsset } from './productionStudio'
import { defaultStyleBible } from './visualDevelopment'
import { emptyVariations, findRevision, type AgeSpec, type Ref, type VariationState } from './variations'
import { ageRequests } from './age'
import { newAgeVariant } from './ageFlow'
import { conditionRequests, newCondition } from './conditions'
import { fitRequests, garmentRequests } from './wardrobe'
import { garmentAssetId, newGarment, startFit, syncWardrobe } from './wardrobeFlow'

/** A small working world for tests: garments, an age, a condition and fits on the base body, the aged body and in the condition. */
export const T = '2026-11-27T00:00:00.000Z'
export const style = defaultStyleBible
export const mara: ExtractedAsset = { id: 'CHAR-MARA', name: 'MARA', type: 'character', sceneIds: [], status: 'approved', age: '30s' }
export const robe = { description: 'A long wool travel robe', category: 'Coat or jacket' }
export const hat = { description: 'A felt hat', category: 'Headwear' }
export const cap = { description: 'A knitted cap', category: 'Headwear' }
export const scarf = { description: 'A wool scarf', category: 'Accessory' }
export const spec65 = { mode: 'same-person' as const, targetAge: '65', anchors: ['the scar'], keep: ['costume'] }

let counter = 100
/** Queues the requests, then approves the first picture the way the screen and the queue do together. */
export function approveVia(state: VariationState, reqs: JobRequest[]): { state: VariationState; jobs: ImageJob[] } {
  const jobs = enqueue(emptyQueue(), reqs, ++counter).state.jobs.map((j, i) => ({ ...j, id: `${j.id}-${counter}`, status: 'needs-review' as const, outputPath: `C:/out/${j.id}-${counter}.jpg`, approved: i === 0 }))
  return { state: syncWardrobe(state, jobs, T), jobs }
}

/** One world: a robe, a hat, a cap and a scarf; Mara aged 65; the robe in a "wet" condition; fits on the base body, on the aged body and in the condition. */
export function world() {
  let s = emptyVariations()
  const jobs: ImageJob[] = []
  const take = (r: { state: VariationState; jobs: ImageJob[] }) => { s = r.state; jobs.push(...r.jobs) }
  const mkGarment = (name: string, spec: { description: string; category: string }) => {
    const g = newGarment(s, [mara], { name, spec, now: T })
    take(approveVia(g.variations, garmentRequests({ style, provider: 'kie', model: 'm', assetId: g.assetId, assetName: name, garment: g.ref, garmentName: name, spec })))
    return g.ref
  }
  const robeRef = mkGarment('Travel robe', robe)
  const hatRef = mkGarment('Felt hat', hat)
  const capRef = mkGarment('Knitted cap', cap)
  const scarfRef = mkGarment('Scarf', scarf)
  const age = newAgeVariant(s, { character: mara, spec: spec65, now: T })
  take(approveVia(age.variations, ageRequests({ style, provider: 'kie', model: 'm', character: mara, lookName: age.variant, age: age.ref, spec: findRevision(age.variations, age.ref)!.spec as AgeSpec, characterPicture: 'C:/mara.jpg' })))
  const wet = newCondition(s, { name: 'Rain-soaked', garment: robeRef, kind: 'wet', regions: [{ component: 'Whole garment', side: 'both', severity: 'heavy', description: 'soaked through' }], now: T })
  take(approveVia(wet.variations, conditionRequests({ style, provider: 'kie', model: 'm', assetId: garmentAssetId(robeRef.id), assetName: 'Travel robe', condition: wet.ref, conditionName: 'Rain-soaked', spec: findRevision(wet.variations, wet.ref)!.spec as never, garmentName: 'Travel robe', garment: robe, earlier: [] })))
  const makeFit = (opts: { body?: { ref: Ref; name: string }; condition?: { ref: Ref; name: string } }) => {
    const f = startFit(s, { character: mara, garment: robeRef, garmentName: 'Travel robe', keep: ['face'], now: T, ...opts })
    take(approveVia(f.variations, fitRequests({ style, provider: 'kie', model: 'm', character: mara, lookName: f.variant, fit: f.ref, garment: robeRef, garmentName: 'Travel robe', garmentSpec: robe, keep: ['face'], characterPicture: 'C:/mara.jpg', garmentPicture: 'C:/robe.jpg', ...(opts.condition ? { condition: opts.condition.ref } : {}), ...(opts.body ? { body: opts.body.ref } : {}) })))
    return f.ref
  }
  const bodyAge = { ref: { id: age.ref.id, revision: 1 }, name: 'MARA at 65' }
  const condRef = { id: wet.ref.id, revision: 1 }
  const fitBase = makeFit({})
  const fitAged = makeFit({ body: bodyAge })
  const fitAgedWet = makeFit({ body: bodyAge, condition: { ref: condRef, name: 'Rain-soaked' } })
  const fitBaseWet = makeFit({ condition: { ref: condRef, name: 'Rain-soaked' } })
  return { s, jobs, robeRef, hatRef, capRef, scarfRef, ageRef: bodyAge.ref, condRef, fitBase, fitAged, fitAgedWet, fitBaseWet, make: () => s }
}

