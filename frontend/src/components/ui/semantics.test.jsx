import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { EventCard } from '@/components/events/EventCard'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { ThemeProvider } from '@/features/theme/ThemeProvider'
import { Card } from './Surface'

// B25IT405 Full-stack Web Technologies: semantic HTML5 elements.

const event = {
  id: 7, title: 'Hack Night', date: '2030-03-04', startTime: '18:00', endTime: '20:00', category: 'TECHNICAL',
  status: 'PUBLISHED', club: { name: 'Coding Club' }, venue: { name: 'Seminar Hall A' },
  maxSeats: 40, bookedSeats: 10, seatsLeft: 30, isFull: false, eligibility: { ineligibleReason: null }, myRegistration: null,
}

describe('semantic structure', () => {
  it('renders an event as an article whose seat meter is a figure captioned with the seats left', () => {
    const { container } = render(<MemoryRouter><ul><EventCard event={event} /></ul></MemoryRouter>)
    const article = container.querySelector('article')
    expect(article).not.toBeNull()
    expect(article.querySelector('h3')).toHaveTextContent('Hack Night')
    expect(article.querySelector('time')).toHaveAttribute('datetime', '2030-03-04')
    expect(article.querySelector('figure figcaption')).toHaveTextContent('30 seats left')
  })

  it('lets a card choose its element, defaulting to a section', () => {
    const { container } = render(<><Card>a</Card><Card as="article">b</Card></>)
    expect(container.querySelectorAll('section')).toHaveLength(1)
    expect(container.querySelectorAll('article')).toHaveLength(1)
  })

  it('gives the sign-in layout a footer landmark and one main', () => {
    render(<ThemeProvider><MemoryRouter><AuthLayout /></MemoryRouter></ThemeProvider>)
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Team A6')
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })
})
