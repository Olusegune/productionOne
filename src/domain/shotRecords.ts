import { readCamera } from './camera'
import { readLighting } from './lighting'
import type { ShotRecord } from './productionStudio'

/**
 * Reads a saved shot. A shot saved before camera and lighting records existed comes back exactly as it was; damaged camera or lighting records are repaired or
 * dropped (never thrown on), so an old or hand-edited project always opens.
 */
export function normalizeShot(shot: ShotRecord): ShotRecord {
  const { camera, lightingRecord, ...rest } = shot as ShotRecord & { camera?: unknown; lightingRecord?: unknown }
  const cam = camera === undefined ? undefined : readCamera(camera)
  const light = lightingRecord === undefined ? undefined : readLighting(lightingRecord)
  return { ...rest, ...(cam ? { camera: cam } : {}), ...(light ? { lightingRecord: light } : {}) }
}

export const normalizeShots = (shots: unknown): ShotRecord[] => (Array.isArray(shots) ? shots.filter((s): s is ShotRecord => typeof s === 'object' && s !== null && typeof (s as ShotRecord).id === 'string').map(normalizeShot) : [])
