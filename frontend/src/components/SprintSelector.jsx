import { useState, useEffect, useRef } from 'react'

const styles = {
  container: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    minWidth: '80px'
  },
  selectWrapper: {
    position: 'relative',
    minWidth: '280px'
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    paddingRight: '32px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    background: 'white',
    cursor: 'pointer',
    outline: 'none',
    appearance: 'none'
  },
  selectFocused: {
    borderColor: '#0052CC',
    boxShadow: '0 0 0 2px rgba(0, 82, 204, 0.2)'
  },
  arrow: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
    color: '#666'
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
  optionDates: {
    fontSize: '12px',
    color: '#666',
    marginTop: '2px'
  },
  optionState: {
    display: 'inline-block',
    padding: '2px 6px',
    borderRadius: '3px',
    fontSize: '10px',
    fontWeight: '500',
    marginLeft: '8px',
    textTransform: 'uppercase'
  },
  stateActive: {
    background: '#E3FCEF',
    color: '#006644'
  },
  stateFuture: {
    background: '#DEEBFF',
    color: '#0747A6'
  },
  noSprints: {
    padding: '12px',
    color: '#666',
    fontSize: '14px',
    textAlign: 'center'
  },
  loading: {
    padding: '10px 12px',
    color: '#666',
    fontSize: '14px'
  }
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function SprintSelector({ sprints, selectedSprint, onSelect, loading = false }) {
  const [isOpen, setIsOpen] = useState(false)
  const [hoveredIndex, setHoveredIndex] = useState(-1)
  const selectRef = useRef(null)
  const dropdownRef = useRef(null)

  const selectedSprintObj = sprints.find(s => s.id === selectedSprint)

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        selectRef.current &&
        !selectRef.current.contains(e.target)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (sprint) => {
    onSelect(sprint.id)
    setIsOpen(false)
    setHoveredIndex(-1)
  }

  const getStateStyle = (state) => {
    if (state === 'active') return { ...styles.optionState, ...styles.stateActive }
    return { ...styles.optionState, ...styles.stateFuture }
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <label style={styles.label}>Sprint:</label>
        <div style={styles.loading}>Loading sprints...</div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <label style={styles.label}>Sprint:</label>
      <div style={styles.selectWrapper}>
        <div
          ref={selectRef}
          style={{
            ...styles.select,
            ...(isOpen ? styles.selectFocused : {})
          }}
          onClick={() => setIsOpen(!isOpen)}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setIsOpen(!isOpen)
            } else if (e.key === 'Escape') {
              setIsOpen(false)
            }
          }}
        >
          {selectedSprintObj ? (
            <span>
              {selectedSprintObj.name}
              <span style={getStateStyle(selectedSprintObj.state)}>
                {selectedSprintObj.state}
              </span>
            </span>
          ) : (
            <span style={{ color: '#666' }}>Select a sprint...</span>
          )}
        </div>
        <span style={styles.arrow}>▼</span>

        {isOpen && (
          <div ref={dropdownRef} style={styles.dropdown}>
            {sprints.length === 0 ? (
              <div style={styles.noSprints}>No upcoming sprints found</div>
            ) : (
              sprints.map((sprint, index) => (
                <div
                  key={sprint.id}
                  style={{
                    ...styles.option,
                    ...(hoveredIndex === index ? styles.optionHovered : {}),
                    ...(selectedSprint === sprint.id ? styles.optionSelected : {})
                  }}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onClick={() => handleSelect(sprint)}
                >
                  <div style={styles.optionName}>
                    {sprint.name}
                    <span style={getStateStyle(sprint.state)}>
                      {sprint.state}
                    </span>
                  </div>
                  <div style={styles.optionDates}>
                    {formatDate(sprint.startDate)} - {formatDate(sprint.endDate)}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default SprintSelector
