import { artifactGuidance } from './cleanGuidance'
import { anchorFor, type ImageJob, type JobRequest, type QueueState } from './generationQueue'
import type { ExtractedAsset } from './productionStudio'
import { backdropLine, closeUpReframeLine, identityFacts, outputName, viewsFor, type ViewSpec } from './sheetSpecs'
import { styleGuidance, type StyleBible } from './visualDevelopment'
import { approvedSkin, isPhotorealStyle, PROTECT_CHOICES, protectLine, skinLine } from './skin'
import { addRevision, type Ref, type SkinSpec, type VariationState } from './variations'

/**
 * Protected skin refinement. The approved picture of a character is the only starting point and is never changed or replaced: the refinement is a NEW candidate,
 * filed under its own look name, that a person compares with the original and approves as a new version. The request asks an image model to change only the
 * skin rendering and to preserve what the person protected. Image models cannot promise that: they edit the whole picture, cannot be limited to one region, and
 * may drift the face, so every candidate has a separate identity decision that must be made by a person before it can be approved.
 */
export const skinViews: ViewSpec[] = (() => {
  const all = viewsFor('character', 'Identity')
  return [all.find((v) => v.key === 'portrait'), all.find((v) => v.key === 'full-front')].filter((v): v is ViewSpec => !!v)
})()

/** The look name the refinement's pictures are filed under, so the original and its approval history are never touched. */
export const skinLookName = (characterName: string) => `${characterName}, refined skin`.slice(0, 80)

export type SkinCapability = { ok: true; limitation: string } | { ok: false; message: string }

/** What the chosen model can do for a refinement. It must take the approved picture as a reference; otherwise it cannot keep the face. */
export function skinCapability(takesReferences: boolean, modelLabel = 'This model'): SkinCapability {
  if (!takesReferences) return { ok: false, message: `${modelLabel} cannot take the approved picture as a reference, so it cannot refine the skin while keeping the face. Choose a model that takes references (Providers), or use the Skin profile to guide new pictures instead.` }
  return { ok: true, limitation: `${modelLabel} edits the whole picture. It cannot be limited to one region, so a candidate can change more than the skin. Compare it with the original before you approve.` }
}

/** Why a refinement cannot start, in plain words, or undefined when it can. Missing references are named, never skipped. */
export function refinementBlocker(input: { style: { family?: string; name?: string; rendering?: string }; state: VariationState; character: ExtractedAsset; identityPicture: string | undefined; capability: SkinCapability }): string | undefined {
  if (!isPhotorealStyle(input.style)) return `This project's style (${input.style.name || 'not set'}) is not photorealistic. Skin refinement is only for photorealistic characters, so a 2D or stylized look is never pushed toward realism.`
  if (!approvedSkin(input.state, input.character.id)) return 'Save and approve the skin profile first. The refinement is made from it.'
  if (!input.identityPicture) return `Approve ${input.character.name}'s front view first (Sheets, Identity). The refinement starts from the approved picture and has nothing to start from without it.`
  if (!input.capability.ok) return input.capability.message
  return undefined
}

/** How the edit instruction opens, by provider family. Only the lead sentence changes; what to preserve and what to refine is the same. These differences in wording are not a verified difference in results. */
export function providerLead(provider: string): string {
  if (provider === 'openai') return 'Using reference image 1 as the exact subject, produce the same photograph with only the skin rendering refined.'
  if (provider === 'gemini' || provider === 'kie') return 'Edit reference image 1: keep the photograph and change only the skin rendering.'
  return 'Using reference image 1, keep the picture as it is and refine only the skin rendering.'
}

export interface SkinPromptInput { style: StyleBible; character: ExtractedAsset; spec: SkinSpec; view: ViewSpec; provider: string; model?: string; notes?: string }

export function skinRefinementPrompt({ style, character, spec, view, provider, model, notes }: SkinPromptInput): string {
  return [
    `Production reference image: ${view.label} of the character ${character.name}, skin refinement of the approved picture.`,
    view.instruction,
    identityFacts(character),
    `Reference image 1 is the approved picture of ${character.name}. It fixes who this is.`,
    providerLead(provider),
    protectLine(spec),
    'Refine only the skin rendering with subtle region-specific texture, restrained highlights, natural tonal variation and age-appropriate fine detail. Preserve soft transitions without smoothing the face into plastic or adding exaggerated pores.',
    skinLine(spec),
    'Do not replace the face, change the apparent age, change the expression, redesign the costume, or change the pose or background.',
    notes ? `Production notes: ${notes}` : '',
    `Visual style bible: ${styleGuidance(style, 'technical')}.`,
    backdropLine('gray', true, ''),
    'Exactly ONE single image of ONE subject in ONE view. Do not make a grid, contact sheet, collage, split-screen or several views side by side.',
    view.fullBody ? 'The entire figure from the top of the head to the soles of the feet must be fully visible with clear margin; nothing cropped.' : closeUpReframeLine,
    // The person's own words about complexion, undertone and makeup count as "a warm look is wanted" when they say so, so a golden undertone is never fought by a neutral-white-balance instruction.
    artifactGuidance(style, model ?? '', [notes, spec.complexion, spec.undertone, spec.makeup].filter(Boolean).join(' ')),
  ].filter(Boolean).join('\n')
}

/** The approved original of the same view for the same character, when there is one, so the comparison is like for like. */
export function originalFor(queue: QueueState, character: ExtractedAsset, viewKey: string): string | undefined {
  const same = queue.jobs.filter((j) => j.assetId === character.id && j.variant === 'Canonical' && j.approved && !!j.outputPath && j.viewKey === viewKey)
  return same.sort((a, b) => b.revision - a.revision || b.updatedAt - a.updatedAt)[0]?.outputPath
}

/** The picture a view is refined from: the approved original of that view when there is one, else the approved front view. */
export function sourceForView(queue: QueueState, character: ExtractedAsset, viewKey: string): string | undefined {
  return originalFor(queue, character, viewKey) ?? anchorFor(queue, { assetId: character.id, variant: 'Canonical' } as ImageJob)
}

export interface SkinRequestInput { style: StyleBible; provider: string; model: string; character: ExtractedAsset; lookName: string; skin: Ref; spec: SkinSpec; sources: Record<string, string>; styleFp?: string; notes?: string }

/** One request per view, each with exactly one reference (the approved original). Nothing is sent until the person presses Generate. */
export function skinRequests(input: SkinRequestInput): JobRequest[] {
  return skinViews.map((v) => {
    const source = input.sources[v.key]
    return {
      assetId: input.character.id, variant: input.lookName, sheetType: 'Identity', viewKey: v.key, label: v.label,
      prompt: skinRefinementPrompt({ style: input.style, character: input.character, spec: input.spec, view: v, provider: input.provider, model: input.model, notes: input.notes }),
      aspect: v.aspect, fullBody: v.fullBody, provider: input.provider as JobRequest['provider'], model: input.model,
      references: [source], useAnchor: false, styleName: input.style.name, ...(input.styleFp ? { styleFp: input.styleFp } : {}),
      variation: { id: input.skin.id, revision: input.skin.revision, role: 'skin-candidate', uses: [{ id: input.character.id, revision: 0, role: 'reference-1-approved-original', path: source }] },
      outputName: (revision: number) => outputName(input.character, input.lookName, 'Identity', v, revision),
    }
  })
}

/**
 * Starts a refinement: a new CANDIDATE revision of the approved skin profile (the approved one is untouched), filed under its own look name, recording which
 * approved picture it was made from. Refuses when there is no approved profile.
 */
export function startSkinRefinement(state: VariationState, input: { character: ExtractedAsset; identityJob?: { id: string; revision: number }; now: string }): { variations: VariationState; ref: Ref; variant: string; spec: SkinSpec } | { error: string } {
  const current = approvedSkin(state, input.character.id)
  if (!current) return { error: 'Save and approve the skin profile first. The refinement is made from it.' }
  const variant = skinLookName(input.character.name)
  const spec: SkinSpec = { ...structuredClone(current.spec), variant, ...(input.identityJob ? { identityJobId: input.identityJob.id, identityRevision: input.identityJob.revision } : {}) }
  const made = addRevision(state, current.ref.id, { spec, now: input.now, parent: current.ref, note: 'Skin refinement candidate' })
  return { variations: made.state, ref: made.ref, variant, spec }
}

export interface Confirmations { identity: boolean; surface: boolean }

/** A candidate can be approved only when a person has confirmed the identity is preserved. A better-looking surface alone never passes it. */
export function canApproveRefinement(c: Confirmations, hasPicture: boolean): { ok: boolean; why: string } {
  if (!hasPicture) return { ok: false, why: 'There is no candidate picture to approve yet.' }
  if (!c.identity) return { ok: false, why: 'Confirm that the face, age, expression and marks are the same as the original. Better-looking skin is not enough on its own.' }
  return { ok: true, why: c.surface ? 'Identity preserved and the surface judged better.' : 'Identity preserved. The surface has not been judged better yet; approve only if you are happy with it.' }
}

/** What the person protected and what is meant to change, as two short lists for the comparison screen. */
export function refinementSummary(spec: SkinSpec): { protectedItems: string[]; intended: string[] } {
  const protectedItems = PROTECT_CHOICES.filter((c) => spec.protect.includes(c.id)).map((c) => c.label)
  const intended = ['Skin texture, highlights and tonal variation, as set in the profile', ...(spec.marks.length ? [`Marks kept where they are: ${spec.marks.map((m) => `${m.what} (${m.where})`).join('; ')}`] : [])]
  return { protectedItems, intended }
}

/** What refinements have cost so far, from the queue's own attempt counts (a retry adds to it and never replaces it). Null when no price is known. */
export function refinementCost(queue: QueueState, skinId: string): { pictures: number; attempts: number; usd: number | null } {
  const jobs = queue.jobs.filter((j) => j.variation?.id === skinId)
  const attempts = jobs.reduce((n, j) => n + j.attempts, 0)
  return { pictures: jobs.length, attempts, usd: queue.perImageUsd === null ? null : Math.round(attempts * queue.perImageUsd * 100) / 100 }
}
