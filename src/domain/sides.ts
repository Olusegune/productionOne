/**
 * Left and right in a prompt. A person writes "the left arm" meaning the character's own left. A model reads a front view and may put "left" on the left of the
 * picture, which is the character's right. So whenever a prompt's own text mentions left or right, it also says which is meant and where that lands in the picture.
 */
export const mentionsSide = (...texts: Array<string | undefined>): boolean => /\b(left|right)\b/i.test(texts.filter(Boolean).join(' '))

/** Shown beside the settings whenever a side is named: the prompt asks for the right side but a model can still get it wrong, so a person checks. */
export const sideCheckWarning = 'You named a side (left or right). The prompt says which side is meant, but image models often put it on the wrong side, especially on the body and face. Check it in the candidate, and say it in picture terms if it is wrong (for example “on the right of the picture”).'

/** For a view where the character faces the camera (front, three-quarter front, portrait) their left is on the right of the picture. */
export const facingCameraSideLine = 'Left and right here always mean the character’s own left and right, not the left and right of the picture. The character faces the camera, so their left side is on the RIGHT of the picture and their right side is on the LEFT.'

/** For a view from behind, the character's left is on the left of the picture. */
export const facingAwaySideLine = 'Left and right here always mean the character’s own left and right, not the left and right of the picture. The character is seen from behind, so their left side is on the LEFT of the picture and their right side is on the RIGHT.'

/** The line to add for a view, or an empty string when the view's own text names no side. */
export function sideLineFor(viewKey: string, ...texts: Array<string | undefined>): string {
  if (!mentionsSide(...texts)) return ''
  return /rear|back/.test(viewKey) ? facingAwaySideLine : facingCameraSideLine
}
