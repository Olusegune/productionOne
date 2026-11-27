/**
 * Notes and errors that come from the app's own engine are written for developers: they can hold a long folder path, an operating-system message, or both.
 * A person needs a sentence that says what happened and what to do. This turns the known ones into that and, for the rest, shortens any folder path to the
 * file name so a note can never be made unreadable (or widen a card) by a path.
 */
const OUTSIDE = /Only images in the Production One assets folder/i
const CONTEXT = /exceeds the available context size|context (?:length|window|size)/i
const UNREACHABLE = /could not be reached|connection refused|error sending request/i
const NOT_OPENED = /Could not open the image|cannot find the (?:file|path)|no such file|os error 2\b/i

// Folder names may hold spaces ("Production One"); the file name at the end may not. Each folder is followed by a slash, so ordinary words are not swallowed.
const WINDOWS_PATH = /(?:\\\\\?\\)?[A-Za-z]:[\\/](?:[^\\/:*?"<>|\r\n]+[\\/])*([^\\/:*?"<>|\r\n\s)]+)/g
const UNIX_PATH = /\/(?:Users|home|var|tmp|private)\/(?:[^/:*?"<>|\r\n]+\/)*([^/:*?"<>|\r\n\s)]+)/g

/** A Windows or Unix path inside a longer text, as the file name only. */
export function shortenPaths(text: string): string {
  return text.replace(WINDOWS_PATH, '$1').replace(UNIX_PATH, '$1')
}

export function plainNote(text: string): string {
  const colon = /^(Automatic checks could not run:)\s*/i.exec(text)
  const prefix = colon ? 'The automatic checks could not run. ' : ''
  const body = colon ? text.slice(colon[0].length) : text
  if (OUTSIDE.test(body)) return `${prefix}This picture's file is stored outside the Production One folder, so it cannot be opened or checked. Bring it into the project with “Use my image”, or make the view again.`
  if (CONTEXT.test(body)) return `${prefix}The local model's memory is too small for this question. Pictures are shrunk before they are sent; if this keeps happening, raise the model's context size in Ollama or LM Studio.`
  if (UNREACHABLE.test(body)) return `${prefix}The local model could not be reached. Check that Ollama or LM Studio is running (Local AI).`
  if (NOT_OPENED.test(body)) return `${prefix}The picture's file could not be opened. It may have been moved or deleted: use “Use my image” to bring it back, or make the view again.`
  const short = shortenPaths(body).replace(/\s+/g, ' ').trim()
  const cut = short.length > 240 ? `${short.slice(0, 237)}...` : short
  return `${colon ? 'The automatic checks could not run: ' : ''}${cut}`
}
