import type { AssetType, ExtractedAsset } from './productionStudio'
import { relationshipConflicts, relationshipViews } from './relationships'
import { approvedProfiles } from './profiles'
import { regenerationPlan } from './regeneration'
import type { VariationState } from './variations'

/**
 * How the production bible is grouped for browsing: Characters, Assets (costumes and props), Worlds (sets and environments), and the Bible itself, an overview
 * of everything that ties them together. This is only a way of looking: it changes no record and no asset, and the old flat list still works.
 */
export type GroupId = 'characters' | 'assets' | 'worlds'
export type BibleView = GroupId | 'bible'

export const GROUPS: Array<{ id: GroupId; label: string; types: AssetType[]; noun: string }> = [
  { id: 'characters', label: 'Characters', types: ['character'], noun: 'character' },
  { id: 'assets', label: 'Assets', types: ['costume', 'prop'], noun: 'costume or prop' },
  { id: 'worlds', label: 'Worlds', types: ['set', 'environment'], noun: 'set or environment' },
]

export const groupOf = (type: AssetType): GroupId => GROUPS.find((g) => g.types.includes(type))?.id ?? 'assets'

export function groupCounts(assets: ExtractedAsset[]): Record<GroupId, { total: number; approved: number }> {
  const out = { characters: { total: 0, approved: 0 }, assets: { total: 0, approved: 0 }, worlds: { total: 0, approved: 0 } }
  for (const a of assets) { const g = groupOf(a.type); out[g].total += 1; if (a.status === 'approved') out[g].approved += 1 }
  return out
}

/** The group to open first: the one holding the selected asset, otherwise the first group that has anything in it. */
export function startingGroup(assets: ExtractedAsset[], selected: number): GroupId {
  const chosen = assets[selected]
  if (chosen) return groupOf(chosen.type)
  const counts = groupCounts(assets)
  return GROUPS.find((g) => counts[g.id].total > 0)?.id ?? 'characters'
}

export interface BibleOverview {
  style: string
  counts: Record<GroupId, { total: number; approved: number }>
  profiles: Array<{ name: string; level: 'species' | 'faction'; members: string[] }>
  relationships: { total: number; approved: number; needLook: string[]; conflicts: string[] }
  attention: Array<{ name: string; action: string }>
  frozen: { scenes: number; snapshots: number; branches: number }
}

/** Everything that ties the bible together, read from the records: nothing here is stored, so it can never disagree with them. */
export function bibleOverview(input: { assets: ExtractedAsset[]; variations: VariationState; styleName?: string }): BibleOverview {
  const nameOf = (id: string) => input.assets.find((a) => a.id === id)?.name ?? id
  const rel = relationshipViews(input.variations)
  const continuity = Object.values(input.variations.continuity ?? {})
  return {
    style: input.styleName?.trim() || 'No style chosen yet',
    counts: groupCounts(input.assets),
    profiles: approvedProfiles(input.variations).map((p) => ({ name: p.spec.name, level: p.spec.level, members: p.spec.members.map(nameOf) })),
    relationships: {
      total: rel.length,
      approved: rel.filter((r) => r.status === 'approved').length,
      needLook: rel.filter((r) => r.stale).map((r) => r.entity.name),
      conflicts: relationshipConflicts(input.variations, nameOf).map((c) => c.message),
    },
    attention: regenerationPlan(input.variations).steps.map((s) => ({ name: s.name, action: s.action })),
    frozen: { scenes: continuity.length, snapshots: continuity.reduce((n, l) => n + l.length, 0), branches: continuity.reduce((n, l) => n + new Set(l.map((s) => s.branch)).size, 0) },
  }
}
