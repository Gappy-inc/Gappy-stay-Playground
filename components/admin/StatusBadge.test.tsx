import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from './StatusBadge'

describe('<StatusBadge />', () => {
  it('renders pending with yellow palette', () => {
    render(<StatusBadge status="pending" />)
    const el = screen.getByRole('status', { name: /Request status: Pending/i })
    expect(el).toHaveTextContent('Pending')
    expect(el.className).toMatch(/bg-yellow-100/)
  })

  it('renders approved with green palette', () => {
    render(<StatusBadge status="approved" />)
    const el = screen.getByRole('status', { name: /Request status: Approved/i })
    expect(el).toHaveTextContent('Approved')
    expect(el.className).toMatch(/bg-green-100/)
  })

  it('renders rejected with red palette', () => {
    render(<StatusBadge status="rejected" />)
    const el = screen.getByRole('status', { name: /Request status: Rejected/i })
    expect(el).toHaveTextContent('Rejected')
    expect(el.className).toMatch(/bg-red-100/)
  })
})
