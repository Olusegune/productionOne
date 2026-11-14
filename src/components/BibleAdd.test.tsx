import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { BibleTree } from './bible'
import { emptyQueue } from '../domain/generationQueue'

const setup = (onAddCharacter = vi.fn()) => {
  render(<BibleTree assets={[]} queue={emptyQueue()} selected={0} onSelect={() => {}} onAddCharacter={onAddCharacter} />)
  return onAddCharacter
}

describe('Add a character from an image', () => {
  it('stays disabled until a name is typed, then hands the name over', () => {
    const add = setup()
    const button = screen.getByRole('button', { name: /Add from image/ }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Name for the new character'), { target: { value: 'Dominic' } })
    expect(button.disabled).toBe(false)
    fireEvent.click(button)
    expect(add).toHaveBeenCalledWith('Dominic')
    expect((screen.getByLabelText('Name for the new character') as HTMLInputElement).value).toBe('')
  })
  it('is absent when the host cannot import images', () => {
    render(<BibleTree assets={[]} queue={emptyQueue()} selected={0} onSelect={() => {}} />)
    expect(screen.queryByRole('button', { name: /Add from image/ })).toBeNull()
  })
})
