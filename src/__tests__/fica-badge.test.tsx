import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FicaBadge } from '@/components/ui/fica-badge'

describe('FicaBadge', () => {
  it('renders "Not Compliant" with error colour classes for not_compliant', () => {
    const { container } = render(<FicaBadge status="not_compliant" />)
    const badge = container.querySelector('span')
    expect(badge).toBeTruthy()
    expect(badge!.textContent).toBe('Not Compliant')
    expect(badge!.className).toContain('error')
  })

  it('renders "Partially Compliant" with warning colour classes for partially_compliant', () => {
    const { container } = render(<FicaBadge status="partially_compliant" />)
    const badge = container.querySelector('span')
    expect(badge).toBeTruthy()
    expect(badge!.textContent).toBe('Partially Compliant')
    expect(badge!.className).toContain('warning')
  })

  it('renders "Compliant" with success colour classes for compliant', () => {
    const { container } = render(<FicaBadge status="compliant" />)
    const badge = container.querySelector('span')
    expect(badge).toBeTruthy()
    expect(badge!.textContent).toBe('Compliant')
    expect(badge!.className).toContain('success')
  })

  it('falls back to not_compliant for unknown status', () => {
    const { container } = render(<FicaBadge status="unknown_status" />)
    const badge = container.querySelector('span')
    expect(badge!.textContent).toBe('Not Compliant')
  })
})
