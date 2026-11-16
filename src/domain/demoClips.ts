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
  /** Absent on older projects: those are videos. Audio clips are voice or sound auditions. */
  kind?: 'video' | 'audio'
  /** For audio: the spoken line or sound brief. */
  line?: string
  /** Set when the file is not on this computer (a project opened elsewhere). The record stays so the prompt or line is not lost. */
  missing?: boolean
}

export type MotionKey = 'turntable' | 'walk' | 'idle' | 'poses' | 'custom' | 'speak' | 'emote' | 'run' | 'drive' | 'startup' | 'door' | 'handle'

export const motionPresets: Record<Exclude<MotionKey, 'custom' | AuditionMotion>, { label: string; prompt: string }> = {
  turntable: { label: 'Turnaround: 360° turntable', prompt: 'One complete, slow, smooth 360-degree turntable rotation of the character standing in place: starts facing the camera, turns steadily through the side view to the back view and on round to face the camera again by the end. Locked-off static camera, full body in frame, one flat uniform neutral grey background with no floor line and no cast shadow, even shadowless lighting. Keep the face, expression and every costume detail exactly as in the reference image for the whole turn.' },
  walk: { label: 'Walk cycle', prompt: 'The character walks in place at a natural pace in a clean walk cycle, static camera, full body in frame, plain neutral grey background.' },
  idle: { label: 'Idle pose with breathing', prompt: 'The character stands in a relaxed idle pose with subtle breathing and small weight shifts, static camera, full body in frame, plain neutral grey background.' },
  poses: { label: 'Pose sequence', prompt: 'The character moves through three clear poses one after another: a relaxed stand, a confident hand gesture, then a ready crouch. Static camera, full body in frame, plain neutral grey background.' },
}

/** The prompt always repeats the identity rule: a motion demo is only useful if the character stays the same person and costume throughout. */
export function buildMotionPrompt(motion: MotionKey, custom: string, assetName: string, style: StyleBible, identity = ''): string {
  const action = motion === 'custom' ? custom.trim() : presetFor(motion).prompt
  return [`${assetName}: ${action}`, identity, 'Identity, face, proportions, hair and costume stay exactly the same as the reference image in every frame. Real-time speed, no slow motion. No text, no labels, no cuts.', `Visual style: ${style.name}. ${style.rendering}.`].filter(Boolean).join('\n')
}

export const clipName = (assetId: string, motion: MotionKey) => `${assetId}_${motion}_demo`

// ---- Audition presets (0.16.0): how a character or prop moves. Each repeats the identity rule through buildMotionPrompt. ----
export const auditionMotions = {
  speak: { label: 'Speaks to camera', prompt: 'The character looks into the camera and speaks a short sentence with natural lip movement, head and shoulder motion, static medium close-up, plain neutral background.' },
  emote: { label: 'Emotion beat', prompt: 'The character shifts from a neutral face to a clear emotional reaction and back, readable in the eyes and brows, static medium close-up, plain neutral background.' },
  run: { label: 'Run', prompt: 'The character runs in place with believable balance and arm swing, static camera, full body in frame, plain neutral grey background.' },
  drive: { label: 'Drive past', prompt: 'The vehicle drives past the camera at moderate speed along a plain road, side-on tracking shot, wheels turning, suspension reacting, no other vehicles.' },
  startup: { label: 'Start up and idle', prompt: 'The vehicle starts up and idles, small body vibration, lights switching on, static three-quarter front camera, plain neutral background.' },
  door: { label: 'Open and close', prompt: 'A door, lid or panel of the object opens fully and closes again with realistic weight, hinges and latch, static camera, plain neutral background.' },
  handle: { label: 'Handled by hand', prompt: 'A hand picks the object up, turns it to show every side, and sets it down, static camera, plain neutral background.' },
} as const
export type AuditionMotion = keyof typeof auditionMotions

/** Which motion tests make sense for what kind of asset. A car is never asked to "walk". */
export function motionKeysFor(type: string, name = ''): Array<MotionKey | AuditionMotion> {
  const vehicle = /\b(car|truck|van|bus|bike|bicycle|motorcycle|taxi|cab|jeep|train|boat|ship|plane|jet|helicopter|tractor|scooter|vehicle)\b/i.test(name)
  if (type === 'character') return ['turntable', 'idle', 'walk', 'run', 'speak', 'emote', 'poses']
  if (type === 'prop' && vehicle) return ['turntable', 'drive', 'startup', 'door']
  if (type === 'prop') return ['turntable', 'handle', 'door']
  return ['turntable', 'idle', 'poses']
}
export const isVehicleName = (name: string) => /\b(car|truck|van|bus|bike|bicycle|motorcycle|taxi|cab|jeep|train|boat|ship|plane|jet|helicopter|tractor|scooter|vehicle)\b/i.test(name)

export const presetFor = (key: Exclude<MotionKey, 'custom'>): { label: string; prompt: string } => (key in motionPresets ? motionPresets[key as keyof typeof motionPresets] : auditionMotions[key as AuditionMotion])
