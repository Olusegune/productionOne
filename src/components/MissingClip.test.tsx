import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MissingClip } from './MissingClip'
import type { DemoClip } from '../domain/demoClips'

const clip = (extra: Partial<DemoClip>): DemoClip => ({ id: 'AUD-1', assetId: 'CHAR-1', assetName: 'Venomspur', motion: 'custom', model: 'ElevenLabs', path: 'C:/gone/a.mp3', prompt: '', duration: 3, createdAt: 1, missing: true, ...extra })

describe('a clip whose file is gone', () => {
  it('says File missing, keeps the spoken line, and can be removed from the list', () => {
    const onRemove = vi.fn()
    render(<MissingClip clip={clip({ kind: 'audio', line: 'Your renewal is overdue.' })} onRemove={onRemove} />)
    expect(screen.getByText('File missing')).toBeTruthy()
    expect(screen.getByText(/Your renewal is overdue/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Remove from list/ }))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })
  it('describes a video clip as a video', () => {
    render(<MissingClip clip={clip({ kind: 'video' })} onRemove={() => {}} />)
    expect(screen.getByText(/This video clip is not on this computer/)).toBeTruthy()
  })
})
