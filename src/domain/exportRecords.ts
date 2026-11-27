import type { StudioState } from '../data/projectStore'
import { exportLooks } from './grade'
import { emptyQueue, type ImageJob } from './generationQueue'
import { fingerprint, type ProportionProfile } from './proportions'
import { variationManifest } from './variationManifest'

/**
 * The design records that go into a production package: approved proportions, world rules, fit rules and the scale convention, camera and lighting direction,
 * looks, review findings with their exceptions, and the approvals with the revisions they depend on. Only fields this app itself defines are written, into this
 * app's own package; nothing is shaped for any other program's import format.
 */
export const DESIGN_RECORDS_FORMAT = 'production-one-design-records'
export const DESIGN_RECORDS_VERSION = 1

/** A file name only. Directories are machine-specific and are never exported. */
export const baseName = (path: string): string => path.split(/[\\/]/).filter(Boolean).pop() ?? ''

const approvedRevisions = (jobs: ImageJob[]) => jobs.filter((j) => j.approved && j.outputPath).map((j) => ({
  jobId: j.id, assetId: j.assetId, sheetType: j.sheetType, view: j.viewKey, revision: j.revision, file: baseName(j.outputPath!),
  style: j.styleName ?? null, proportionFingerprint: j.provenance?.proportionFp ?? null,
  references: (j.provenance?.references ?? []).map((r) => ({ file: baseName(r.path), ...(r.jobId ? { jobId: r.jobId } : {}), ...(r.revision ? { revision: r.revision } : {}) })),
  correctionOf: j.provenance?.correctionOf ?? null,
  // Which garment, fit, condition, age, transformation or look revision the picture was made for, so a picture can be traced to the record that asked for it.
  ...(j.variation ? { variation: { ref: `${j.variation.id}@${j.variation.revision}`, role: j.variation.role } } : {}),
}))

export function buildDesignRecords(studio: StudioState, hashes: Record<string, string> = {}) {
  const profiles = Object.values(studio.proportions ?? {}) as ProportionProfile[]
  const jobs = studio.queue?.jobs ?? []
  const records = {
    format: DESIGN_RECORDS_FORMAT,
    version: DESIGN_RECORDS_VERSION,
    note: 'Target proportions, world and fit rules, camera and lighting direction, looks, review findings and approvals for this production. Illustrative sizes are marked as such. Grades are never baked into pictures.',
    proportions: profiles.map((p) => ({ ...p, fingerprint: fingerprint(p) })),
    world: studio.world ?? { scaleConvention: 'metres' },
    scaleConvention: 'metres',
    fitRules: studio.fitRules ?? {},
    sceneStates: studio.sceneStates ?? {},
    shots: (studio.shots ?? []).filter((s) => s.camera || s.lightingRecord || s.lens).map((s) => ({ shotId: s.id, size: s.size ?? null, angle: s.angle ?? null, lensMm: s.lens ?? null, movement: s.movement ?? null, camera: s.camera ?? null, lighting: s.lightingRecord ?? null })),
    looks: exportLooks(studio.looks ?? { looks: [], sceneLooks: {}, shotLooks: {} }, jobs.filter((j) => j.outputPath).map((j) => ({ id: j.id, path: baseName(j.outputPath!), hash: hashes[j.id] }))),
    review: { deterministic: studio.reviews?.deterministic ?? [], vision: studio.reviews?.vision ?? [], checked: studio.reviews?.checked ?? {}, corrections: studio.corrections ?? {} },
    approvedRevisions: approvedRevisions(jobs),
    // Present once garments, ages, transformations or looks have been made. Older projects write exactly what they always did.
    ...(studio.variations && studio.variations.entities.length ? { variations: variationManifest(studio.variations, studio.queue ?? { ...emptyQueue(), jobs }) } : {}),
  }
  return records
}
