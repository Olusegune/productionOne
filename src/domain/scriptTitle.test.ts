import { describe, expect, it } from 'vitest'
import { analyzeScript, titleFromScript } from './productionStudio'

describe('naming a project from its script', () => {
  it('names a project that still has a placeholder name, and tidies a title typed in capitals', () => {
    expect(titleFromScript('The Last Horizon', 'THE RENEWAL')).toBe('The Renewal')
    expect(titleFromScript('Untitled production', 'Harbour Lights')).toBe('Harbour Lights')
    expect(titleFromScript('', "KID LANTERN'S SONG")).toBe("Kid Lantern's Song")
  })
  it('never replaces a name the person chose', () => {
    expect(titleFromScript('My own film', 'THE RENEWAL')).toBeUndefined()
  })
  it('does nothing when the script has no title or the name already matches', () => {
    expect(titleFromScript('Untitled production', undefined)).toBeUndefined()
    expect(titleFromScript('Untitled production', '   ')).toBeUndefined()
    expect(titleFromScript('The Last Horizon', 'The Last Horizon')).toBeUndefined()
  })
  it('reads the title from the script the reader analyzed', () => {
    const a = analyzeScript('Title: THE RENEWAL\n\nINT. ROOM - DAY\n\nMARA\nHello.\n')
    expect(titleFromScript('Untitled production', a.story?.title)).toBe('The Renewal')
  })
})
