import type { CatalogModel, ProviderKey } from './imageCatalog'

/** Picks a model that accepts reference images, so every view of a character can be made from its approved front view.
 *  Prefers the same provider (its key is already set up), then a model the person has a key for, then well-known editing models first. */
export function suggestReferenceModel(
  catalog: CatalogModel[],
  current: { provider: ProviderKey; modelId: string },
  configured: Record<string, boolean>,
): CatalogModel | undefined {
  const usable = catalog.filter((m) => m.references && (configured[m.provider] || m.provider === 'comfyui'))
  const rank = (m: CatalogModel) =>
    (m.provider === current.provider ? 0 : 10) +
    (/nano-?banana/i.test(m.id) ? 0 : /character|edit|image-to-image/i.test(m.id) ? 1 : 2) +
    (m.source === 'built-in' ? 0 : 0.5)
  return [...usable].sort((a, b) => rank(a) - rank(b))[0]
}

export type AnchorStatus =
  | { kind: 'no-references'; message: string }
  | { kind: 'waiting-for-anchor'; message: string }
  | { kind: 'locked'; message: string }

/** What the person needs to know about identity locking right now, in plain words. */
export function anchorStatus(input: { takesReferences: boolean; anchorPath?: string; anchorLabel?: string }): AnchorStatus {
  if (!input.takesReferences) {
    return { kind: 'no-references', message: 'This model cannot see reference images, so each view is drawn from the text alone and the face, hair and costume will drift between views.' }
  }
  if (!input.anchorPath) {
    return { kind: 'waiting-for-anchor', message: 'Generate and approve the front view first. Every other view then uses it as the reference so the character stays the same person.' }
  }
  return { kind: 'locked', message: `Locked to the approved ${input.anchorLabel ?? 'front view'}: it is sent with every other view of this sheet.` }
}

/** Added to a view's prompt when a reference image travels with it. */
export const anchoredPromptLine = 'The attached reference image is this exact same subject: keep precisely the same face, hair, skin tone, age, body build, costume colours and details. Change only the pose, angle or expression this view asks for.'
