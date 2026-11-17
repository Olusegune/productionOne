import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { BibleTree } from './bible'
import { emptyQueue } from '../domain/generationQueue'
import type { ExtractedAsset } from '../domain/productionStudio'

const setup = (onAddAsset = vi.fn(), assets: ExtractedAsset[] = []) => {
  render(<BibleTree assets={assets} queue={emptyQueue()} selected={0} onSelect={() => {}} onAddAsset={onAddAsset} />)
  return onAddAsset
}
const openDialog = () => fireEvent.click(screen.getByRole('button', { name: /Add to the bible/ }))
const type = (name: string) => fireEvent.change(screen.getByLabelText('Name for the new asset'), { target: { value: name } })

describe('Add to the production bible', () => {
  it('stays disabled until a name is typed, then adds a character from an image', () => {
    const add = setup()
    expect(screen.queryByLabelText('Name for the new asset')).toBeNull()
    openDialog()
    const button = screen.getByRole('button', { name: /Add from image/ }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    type('Dominic')
    expect(button.disabled).toBe(false)
    fireEvent.click(button)
    expect(add).toHaveBeenCalledWith('character', 'Dominic', '', true)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('passes the chosen gender along, for characters only', () => {
    const add = setup()
    openDialog()
    type('Mara')
    fireEvent.change(screen.getByLabelText('Gender for the new character'), { target: { value: 'female' } })
    fireEvent.click(screen.getByRole('button', { name: /Add from image/ }))
    expect(add).toHaveBeenCalledWith('character', 'Mara', 'female', true)
  })
  it('adds a prop, a set or a costume, with or without an image, and hides gender for them', () => {
    const add = setup()
    openDialog()
    fireEvent.change(screen.getByLabelText('Type of the new asset'), { target: { value: 'set' } })
    expect(screen.queryByLabelText('Gender for the new character')).toBeNull()
    type('Rooftop at night')
    fireEvent.click(screen.getByRole('button', { name: /Add without image/ }))
    expect(add).toHaveBeenCalledWith('set', 'Rooftop at night', '', false)
    openDialog()
    fireEvent.change(screen.getByLabelText('Type of the new asset'), { target: { value: 'prop' } })
    type('Golden microphone')
    fireEvent.click(screen.getByRole('button', { name: /Add from image/ }))
    expect(add).toHaveBeenLastCalledWith('prop', 'Golden microphone', '', true)
  })
  it('always shows Characters, Costumes, Props and Sets, saying None yet for an empty group so nothing seems hidden', () => {
    setup(vi.fn(), [{ id: 'C1', name: 'MARA', type: 'character', sceneIds: [], status: 'planned' } as ExtractedAsset])
    for (const g of ['Characters', 'Costumes', 'Props', 'Sets']) expect(screen.getByRole('heading', { name: new RegExp(g) })).toBeTruthy()
    expect(screen.getAllByText(/None yet/).length).toBe(3)
  })
  it('is absent when the host cannot import images', () => {
    render(<BibleTree assets={[]} queue={emptyQueue()} selected={0} onSelect={() => {}} />)
    expect(screen.queryByRole('button', { name: /Add to the bible/ })).toBeNull()
  })
  it('closes with Escape without adding anything', () => {
    const add = setup()
    openDialog()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(add).not.toHaveBeenCalled()
  })
})
