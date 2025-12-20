import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import BoardSelector from './BoardSelector'

const mockBoards = [
  { id: 1, name: 'Alpha Team', projectKey: 'ALPHA' },
  { id: 2, name: 'Beta Team', projectKey: 'BETA' },
  { id: 3, name: 'Gamma Squad', projectKey: 'GAMMA' }
]

const mockRecentBoards = [
  { id: 1, name: 'Alpha Team' },
  { id: 2, name: 'Beta Team' }
]

describe('BoardSelector', () => {
  it('should render search input when no board selected', () => {
    render(
      <BoardSelector
        boards={mockBoards}
        selectedBoard={null}
        onSelect={vi.fn()}
      />
    )

    expect(screen.getByPlaceholderText('Type to search boards...')).toBeInTheDocument()
  })

  it('should show selected board name when board is selected', () => {
    render(
      <BoardSelector
        boards={mockBoards}
        selectedBoard={1}
        onSelect={vi.fn()}
      />
    )

    expect(screen.getByText('Alpha Team')).toBeInTheDocument()
    expect(screen.getByText('(ALPHA)')).toBeInTheDocument()
  })

  it('should filter boards by name', () => {
    render(
      <BoardSelector
        boards={mockBoards}
        selectedBoard={null}
        onSelect={vi.fn()}
      />
    )

    const input = screen.getByPlaceholderText('Type to search boards...')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'gamma' } })

    expect(screen.getByText('Gamma Squad')).toBeInTheDocument()
    expect(screen.queryByText('Alpha Team')).not.toBeInTheDocument()
    expect(screen.queryByText('Beta Team')).not.toBeInTheDocument()
  })

  it('should filter boards by project key', () => {
    render(
      <BoardSelector
        boards={mockBoards}
        selectedBoard={null}
        onSelect={vi.fn()}
      />
    )

    const input = screen.getByPlaceholderText('Type to search boards...')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'BETA' } })

    expect(screen.getByText('Beta Team')).toBeInTheDocument()
    expect(screen.queryByText('Alpha Team')).not.toBeInTheDocument()
  })

  it('should call onSelect when board is clicked', () => {
    const onSelect = vi.fn()
    render(
      <BoardSelector
        boards={mockBoards}
        selectedBoard={null}
        onSelect={onSelect}
      />
    )

    const input = screen.getByPlaceholderText('Type to search boards...')
    fireEvent.focus(input)

    fireEvent.click(screen.getByText('Alpha Team'))

    expect(onSelect).toHaveBeenCalledWith(1)
  })

  it('should show recent boards when available', () => {
    render(
      <BoardSelector
        boards={mockBoards}
        selectedBoard={null}
        onSelect={vi.fn()}
        recentBoards={mockRecentBoards}
        onSelectRecent={vi.fn()}
      />
    )

    expect(screen.getByText('Recent:')).toBeInTheDocument()
    // Recent boards are shown as buttons
    const buttons = screen.getAllByRole('button')
    expect(buttons.some(b => b.textContent === 'Alpha Team')).toBe(true)
  })

  it('should call onSelectRecent when recent board is clicked', () => {
    const onSelectRecent = vi.fn()
    render(
      <BoardSelector
        boards={mockBoards}
        selectedBoard={null}
        onSelect={vi.fn()}
        recentBoards={mockRecentBoards}
        onSelectRecent={onSelectRecent}
      />
    )

    const recentButtons = screen.getAllByRole('button')
    const alphaButton = recentButtons.find(b => b.textContent === 'Alpha Team')
    fireEvent.click(alphaButton)

    expect(onSelectRecent).toHaveBeenCalledWith(1)
  })

  it('should hide recent boards when board is selected', () => {
    render(
      <BoardSelector
        boards={mockBoards}
        selectedBoard={1}
        onSelect={vi.fn()}
        recentBoards={mockRecentBoards}
        onSelectRecent={vi.fn()}
      />
    )

    expect(screen.queryByText('Recent:')).not.toBeInTheDocument()
  })

  it('should show no results message for empty search', () => {
    render(
      <BoardSelector
        boards={mockBoards}
        selectedBoard={null}
        onSelect={vi.fn()}
      />
    )

    const input = screen.getByPlaceholderText('Type to search boards...')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'nonexistent' } })

    expect(screen.getByText('No boards found')).toBeInTheDocument()
  })

  it('should clear selection when clear button is clicked', () => {
    const onSelect = vi.fn()
    render(
      <BoardSelector
        boards={mockBoards}
        selectedBoard={1}
        onSelect={onSelect}
      />
    )

    const clearButton = screen.getByTitle('Change board')
    fireEvent.click(clearButton)

    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it('should handle keyboard navigation - arrow down opens dropdown', () => {
    render(
      <BoardSelector
        boards={mockBoards}
        selectedBoard={null}
        onSelect={vi.fn()}
      />
    )

    const input = screen.getByPlaceholderText('Type to search boards...')
    fireEvent.keyDown(input, { key: 'ArrowDown' })

    // Dropdown should now be open and show boards
    expect(screen.getByText('Alpha Team')).toBeInTheDocument()
  })

  it('should handle keyboard navigation - escape closes dropdown', () => {
    render(
      <BoardSelector
        boards={mockBoards}
        selectedBoard={null}
        onSelect={vi.fn()}
      />
    )

    const input = screen.getByPlaceholderText('Type to search boards...')
    fireEvent.focus(input)

    // Dropdown is open
    expect(screen.getByText('Alpha Team')).toBeInTheDocument()

    fireEvent.keyDown(input, { key: 'Escape' })

    // Dropdown should be closed
    expect(screen.queryByText('Alpha Team')).not.toBeInTheDocument()
  })
})
