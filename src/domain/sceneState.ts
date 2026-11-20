/**
 * Scene state: where things are in a scene, kept as WORLD-SPACE relationships (top-down, in metres) and separate from SCREEN-SPACE composition (what a given
 * camera sees). Moving or re-aiming the camera for a shot changes only that shot's camera record; it can never change who owns a chair, where a character
 * stands or how the furniture is laid out. Movement between shots is an explicit change with a reason.
 */
export type ThingKind = 'character' | 'furniture' | 'prop' | 'landmark'
export type Posture = 'standing' | 'seated' | 'kneeling' | 'lying' | 'walking' | 'leaning'
export type Zone = 'foreground' | 'midground' | 'background'

export interface Thing {
  /** The stable asset id (CHAR-001, PROP-002, SET-001...). */
  id: string
  kind: ThingKind
  name: string
  /** Top-down position in metres. */
  x: number
  y: number
  /** Direction the thing faces, degrees: 0 faces up the page (away from the audience), 90 faces right. */
  facing: number
  posture?: Posture
  /** A seated character: the id of the furniture they occupy. */
  occupies?: string
  /** Furniture or a prop: the character it belongs to. */
  ownedBy?: string
  /** What may be done with it ("sit", "open", "carry"...). */
  interactions: string[]
  /** Overall size multiplier, 1 = life size for this scene. */
  scale: number
  zone?: Zone
}

export type Relation = 'left-of' | 'right-of' | 'in-front-of' | 'behind' | 'next-to' | 'on'
export interface Relationship { a: string; b: string; relation: Relation; distanceM?: number }

export interface World { things: Thing[]; relationships: Relationship[] }

export interface Camera { x: number; y: number; facing: number; /** Horizontal field of view in degrees. */ fov: number }

/** An intentional change between shots: from this shot on, this thing is different. */
export interface WorldChange { shotId: string; thingId: string; patch: Partial<Pick<Thing, 'x' | 'y' | 'facing' | 'posture' | 'occupies' | 'ownedBy' | 'zone' | 'scale'>>; reason: string }

export interface SceneState {
  sceneId: string
  revision: number
  /** The layout the scene starts with. */
  world: World
  changes: WorldChange[]
  /** Camera per shot id. Separate from the world on purpose. */
  cameras: Record<string, Camera>
}

export const emptySceneState = (sceneId: string): SceneState => ({ sceneId, revision: 1, world: { things: [], relationships: [] }, changes: [], cameras: {} })

const round = (n: number) => Math.round(n * 100) / 100
const clone = <T,>(v: T): T => structuredClone(v)

export function addThing(s: SceneState, thing: Omit<Thing, 'interactions' | 'scale'> & Partial<Pick<Thing, 'interactions' | 'scale'>>): SceneState {
  if (s.world.things.some((t) => t.id === thing.id)) return s
  return { ...s, revision: s.revision + 1, world: { ...s.world, things: [...s.world.things, { interactions: [], scale: 1, ...thing }] } }
}

/** Moves a thing in the starting layout (the scene's base). To move it between shots, use `moveBetweenShots`. */
export function placeThing(s: SceneState, id: string, patch: Partial<Pick<Thing, 'x' | 'y' | 'facing' | 'posture' | 'zone' | 'scale'>>): SceneState {
  if (!s.world.things.some((t) => t.id === id)) return s
  return { ...s, revision: s.revision + 1, world: { ...s.world, things: s.world.things.map((t) => (t.id === id ? { ...t, ...patch, x: round(patch.x ?? t.x), y: round(patch.y ?? t.y) } : t)) } }
}

/** Seats a character on a piece of furniture. The furniture's owner is not changed. A chair can hold one person. */
export function seat(s: SceneState, characterId: string, furnitureId: string): { state: SceneState; ok: true } | { state: SceneState; ok: false; error: string } {
  const who = s.world.things.find((t) => t.id === characterId)
  const what = s.world.things.find((t) => t.id === furnitureId)
  if (!who || who.kind !== 'character') return { state: s, ok: false, error: 'Only a character can sit.' }
  if (!what || what.kind !== 'furniture') return { state: s, ok: false, error: 'That is not a piece of furniture.' }
  const taken = s.world.things.find((t) => t.id !== characterId && t.occupies === furnitureId)
  if (taken) return { state: s, ok: false, error: `${what.name} is already taken by ${taken.name}.` }
  return { state: { ...s, revision: s.revision + 1, world: { ...s.world, things: s.world.things.map((t) => (t.id === characterId ? { ...t, occupies: furnitureId, posture: 'seated', x: what.x, y: what.y, facing: what.facing } : t)) } }, ok: true }
}

export function assignOwner(s: SceneState, thingId: string, ownerId: string | undefined): SceneState {
  if (!s.world.things.some((t) => t.id === thingId)) return s
  return { ...s, revision: s.revision + 1, world: { ...s.world, things: s.world.things.map((t) => (t.id === thingId ? (ownerId ? { ...t, ownedBy: ownerId } : (({ ownedBy: _o, ...rest }) => rest)(t)) : t)) } }
}

/** The camera for one shot. It touches the cameras record only: the world is returned untouched (same object). */
export function setShotCamera(s: SceneState, shotId: string, camera: Camera): SceneState {
  return { ...s, cameras: { ...s.cameras, [shotId]: { ...camera, x: round(camera.x), y: round(camera.y) } } }
}

/** An intentional change of the world from a shot onward. A reason is required, so a thing never moves without somebody saying why. */
export function moveBetweenShots(s: SceneState, change: WorldChange): { state: SceneState; ok: true } | { state: SceneState; ok: false; error: string } {
  if (!change.reason.trim()) return { state: s, ok: false, error: 'Say why it moves: movement between shots is a deliberate change.' }
  if (!s.world.things.some((t) => t.id === change.thingId)) return { state: s, ok: false, error: 'That thing is not in this scene.' }
  return { state: { ...s, revision: s.revision + 1, changes: [...s.changes, { ...change, reason: change.reason.trim() }] }, ok: true }
}

/** The world as it is at a shot: the starting layout plus every change made at or before that shot, in shot order. */
export function worldAtShot(s: SceneState, shotId: string, shotOrder: string[]): World {
  const at = shotOrder.indexOf(shotId)
  const world = clone(s.world)
  for (const c of s.changes) {
    const when = shotOrder.indexOf(c.shotId)
    if (when < 0 || (at >= 0 && when > at)) continue
    world.things = world.things.map((t) => (t.id === c.thingId ? { ...t, ...c.patch } : t))
  }
  return world
}

export type Lateral = 'far-left' | 'left' | 'center' | 'right' | 'far-right' | 'out-of-frame' | 'behind-camera'

export interface ScreenPlacement { thingId: string; lateral: Lateral; /** Distance in front of the camera, metres. */ depthM: number; zone: Zone; /** Facing relative to the camera: toward, away, left or right. */ facing: 'toward-camera' | 'away-from-camera' | 'screen-left' | 'screen-right' }

const rad = (d: number) => (d * Math.PI) / 180

/**
 * Screen-space composition, derived (never stored) from the world and one camera: where each thing lands left to right and near to far. Camera facing 0 looks up
 * the page; x grows to the right.
 */
export function screenPlacement(world: World, camera: Camera, thingId: string): ScreenPlacement | undefined {
  const t = world.things.find((x) => x.id === thingId)
  if (!t) return undefined
  const fx = Math.sin(rad(camera.facing)), fy = -Math.cos(rad(camera.facing)) // forward, with y growing downward on the page
  const rx = Math.cos(rad(camera.facing)), ry = Math.sin(rad(camera.facing))
  const dx = t.x - camera.x, dy = t.y - camera.y
  const depth = dx * fx + dy * fy
  const side = dx * rx + dy * ry
  const rel = ((t.facing - camera.facing) % 360 + 540) % 360 - 180 // -180..180, 0 = same way the camera looks (facing away from it)
  const facing = Math.abs(rel) <= 45 ? 'away-from-camera' : Math.abs(rel) >= 135 ? 'toward-camera' : rel > 0 ? 'screen-right' : 'screen-left'
  const base = { thingId, depthM: round(depth), facing } as const
  if (depth <= 0.05) return { ...base, lateral: 'behind-camera', zone: 'foreground' }
  const angle = (Math.atan2(side, depth) * 180) / Math.PI
  const half = camera.fov / 2
  const lateral: Lateral = Math.abs(angle) > half ? 'out-of-frame' : angle < -half * 0.6 ? 'far-left' : angle < -half * 0.2 ? 'left' : angle <= half * 0.2 ? 'center' : angle <= half * 0.6 ? 'right' : 'far-right'
  return { ...base, lateral, zone: depth < 2.5 ? 'foreground' : depth < 7 ? 'midground' : 'background' }
}

export interface WorldIssue { kind: 'chair-taken' | 'chair-not-owned' | 'seated-without-chair' | 'chair-moved'; thingId: string; message: string }

/** Problems in a layout that are about the world itself, not about any picture: two people on one chair, a seat that is not where its sitter is, and so on. */
export function worldIssues(w: World): WorldIssue[] {
  const out: WorldIssue[] = []
  for (const c of w.things.filter((t) => t.kind === 'character')) {
    if (c.posture === 'seated' && !c.occupies) out.push({ kind: 'seated-without-chair', thingId: c.id, message: `${c.name} is seated but has no chair.` })
    if (c.occupies) {
      const chair = w.things.find((t) => t.id === c.occupies)
      if (!chair) out.push({ kind: 'seated-without-chair', thingId: c.id, message: `${c.name} sits on something that is not in the scene.` })
      else {
        if (chair.ownedBy && chair.ownedBy !== c.id) out.push({ kind: 'chair-not-owned', thingId: c.id, message: `${c.name} sits in ${chair.name}, which is assigned to ${w.things.find((t) => t.id === chair.ownedBy)?.name ?? chair.ownedBy}.` })
        if (Math.hypot(chair.x - c.x, chair.y - c.y) > 0.6) out.push({ kind: 'chair-moved', thingId: c.id, message: `${c.name} is not where ${chair.name} is.` })
      }
    }
  }
  const byChair = new Map<string, Thing[]>()
  for (const c of w.things.filter((t) => t.occupies)) byChair.set(c.occupies!, [...(byChair.get(c.occupies!) ?? []), c])
  for (const [chair, sitters] of byChair) if (sitters.length > 1) for (const s of sitters) out.push({ kind: 'chair-taken', thingId: s.id, message: `${sitters.map((x) => x.name).join(' and ')} are both on ${w.things.find((t) => t.id === chair)?.name ?? chair}.` })
  return out
}

/** What changed between two worlds that no recorded change explains. Used to catch a thing that drifted from shot to shot. */
export function unexplainedDrift(before: World, after: World, explained: Set<string>): Array<{ thingId: string; what: string }> {
  const out: Array<{ thingId: string; what: string }> = []
  for (const b of before.things) {
    const a = after.things.find((t) => t.id === b.id)
    if (!a || explained.has(b.id)) continue
    if (Math.hypot(a.x - b.x, a.y - b.y) > 0.05) out.push({ thingId: b.id, what: `${b.name} moved from (${b.x}, ${b.y}) to (${a.x}, ${a.y})` })
    if (a.occupies !== b.occupies) out.push({ thingId: b.id, what: `${b.name} changed seats` })
    if (a.ownedBy !== b.ownedBy) out.push({ thingId: b.id, what: `${b.name} changed owner` })
  }
  return out
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const KINDS: ThingKind[] = ['character', 'furniture', 'prop', 'landmark']
const POSTURES: Posture[] = ['standing', 'seated', 'kneeling', 'lying', 'walking', 'leaning']
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)

/** Reads saved scene states. Damaged records are dropped; nothing throws. */
export function readSceneStates(raw: unknown): Record<string, SceneState> {
  if (!isObject(raw)) return {}
  const out: Record<string, SceneState> = {}
  for (const [sceneId, v] of Object.entries(raw)) {
    if (!isObject(v) || !isObject(v.world) || !Array.isArray(v.world.things)) continue
    const things: Thing[] = []
    for (const t of v.world.things) {
      if (!isObject(t) || typeof t.id !== 'string' || typeof t.name !== 'string' || !KINDS.includes(t.kind as ThingKind)) continue
      things.push({ id: t.id, name: t.name.slice(0, 80), kind: t.kind as ThingKind, x: num(t.x, 0), y: num(t.y, 0), facing: num(t.facing, 0), scale: num(t.scale, 1), interactions: Array.isArray(t.interactions) ? t.interactions.filter((i): i is string => typeof i === 'string').slice(0, 12) : [], ...(POSTURES.includes(t.posture as Posture) ? { posture: t.posture as Posture } : {}), ...(typeof t.occupies === 'string' ? { occupies: t.occupies } : {}), ...(typeof t.ownedBy === 'string' ? { ownedBy: t.ownedBy } : {}) })
    }
    const cameras: Record<string, Camera> = {}
    if (isObject(v.cameras)) for (const [shot, c] of Object.entries(v.cameras)) if (isObject(c)) cameras[shot] = { x: num(c.x, 0), y: num(c.y, 0), facing: num(c.facing, 0), fov: Math.min(170, Math.max(5, num(c.fov, 40))) }
    const changes: WorldChange[] = Array.isArray(v.changes) ? v.changes.filter((c): c is Record<string, unknown> => isObject(c) && typeof c.shotId === 'string' && typeof c.thingId === 'string' && typeof c.reason === 'string' && isObject(c.patch)).map((c) => ({ shotId: c.shotId as string, thingId: c.thingId as string, reason: c.reason as string, patch: c.patch as WorldChange['patch'] })) : []
    out[sceneId] = { sceneId, revision: Math.max(1, Math.round(num(v.revision, 1))), world: { things, relationships: [] }, changes, cameras }
  }
  return out
}
