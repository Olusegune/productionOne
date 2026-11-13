import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Users } from 'lucide-react'
import { EmptyState } from './EmptyState'
import { StatTiles } from './StatTiles'
import { Eyebrow } from './Eyebrow'

describe('visual components keep their text for screen readers', () => {
  it('EmptyState hides the art but shows the words', () => {
    const { container } = render(<EmptyState icon={Users} title="No cast yet">Analyze a script first.</EmptyState>)
    expect(screen.getByRole('heading', { name: 'No cast yet' })).toBeTruthy()
    expect(screen.getByText('Analyze a script first.')).toBeTruthy()
    expect(container.querySelector('.empty-art')?.getAttribute('aria-hidden')).toBe('true')
  })
  it('StatTiles reads as a labelled list with singular and plural labels', () => {
    render(<StatTiles scenes={1} characters={4} props={0} sets={2} approved={3} total={9} />)
    const list = screen.getByRole('list', { name: 'Project at a glance' })
    expect(list.textContent).toContain('Scene')
    expect(list.textContent).not.toContain('Scenes')
    expect(list.textContent).toContain('Characters')
    expect(list.textContent).toContain('3/9')
  })
  it('Eyebrow shows its label', () => {
    render(<Eyebrow icon={Users}>CAST</Eyebrow>)
    expect(screen.getByText('CAST')).toBeTruthy()
  })
})
