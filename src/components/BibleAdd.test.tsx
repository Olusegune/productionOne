import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { BibleTree } from './bible'
import { emptyQueue } from '../domain/generationQueue'

const setup = (onAddCharacter = vi.fn()) => {
  render(<BibleTree assets={[]} queue={emptyQueue()} selected={0} onSelect={() => {}} onAddCharacter={onAddCharacter} />)
  return onAddCharacter
}
const openDialog = () => fireEvent.click(screen.getByRole('button', { name: /Add character from image/ }))

describe('Add a character from an image', () => {
  it('stays disabled until a name is typed, then hands the name over', () => {
    const add = setup()
    expect(screen.queryByLabelText('Name for the new character')).toBeNull()
    openDialog()
    const button = screen.getByRole('button', { name: /Add from image/ }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Name for the new character'), { target: { value: 'Dominic' } })
    expect(button.disabled).toBe(false)
    fireEvent.click(button)
    expect(add).toHaveBeenCalledWith('Dominic', '')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('passes the chosen gender along', () => {
    const add = setup()
    openDialog()
    fireEvent.change(screen.getByLabelText('Name for the new character'), { target: { value: 'Mara' } })
    fireEvent.change(screen.getByLabelText('Gender for the new character'), { target: { value: 'female' } })
    fireEvent.click(screen.getByRole('button', { name: /Add from image/ }))
    expect(add).toHaveBeenCalledWith('Mara', 'female')
  })
  it('is absent when the host cannot import images', () => {
    render(<BibleTree assets={[]} queue={emptyQueue()} selected={0} onSelect={() => {}} />)
    expect(screen.queryByRole('button', { name: /Add character from image/ })).toBeNull()
  })
  it('closes with Escape without adding anything', () => {
    const add = setup()
    openDialog()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(add).not.toHaveBeenCalled()
  })
})
