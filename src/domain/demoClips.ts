import type { StyleBible } from './visualDevelopment'

export interface DemoClip {
  id: string
  assetId: string
  assetName: string
  motion: MotionKey
  model: string
  path: string
  prompt: string
  duration: number
  createdAt: number
}

export type MotionKey = 'turntable' | 'walk' | 'idle' | 'poses' | 'custom'

export const motionPresets: Record<Exclude<MotionKey, 'custom'>, { label: string; prompt: string }> = {
  turntable: { label: 'Turnaround: 360° turntable', prompt: 'Slow, smooth 360-degree turntable rotation of the character standing in place, locked-off static camera, full body in frame, plain neutral grey background, even lighting.' },
  walk: { label: 'Walk cycle', prompt: 'The character walks in place at a natural pace in a clean walk cycle, static camera, full body in frame, plain neutral grey background.' },
  idle: { label: 'Idle pose with breathing', prompt: 'The character stands in a relaxed idle pose with subtle breathing and small weight shifts, static camera, full body in frame, plain neutral grey background.' },
  poses: { label: 'Pose sequence', prompt: 'The character moves through three clear poses one after another: a relaxed stand, a confident hand gesture, then a ready crouch. Static camera, full body in frame, plain neutral grey background.' },
}

/** The prompt always repeats the identity rule: a motion demo is only useful if the character stays the same person and costume throughout. */
export function buildMotionPrompt(motion: MotionKey, custom: string, assetName: string, style: StyleBible): string {
  const action = motion === 'custom' ? custom.trim() : motionPresets[motion].prompt
  return [`${assetName}: ${action}`, 'Identity, face, proportions, hair and costume stay exactly the same as the reference image in every frame. No text, no labels, no cuts.', `Visual style: ${style.name}. ${style.rendering}.`].join('\n')
}

export const clipName = (assetId: string, motion: MotionKey) => `${assetId}_${motion}_demo`
