import { findEntity, findRevision, latestApproved, type ConditionSpec, type Ref, type VariationState } from './variations'

export type CheckResult = 'pass' | 'fail' | 'not-checked'
export interface Check { id: string; label: string; result: CheckResult; detail: string }

/** The four honest states: nothing run, something to look at, passed for the checks that were run, or unable to run them. */
export type CheckState = 'not-checked' | 'needs-review' | 'passed-for-checks-performed' | 'unable-to-check'

export interface ConditionReport { ref: Ref; state: CheckState; checks: Check[]; summary: string }

/**
 * Checks on the record of a condition, not on its pictures. These are fixed rules that can be run without looking at an image:
 * every region names a part, a side and a description; the condition belongs to the garment it says; it continues from a condition of the same garment;
 * and the garment it was made from is still the current one. Where a mark landed in a picture, and whether a tear is on the right sleeve, cannot be
 * read from the record: those are left "not checked" and are for a person to look at in Review.
 */
export function checkCondition(variations: VariationState, ref: Ref): ConditionReport {
  const rev = findRevision(variations, ref)
  const entity = findEntity(variations, ref.id)
  if (!rev || !entity || entity.kind !== 'condition') return { ref, state: 'unable-to-check', checks: [], summary: 'This condition is not in the project, so it could not be checked.' }
  const spec = rev.spec as ConditionSpec
  const checks: Check[] = []
  const bad = spec.regions.filter((r) => !r.component.trim() || !r.side)
  checks.push({ id: 'regions-named', label: 'Every change names a garment part and the wearer’s side', result: spec.regions.length === 0 ? 'not-checked' : bad.length ? 'fail' : 'pass', detail: spec.regions.length === 0 ? 'No regions were set, so the condition applies to the whole garment.' : bad.length ? `${bad.length} change${bad.length === 1 ? ' has' : 's have'} no part or side.` : `${spec.regions.length} change${spec.regions.length === 1 ? '' : 's'} named.` })
  const empty = spec.regions.filter((r) => !r.description.trim())
  checks.push({ id: 'regions-described', label: 'Every change says what happened', result: spec.regions.length === 0 ? 'not-checked' : empty.length ? 'fail' : 'pass', detail: empty.length ? `${empty.length} change${empty.length === 1 ? ' has' : 's have'} no description.` : 'All described.' })
  const garment = findEntity(variations, spec.garment.id)
  const garmentRev = findRevision(variations, spec.garment)
  checks.push({ id: 'garment-exists', label: 'Made from a garment in this project', result: garment?.kind === 'garment' && garmentRev ? 'pass' : 'fail', detail: garmentRev ? `${garment?.name}, version ${spec.garment.revision}.` : 'The garment this was made from is missing.' })
  const newest = garment && latestApproved(garment)
  checks.push({ id: 'garment-current', label: 'The garment has not changed since', result: !newest ? 'not-checked' : newest.n > spec.garment.revision ? 'fail' : 'pass', detail: newest && newest.n > spec.garment.revision ? `The garment now has version ${newest.n}; this condition was made from version ${spec.garment.revision}.` : 'Still the current version.' })
  if (spec.from) {
    const from = findRevision(variations, spec.from)
    const fromSpec = from?.spec as ConditionSpec | undefined
    checks.push({ id: 'history-same-garment', label: 'Continues from a condition of the same garment', result: from && fromSpec?.garment.id === spec.garment.id ? 'pass' : 'fail', detail: from ? (fromSpec?.garment.id === spec.garment.id ? 'Yes.' : 'The earlier condition belongs to a different garment.') : 'The earlier condition is missing.' })
    checks.push({ id: 'history-approved', label: 'The earlier condition was approved', result: from?.status === 'approved' ? 'pass' : 'fail', detail: from?.status === 'approved' ? 'Yes.' : 'It is not approved.' })
  }
  checks.push({ id: 'placement', label: 'The changes are in the right place in each picture', result: 'not-checked', detail: 'This cannot be read from the record. Check the wearer’s side and the position against the pictures in Review.' })

  const failed = checks.filter((c) => c.result === 'fail')
  const outcome: CheckState = failed.length ? 'needs-review' : 'passed-for-checks-performed'
  const summary = failed.length ? `${failed.length} check${failed.length === 1 ? '' : 's'} need${failed.length === 1 ? 's' : ''} a look: ${failed.map((c) => c.label.toLowerCase()).join('; ')}.` : 'Passed for the record checks performed. Picture placement was not checked.'
  return { ref, state: outcome, checks, summary }
}
