import type { CameraAngle, Movement, ShotSize } from './direct'

/**
 * Extra camera direction for a shot. These controls GUIDE generated imagery; they do not simulate a physical camera. The existing size, angle, lens and
 * movement fields on a shot stay as they are; this record only adds to them, and a shot without it is unchanged.
 */
export const CAMERA_DISCLAIMER = 'These controls guide the picture an image model draws. They do not simulate a physical camera or lens.'

export type SensorId = 'unspecified' | 'micro-four-thirds' | 'super-35' | 'full-frame' | 'large-format' | 'imax-65'
export type CameraHeight = 'ground' | 'low' | 'chest' | 'eye' | 'high' | 'overhead'
export type DepthOfField = 'unspecified' | 'deep' | 'moderate' | 'shallow'
export type OpticalCharacter = 'none' | 'clean' | 'soft-vintage' | 'anamorphic-feel' | 'wide-distortion-free'

export interface SensorSpec { id: SensorId; label: string; widthMm: number; heightMm: number; assumed?: boolean }

/** Sensor sizes used to turn a focal length into a field of view. "Not set" assumes Super 35 and says so. */
export const sensors: SensorSpec[] = [
  { id: 'unspecified', label: 'Not set (assumes Super 35)', widthMm: 24.89, heightMm: 18.66, assumed: true },
  { id: 'micro-four-thirds', label: 'Micro Four Thirds', widthMm: 17.3, heightMm: 13 },
  { id: 'super-35', label: 'Super 35', widthMm: 24.89, heightMm: 18.66 },
  { id: 'full-frame', label: 'Full frame (35 mm)', widthMm: 36, heightMm: 24 },
  { id: 'large-format', label: 'Large format', widthMm: 54.12, heightMm: 25.58 },
  { id: 'imax-65', label: '65 mm (IMAX-style)', widthMm: 70.41, heightMm: 52.63 },
]
export const sensorFor = (id: SensorId | undefined): SensorSpec => sensors.find((s) => s.id === id) ?? sensors[0]

export const cameraHeights: Array<{ id: CameraHeight; label: string; metres: number }> = [
  { id: 'ground', label: 'Ground level', metres: 0.2 },
  { id: 'low', label: 'Knee height', metres: 0.5 },
  { id: 'chest', label: 'Chest height', metres: 1.2 },
  { id: 'eye', label: 'Eye height', metres: 1.6 },
  { id: 'high', label: 'Above head', metres: 2.5 },
  { id: 'overhead', label: 'Overhead', metres: 5 },
]

export interface CameraDirection {
  /** Camera height above the floor. */
  height?: CameraHeight
  /** Camera to subject, in metres. Optional: only set it when the distance matters. */
  distanceM?: number
  sensor?: SensorId
  /** What the camera is focused on: an asset id, or 'foreground' | 'background'. */
  focusTarget?: string
  dof?: DepthOfField
  optical?: OpticalCharacter
  /** The preset this started from, for the record. Editing a value does not clear it. */
  presetId?: string
}

const rad = (deg: number) => (deg * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI
const r1 = (n: number) => Math.round(n * 10) / 10

/** Horizontal, vertical and diagonal field of view in degrees for a focal length on a sensor: 2 x atan(size / (2 x focal length)). */
export function fieldOfView(focalMm: number, sensor: SensorSpec): { horizontal: number; vertical: number; diagonal: number } {
  const f = Math.max(1, focalMm)
  const diag = Math.hypot(sensor.widthMm, sensor.heightMm)
  return { horizontal: r1(deg(2 * Math.atan(sensor.widthMm / (2 * f)))), vertical: r1(deg(2 * Math.atan(sensor.heightMm / (2 * f)))), diagonal: r1(deg(2 * Math.atan(diag / (2 * f)))) }
}

/** The focal length on a sensor that gives a horizontal field of view; the inverse of fieldOfView. */
export function focalForHorizontalFov(horizontalDeg: number, sensor: SensorSpec): number {
  return Math.round((sensor.widthMm / (2 * Math.tan(rad(Math.min(170, Math.max(1, horizontalDeg))) / 2))) * 10) / 10
}

/** How much of the frame height a subject fills, from where the camera is: f x subject height / (distance x sensor height). Above 1 the subject does not fit. */
export function frameFill(subjectHeightM: number, distanceM: number, focalMm: number, sensor: SensorSpec): number {
  if (distanceM <= 0) return Infinity
  return Math.round(((focalMm * subjectHeightM) / (distanceM * sensor.heightMm)) * 1000) / 1000
}

/** The camera-to-subject distance that makes a subject fill a share of the frame height. */
export function distanceForFill(subjectHeightM: number, fill: number, focalMm: number, sensor: SensorSpec): number {
  return Math.round(((focalMm * subjectHeightM) / (Math.max(0.01, fill) * sensor.heightMm)) * 100) / 100
}

/**
 * Perspective, the relative size of near and far things, is set by where the camera stands, not by the lens: a background object 4 m behind a subject that is
 * 2 m away looks half the subject's size whatever the focal length. A different focal length at the same spot only crops more or less of the same picture.
 * Returns apparent size of the far object relative to the near one (1 means equal, smaller means it looks smaller).
 */
export function perspectiveRatio(nearDistanceM: number, farDistanceM: number): number {
  if (nearDistanceM <= 0 || farDistanceM <= 0) return NaN
  return Math.round((nearDistanceM / farDistanceM) * 1000) / 1000
}

export interface CameraPreset {
  id: string
  label: string
  /** Why you would reach for it. Shown with the preset. */
  purpose: string
  size: ShotSize
  angle: CameraAngle
  height: CameraHeight
  focalMm: number
  dof: DepthOfField
  movement: Movement
  composition: string[]
  optical: OpticalCharacter
}

/** Starting points for a shot. Editable; applying one copies its values into the shot and never locks them. Not equipment emulation. */
export const cameraPresets: CameraPreset[] = [
  { id: 'intimate-dialogue', label: 'Intimate dialogue', purpose: 'Two people close and listening: a medium close-up at eye height, a shallow depth of field, steady.', size: 'MCU', angle: 'eye-level', height: 'eye', focalMm: 50, dof: 'shallow', movement: 'static', composition: ['rule of thirds'], optical: 'clean' },
  { id: 'environment-portrait', label: 'Environmental character portrait', purpose: 'A person inside the place that shapes them: medium wide, the setting readable around them.', size: 'MWS', angle: 'eye-level', height: 'eye', focalMm: 35, dof: 'moderate', movement: 'static', composition: ['depth layers', 'rule of thirds'], optical: 'clean' },
  { id: 'restrained-close-up', label: 'Restrained dramatic close-up', purpose: 'A held close-up for a feeling that stays under the surface; a long-ish lens, no movement.', size: 'CU', angle: 'eye-level', height: 'eye', focalMm: 85, dof: 'shallow', movement: 'static', composition: ['negative space'], optical: 'clean' },
  { id: 'wide-architectural', label: 'Wide architectural establishing frame', purpose: 'Show the whole place and its lines: a wide, level frame with strong geometry.', size: 'WS', angle: 'eye-level', height: 'chest', focalMm: 24, dof: 'deep', movement: 'static', composition: ['symmetry', 'leading lines'], optical: 'wide-distortion-free' },
  { id: 'low-angle-confrontation', label: 'Tense low-angle confrontation', purpose: 'Give one person power over the frame: camera low, looking up, close enough to feel it.', size: 'MS', angle: 'low', height: 'low', focalMm: 28, dof: 'moderate', movement: 'push-in', composition: ['low horizon'], optical: 'clean' },
  { id: 'graphic-tableau', label: 'Graphic symmetrical tableau', purpose: 'A composed, flat, centred picture for a formal or comic effect.', size: 'WS', angle: 'eye-level', height: 'eye', focalMm: 40, dof: 'deep', movement: 'static', composition: ['symmetry', 'frame within frame'], optical: 'none' },
  { id: 'miniature-observation', label: 'Miniature-world observation', purpose: 'Look at a small world from close by and slightly above, as if watching a model.', size: 'MWS', angle: 'high', height: 'high', focalMm: 50, dof: 'shallow', movement: 'static', composition: ['depth layers'], optical: 'soft-vintage' },
  { id: 'handheld-documentary', label: 'Handheld documentary framing', purpose: 'Observed, slightly imperfect framing, medium distance, a hint of movement.', size: 'MS', angle: 'eye-level', height: 'chest', focalMm: 35, dof: 'moderate', movement: 'handheld', composition: ['rule of thirds'], optical: 'soft-vintage' },
]
export const presetById = (id: string): CameraPreset | undefined => cameraPresets.find((p) => p.id === id)

export interface CameraShotFields { size: ShotSize; angle: CameraAngle; lens: number; movement: Movement; composition: string[]; cameraFraming?: string; cameraMovement?: string }

/** The fields a preset sets on a shot (the record and the existing size, angle, lens, movement and composition). Never touches anything else. */
export function applyCameraPreset(preset: CameraPreset): { fields: Pick<CameraShotFields, 'size' | 'angle' | 'lens' | 'movement' | 'composition'>; camera: CameraDirection } {
  return { fields: { size: preset.size, angle: preset.angle, lens: preset.focalMm, movement: preset.movement, composition: [...preset.composition] }, camera: { height: preset.height, dof: preset.dof, optical: preset.optical, presetId: preset.id } }
}

export const dofLine: Record<DepthOfField, string> = { unspecified: '', deep: 'deep focus, foreground to background sharp', moderate: 'moderate depth of field', shallow: 'shallow depth of field, the background softly out of focus' }
export const opticalLine: Record<OpticalCharacter, string> = { none: '', clean: 'clean, sharp optics', 'soft-vintage': 'a soft, vintage lens feel', 'anamorphic-feel': 'a widescreen anamorphic feel with oval highlights', 'wide-distortion-free': 'a wide view with straight lines and no barrel distortion' }

/** The camera words for a prompt. Flat 2D styles get virtual framing and depth layers only: no blur, distortion or lens artefacts. Empty when there is no camera record. */
export function cameraWords(camera: CameraDirection | undefined, focalMm: number, flat2D: boolean, focusName?: string): string {
  if (!camera) return ''
  const parts: string[] = []
  const h = cameraHeights.find((x) => x.id === camera.height)
  if (h) parts.push(`camera at ${h.label.toLowerCase()}`)
  if (camera.distanceM) parts.push(`about ${camera.distanceM} m from the subject`)
  if (flat2D) {
    parts.push('virtual framing (drawn layout, foreground, middle ground and background layers), no photographic blur, lens distortion or lens flare')
  } else {
    const sensor = sensorFor(camera.sensor)
    const fov = fieldOfView(focalMm, sensor)
    parts.push(`a field of view of about ${fov.horizontal} degrees across (${focalMm} mm on ${sensor.assumed ? 'a Super 35 sensor, assumed' : sensor.label})`)
    if (camera.dof && camera.dof !== 'unspecified') parts.push(dofLine[camera.dof])
    if (camera.optical && camera.optical !== 'none') parts.push(opticalLine[camera.optical])
  }
  if (focusName || camera.focusTarget) parts.push(`focus on ${focusName ?? camera.focusTarget}`)
  return parts.length ? `Camera direction (a guide, not a simulation): ${parts.join('; ')}.` : ''
}
