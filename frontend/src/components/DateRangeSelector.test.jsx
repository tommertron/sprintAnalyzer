import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DateRangeSelector from './DateRangeSelector'

describe('DateRangeSelector', () => {
  it('should show default label when no value', () => {
    render(<DateRangeSelector value={null} onChange={vi.fn()} />)

    expect(screen.getByText('Last 6 sprints')).toBeInTheDocument()
  })

  it('should show sprint count in label', () => {
    render(<DateRangeSelector value={{ sprintCount: 12 }} onChange={vi.fn()} />)

    expect(screen.getByText('Last 12 sprints')).toBeInTheDocument()
  })

  it('should show date range in label for non-preset dates', () => {
    // Use dates that don't match any preset
    render(
      <DateRangeSelector
        value={{ startDate: '2024-02-15', endDate: '2024-04-20' }}
        onChange={vi.fn()}
      />
    )

    expect(screen.getByText('2024-02-15 - 2024-04-20')).toBeInTheDocument()
  })

  it('should open dropdown on click', () => {
    render(<DateRangeSelector value={null} onChange={vi.fn()} />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    expect(screen.getByText('Quarters')).toBeInTheDocument()
    expect(screen.getByText('Years')).toBeInTheDocument()
  })

  it('should show preset quarters', () => {
    render(<DateRangeSelector value={null} onChange={vi.fn()} />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    // Should show some quarter options - use getAllBy since there are multiple
    const currentYear = new Date().getFullYear()
    const quarterElements = screen.getAllByText(new RegExp(`Q\\d ${currentYear}`))
    expect(quarterElements.length).toBeGreaterThan(0)
  })

  it('should show preset years', () => {
    render(<DateRangeSelector value={null} onChange={vi.fn()} />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    const currentYear = new Date().getFullYear()
    expect(screen.getByText(String(currentYear))).toBeInTheDocument()
    expect(screen.getByText(String(currentYear - 1))).toBeInTheDocument()
  })

  it('should call onChange with null for default option', () => {
    const onChange = vi.fn()
    render(<DateRangeSelector value={{ sprintCount: 12 }} onChange={onChange} />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    fireEvent.click(screen.getByText('Last 6 sprints'))

    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('should call onChange with date range for quarter selection', () => {
    const onChange = vi.fn()
    render(<DateRangeSelector value={null} onChange={onChange} />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    // Click first quarter option - use getAllBy and pick first
    const currentYear = new Date().getFullYear()
    const quarterOptions = screen.getAllByText(new RegExp(`Q\\d ${currentYear}`))
    fireEvent.click(quarterOptions[0])

    expect(onChange).toHaveBeenCalled()
    const callArg = onChange.mock.calls[0][0]
    expect(callArg).toHaveProperty('startDate')
    expect(callArg).toHaveProperty('endDate')
  })

  it('should show custom sprint count input', () => {
    render(<DateRangeSelector value={null} onChange={vi.fn()} />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    fireEvent.click(screen.getByText('Custom sprint range...'))

    expect(screen.getByText('Number of sprints')).toBeInTheDocument()
    expect(screen.getByRole('spinbutton')).toBeInTheDocument()
  })

  it('should apply custom sprint count', () => {
    const onChange = vi.fn()
    render(<DateRangeSelector value={null} onChange={onChange} />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    fireEvent.click(screen.getByText('Custom sprint range...'))

    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '10' } })

    fireEvent.click(screen.getByText('Apply'))

    expect(onChange).toHaveBeenCalledWith({ sprintCount: 10 })
  })

  it('should show custom date range inputs', () => {
    render(<DateRangeSelector value={null} onChange={vi.fn()} />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    fireEvent.click(screen.getByText('Custom date range...'))

    expect(screen.getByText('Start date')).toBeInTheDocument()
    expect(screen.getByText('End date')).toBeInTheDocument()
  })

  it('should highlight currently selected preset', () => {
    const currentYear = new Date().getFullYear()
    render(
      <DateRangeSelector
        value={{ startDate: `${currentYear}-01-01`, endDate: `${currentYear}-12-31` }}
        onChange={vi.fn()}
      />
    )

    // The button should show the year as selected
    const button = screen.getByRole('button')
    expect(button).toHaveTextContent(String(currentYear))
  })

  it('should validate sprint count between 1 and 50', () => {
    render(<DateRangeSelector value={null} onChange={vi.fn()} />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    fireEvent.click(screen.getByText('Custom sprint range...'))

    const input = screen.getByRole('spinbutton')

    // Try setting to 0 - should clamp to 1
    fireEvent.change(input, { target: { value: '0' } })
    expect(input.value).toBe('1')

    // Try setting to 100 - should clamp to 50
    fireEvent.change(input, { target: { value: '100' } })
    expect(input.value).toBe('50')
  })
})
