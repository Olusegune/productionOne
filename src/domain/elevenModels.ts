export interface CloudModel { id: string; name: string; detail: string }

/** Eleven v3 and every later generation read inline audio tags such as [laughs]. Matched by pattern so a newer model works without an app update. */
export function supportsAudioTags(modelId: string): boolean {
  const m = /^eleven_v(\d+)/.exec(modelId)
  return !!m && Number(m[1]) >= 3
}

/** The fallback used before the account's own model list has loaded, or if it cannot be loaded. */
export const fallbackElevenModel = 'eleven_v4'

const generation = (id: string): number => {
  const m = /^eleven_v(\d+)/.exec(id)
  return m ? Number(m[1]) : -1
}

/** A plain model of the newest generation beats a turbo or realtime variant of it, because those trade quality for speed. */
const variantPenalty = (id: string) => (/turbo|flash|conversational|realtime/i.test(id) ? 1 : 0)

/** Newest generation first, quality models before speed variants, then everything older. */
export function rankElevenModels(models: CloudModel[]): CloudModel[] {
  return [...models].sort((a, b) => generation(b.id) - generation(a.id) || variantPenalty(a.id) - variantPenalty(b.id) || a.id.localeCompare(b.id))
}

/** The id to use when the person leaves the model on "Latest": the newest model their account lists, else the known fallback. */
export function latestElevenModel(models: CloudModel[]): string {
  const best = rankElevenModels(models.filter((m) => generation(m.id) >= 0))[0]
  return best?.id ?? fallbackElevenModel
}
