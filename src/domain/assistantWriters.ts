/**
 * The language models the Assistant can write a script with. Cloud ones need a key saved in Provider Settings; the two local ones run on this computer
 * (or one on the person's own network) and need no key.
 */
export type WriterId = 'google' | 'openai' | 'openrouter' | 'ollama' | 'lmstudio'

export interface WriterOption { id: WriterId; label: string; local: boolean; defaultModel: string; hint: string }

export const writerOptions: WriterOption[] = [
  { id: 'google', label: 'Google Gemini', local: false, defaultModel: 'gemini-2.5-flash', hint: 'Cloud. Uses your Google key.' },
  { id: 'openai', label: 'OpenAI (ChatGPT)', local: false, defaultModel: 'gpt-4o-mini', hint: 'Cloud. Uses your OpenAI key.' },
  { id: 'openrouter', label: 'OpenRouter', local: false, defaultModel: 'google/gemini-2.5-flash', hint: 'Cloud. One key, many models.' },
  { id: 'ollama', label: 'Ollama (on this computer)', local: true, defaultModel: 'gemma3:12b', hint: 'Local. Nothing leaves your computer. Use the name from "ollama list".' },
  { id: 'lmstudio', label: 'LM Studio (on this computer)', local: true, defaultModel: 'local-model', hint: 'Local. Start the LM Studio server and load a model.' },
]

export const isWriterId = (v: unknown): v is WriterId => writerOptions.some((o) => o.id === v)
export const writerOption = (id: string): WriterOption => writerOptions.find((o) => o.id === id) ?? writerOptions[0]

/** Can this writer be tried now? A local one always can (if it is not running, the message says so); a cloud one needs its key. */
export function writerReady(id: string, configured: Record<string, boolean> | undefined): boolean {
  const o = writerOption(id)
  return o.local || !!configured?.[o.id]
}

/** Which writer to start with: the one the person saved if it still works, else the first cloud one with a key, else the first local one. */
export function chooseWriter(saved: string, configured: Record<string, boolean> | undefined): WriterId {
  if (isWriterId(saved) && writerReady(saved, configured)) return saved
  return writerOptions.find((o) => !o.local && configured?.[o.id])?.id ?? (isWriterId(saved) ? saved : 'google')
}
