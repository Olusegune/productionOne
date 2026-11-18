import { describe, expect, it } from 'vitest'
import { DEFAULT_FORMAT, cleanFormat, formatName, isPortrait, projectFormats, sameShape, videoAspectFor } from './formats'
import { aspectRatios } from './sheetSpecs'

describe('project formats', () => {
  it('offers the shapes people make content for, by name', () => {
    expect(projectFormats.map((f) => f.aspect)).toEqual(expect.arrayContaining(['16:9', '21:9', '9:16', '4:5', '1:1']))
    expect(formatName('9:16')).toBe('TikTok / Reels / Shorts')
    expect(formatName('4:3')).toBe('4:3')
    for (const f of projectFormats) expect(aspectRatios as readonly string[]).toContain(f.aspect)
  })
  it('falls back to widescreen for anything that is not a shape', () => {
    expect(DEFAULT_FORMAT).toBe('16:9')
    for (const bad of [undefined, null, 5, '', 'wide', '0:1', '16-9']) expect(cleanFormat(bad)).toBe('16:9')
    expect(cleanFormat('9:16')).toBe('9:16')
    expect(cleanFormat('2.39:1')).toBe('2.39:1')
  })
  it('knows portrait from landscape and when two shapes are the same', () => {
    expect(isPortrait('9:16')).toBe(true)
    expect(isPortrait('4:5')).toBe(true)
    expect(isPortrait('1:1')).toBe(false)
    expect(isPortrait('16:9')).toBe(false)
    expect(sameShape('16:9', '1920:1080')).toBe(true)
    expect(sameShape('16:9', '9:16')).toBe(false)
  })
  it('picks the video shape: the project shape if the model takes it, else the closest', () => {
    expect(videoAspectFor('9:16', ['16:9', '9:16'])).toBe('9:16')
    expect(videoAspectFor('4:5', ['16:9', '9:16', '1:1'])).toBe('1:1')
    expect(videoAspectFor('21:9', ['16:9', '9:16'])).toBe('16:9')
    expect(videoAspectFor('9:16', ['provider-defined'])).toBe('9:16')
  })
})
