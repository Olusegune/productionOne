import { describe, expect, it } from 'vitest'
import { plainNote, shortenPaths } from './plainNote'

// The text a person actually saw in the app, with its two long paths.
const OUTSIDE_RAW = 'Automatic checks could not run: Only images in the Production One assets folder can be previewed (this one is at \\\\?\\C:\\Users\\eduni\\AppData\\Local\\Packages\\Claude_pzs8sxrjxfjjc\\LocalCache\\Roaming\\com.productionguy.studio.livetest\\assets\\CHAR-KAEL-008_KAEL_Canonical_Identity_full-front_v01.jpg, the folder is \\\\?\\C:\\Users\\eduni\\AppData\\Roaming\\com.productionguy.studio.livetest\\assets)'

describe('notes are written for a person', () => {
  it('turns "outside the folder" into a sentence with what to do, and no path', () => {
    const t = plainNote(OUTSIDE_RAW)
    expect(t).toMatch(/stored outside the Production One folder, so it cannot be opened or checked/)
    expect(t).toMatch(/Use my image/)
    expect(t).not.toMatch(/Users|AppData|\\/)
    expect(t.length).toBeLessThan(260)
  })

  it('explains a file that could not be opened', () => {
    expect(plainNote('Automatic checks could not run: Could not open the image: The system cannot find the path specified. (os error 3)')).toMatch(/could not be opened. It may have been moved or deleted/)
    expect(plainNote('Could not open the image: No such file or directory (os error 2)')).toMatch(/could not be opened/)
  })

  it('shortens any other path to the file name and keeps the rest of the message', () => {
    const t = plainNote('Automatic checks could not run: Failed to decode C:\\Users\\eduni\\Documents\\Production One\\a b\\very\\deep\\picture_v01.png because the header is wrong')
    expect(t).toBe('The automatic checks could not run: Failed to decode picture_v01.png because the header is wrong')
  })

  it('explains a local model that is out of memory, or not running', () => {
    expect(plainNote('Ollama request failed (400): request (4183 tokens) exceeds the available context size (4096 tokens), try increasing it')).toMatch(/memory is too small for this question. Pictures are shrunk before they are sent/)
    expect(plainNote('Ollama could not be reached: error sending request for url (http://127.0.0.1:11434/api/chat)')).toMatch(/could not be reached. Check that Ollama or LM Studio is running/)
  })

  it('leaves an ordinary note alone and cuts a very long one', () => {
    expect(plainNote('Resolution 896x1200 is below 1024 on the long edge.')).toBe('Resolution 896x1200 is below 1024 on the long edge.')
    expect(plainNote('x'.repeat(400)).length).toBeLessThanOrEqual(240)
  })

  it('shortens Windows, extended-length and Unix paths', () => {
    expect(shortenPaths('see C:\\a\\b\\c.png now')).toBe('see c.png now')
    expect(shortenPaths('see \\\\?\\C:\\a\\b\\c.png now')).toBe('see c.png now')
    expect(shortenPaths('see /Users/me/stuff/c.png now')).toBe('see c.png now')
    expect(shortenPaths('no path here')).toBe('no path here')
  })
})
