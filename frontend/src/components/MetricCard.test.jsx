import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MetricCard from './MetricCard'

describe('MetricCard', () => {
  it('should render title', () => {
    render(<MetricCard title="Velocity" value={25} unit="pts" />)

    expect(screen.getByText('Velocity')).toBeInTheDocument()
  })

  it('should render numeric value with one decimal place', () => {
    render(<MetricCard title="Velocity" value={25.567} unit="pts" />)

    expect(screen.getByText(/25\.6/)).toBeInTheDocument()
  })

  it('should render unit', () => {
    render(<MetricCard title="Velocity" value={25} unit="pts" />)

    expect(screen.getByText('pts')).toBeInTheDocument()
  })

  it('should handle integer values', () => {
    render(<MetricCard title="Count" value={10} unit="items" />)

    expect(screen.getByText(/10\.0/)).toBeInTheDocument()
  })

  it('should handle zero values', () => {
    render(<MetricCard title="Empty" value={0} unit="%" />)

    expect(screen.getByText(/0\.0/)).toBeInTheDocument()
  })

  it('should handle string values', () => {
    render(<MetricCard title="Status" value="N/A" unit="" />)

    expect(screen.getByText('N/A')).toBeInTheDocument()
  })

  it('should render percentage unit', () => {
    render(<MetricCard title="Completion Rate" value={85.5} unit="%" />)

    expect(screen.getByText('%')).toBeInTheDocument()
    expect(screen.getByText(/85\.5/)).toBeInTheDocument()
  })
})
