import { useState, useEffect, useRef } from 'react'

const styles = {
  container: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  searchSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    minWidth: '80px'
  },
  inputWrapper: {
    position: 'relative',
    flex: 1,
    maxWidth: '400px'
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    outline: 'none'
  },
  inputFocused: {
    borderColor: '#0052CC',
    boxShadow: '0 0 0 2px rgba(0, 82, 204, 0.2)'
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    background: 'white',
    border: '1px solid #ddd',
    borderRadius: '4px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    maxHeight: '300px',
    overflowY: 'auto',
    zIndex: 100,
    marginTop: '4px'
  },
  option: {
    padding: '10px 12px',
    cursor: 'pointer',
    borderBottom: '1px solid #f0f0f0'
  },
  optionHovered: {
    background: '#f5f5f5'
  },
  optionSelected: {
    background: '#E6F0FF'
  },
  optionName: {
    fontWeight: '500',
    fontSize: '14px'
  },
  optionProject: {
    fontSize: '12px',
    color: '#666',
    marginTop: '2px'
  },
  noResults: {
    padding: '12px',
    color: '#666',
    fontSize: '14px',
    textAlign: 'center'
  },
  recentSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap'
  },
  recentLabel: {
    fontSize: '12px',
    color: '#666'
  },
  recentChip: {
    padding: '4px 10px',
    background: '#f0f0f0',
    borderRadius: '16px',
    fontSize: '12px',
    cursor: 'pointer',
    border: 'none',
    transition: 'background 0.2s'
  },
  recentChipHover: {
    background: '#e0e0e0'
  },
  selectedBoard: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    background: '#E6F0FF',
    borderRadius: '4px',
    fontSize: '14px'
  },
  clearButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '2px 6px',
    fontSize: '16px',
    color: '#666',
    borderRadius: '4px'
  }
}

function BoardSelector({ boards, selectedBoard, onSelect, recentBoards = [], onSelectRecent }) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [hoveredIndex, setHoveredIndex] = useState(-1)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)

  // Filter boards based on query
  const filteredBoards = query.trim()
    ? boards.filter(board => {
        const searchTerm = query.toLowerCase()
        return (
          board.name.toLowerCase().includes(searchTerm) ||
          (board.projectKey && board.projectKey.toLowerCase().includes(searchTerm))
        )
      })
    : boards.slice(0, 20) // Show first 20 when no query

  // Get selected board object
  const selectedBoardObj = boards.find(b => b.id === selectedBoard)

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        !inputRef.current.contains(e.target)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHoveredIndex(prev => Math.min(prev + 1, filteredBoards.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHoveredIndex(prev => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (hoveredIndex >= 0 && filteredBoards[hoveredIndex]) {
          handleSelect(filteredBoards[hoveredIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        break
    }
  }

  const handleSelect = (board) => {
    onSelect(board.id)
    setQuery('')
    setIsOpen(false)
    setHoveredIndex(-1)
  }

  const handleClear = () => {
    onSelect(null)
    setQuery('')
    inputRef.current?.focus()
  }

  return (
    <div style={styles.container}>
      <div style={styles.searchSection}>
        <label style={styles.label}>Team Board:</label>

        {selectedBoardObj ? (
          <div style={styles.selectedBoard}>
            <span>{selectedBoardObj.name}</span>
            {selectedBoardObj.projectKey && (
              <span style={{ color: '#666' }}>({selectedBoardObj.projectKey})</span>
            )}
            <button style={styles.clearButton} onClick={handleClear} title="Change board">
              ×
            </button>
          </div>
        ) : (
          <div style={styles.inputWrapper}>
            <input
              ref={inputRef}
              style={{
                ...styles.input,
                ...(isOpen ? styles.inputFocused : {})
              }}
              type="text"
              placeholder="Type to search boards..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setIsOpen(true)
                setHoveredIndex(-1)
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
            />

            {isOpen && (
              <div ref={dropdownRef} style={styles.dropdown}>
                {filteredBoards.length === 0 ? (
                  <div style={styles.noResults}>No boards found</div>
                ) : (
                  filteredBoards.slice(0, 50).map((board, index) => (
                    <div
                      key={board.id}
                      style={{
                        ...styles.option,
                        ...(hoveredIndex === index ? styles.optionHovered : {}),
                        ...(selectedBoard === board.id ? styles.optionSelected : {})
                      }}
                      onMouseEnter={() => setHoveredIndex(index)}
                      onClick={() => handleSelect(board)}
                    >
                      <div style={styles.optionName}>{board.name}</div>
                      {board.projectKey && (
                        <div style={styles.optionProject}>{board.projectKey}</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {recentBoards.length > 0 && !selectedBoardObj && (
        <div style={styles.recentSection}>
          <span style={styles.recentLabel}>Recent:</span>
          {recentBoards.map((board) => (
            <button
              key={board.id}
              style={styles.recentChip}
              onClick={() => onSelectRecent(board.id)}
              onMouseEnter={(e) => e.target.style.background = '#e0e0e0'}
              onMouseLeave={(e) => e.target.style.background = '#f0f0f0'}
            >
              {board.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default BoardSelector
