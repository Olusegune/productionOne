/** Cloud voice lists stay for the session, so switching engine or character does not make the person press "Load my voices" again. Each list is keyed by provider. */
const lists = new Map<string, unknown[]>()

export function cachedVoices<T>(providerId: string): T[] {
  return (lists.get(providerId) as T[] | undefined) ?? []
}

export function rememberVoices<T>(providerId: string, list: T[]): void {
  lists.set(providerId, list)
}

export function forgetVoices(providerId?: string): void {
  if (providerId) lists.delete(providerId)
  else lists.clear()
}
