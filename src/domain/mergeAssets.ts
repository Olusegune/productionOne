import type { AnalysisResult, ShotRecord } from './productionStudio'

/**
 * Two headings for one room make two sets. Merging folds one set into another: the scenes and shots that used the dropped set now use the kept one,
 * so they all share its approved picture. Only sets (and environments) can be merged, and only into another set.
 */
export function mergeSets(analysis: AnalysisResult, shots: ShotRecord[], keepId: string, dropId: string): { analysis: AnalysisResult; shots: ShotRecord[] } | undefined {
  const keep = analysis.assets.find((a) => a.id === keepId)
  const drop = analysis.assets.find((a) => a.id === dropId)
  const isSet = (t?: string) => t === 'set' || t === 'environment'
  if (!keep || !drop || keepId === dropId || !isSet(keep.type) || !isSet(drop.type)) return undefined
  const rename = (setting: string) => (setting.toUpperCase() === drop.name.toUpperCase() ? keep.name : setting)
  const sceneIds = [...new Set([...keep.sceneIds, ...drop.sceneIds])]
  return {
    analysis: {
      ...analysis,
      assets: analysis.assets.filter((a) => a.id !== dropId).map((a) => (a.id === keepId ? { ...a, sceneIds } : a)),
      scenes: analysis.scenes.map((s) => ({ ...s, setting: rename(s.setting) })),
      story: analysis.story ? { ...analysis.story, scenes: analysis.story.scenes.map((s) => ({ ...s, setting: rename(s.setting) })) } : analysis.story,
    },
    shots: shots.map((s) => {
      if (s.setAssetId !== dropId && !s.assetIds.includes(dropId)) return s
      const assetIds = [...new Set(s.assetIds.map((id) => (id === dropId ? keepId : id)))]
      return { ...s, assetIds, setAssetId: s.setAssetId === dropId ? keepId : s.setAssetId }
    }),
  }
}
