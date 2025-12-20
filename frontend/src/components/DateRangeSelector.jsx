import { useState, useRef, useEffect, useMemo } from 'react'

const styles = {
  container: {
    position: 'relative',
    display: 'inline-block'
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    background: '#f5f5f5',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    cursor: 'pointer',
    minWidth: '160px',
    justifyContent: 'space-between'
  },
  buttonOpen: {
    borderColor: '#0052CC',
    boxShadow: '0 0 0 2px rgba(0, 82, 204, 0.2)'
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    background: 'white',
    border: '1px solid #ddd',
    borderRadius: '4px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    zIndex: 100,
    marginTop: '4px',
    minWidth: '220px'
  },
  section: {
    padding: '8px 0'
  },
  sectionTitle: {
    padding: '4px 12px',
    fontSize: '11px',
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  option: {
    padding: '8px 12px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  optionHovered: {
    background: '#f5f5f5'
  },
  optionSelected: {
    background: '#E6F0FF',
    fontWeight: '500'
  },
  divider: {
    height: '1px',
    background: '#eee',
    margin: '4px 0'
  },
  customSection: {
    padding: '12px'
  },
  customLabel: {
    fontSize: '12px',
    color: '#666',
    marginBottom: '6px',
    display: 'block'
  },
  dateInputRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center'
  },
  dateInput: {
    flex: 1,
    padding: '6px 8px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '13px'
  },
  sprintCountInput: {
    width: '60px',
    padding: '6px 8px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '13px',
    textAlign: 'center'
  },
  sprintCountRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  applyButton: {
    marginTop: '8px',
    width: '100%',
    padding: '8px',
    background: '#0052CC',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    cursor: 'pointer'
  },
  arrow: {
    fontSize: '10px',
    color: '#666'
  }
}

function generatePresets() {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1

  const quarters = []
  const years = []

  // Generate quarters for current year and previous year (most recent first)
  for (let year = currentYear; year >= currentYear - 1; year--) {
    const maxQuarter = year === currentYear ? currentQuarter : 4
    for (let q = maxQuarter; q >= 1; q--) {
      const startMonth = (q - 1) * 3
      const endMonth = startMonth + 2
      const startDate = new Date(year, startMonth, 1)
      const endDate = new Date(year, endMonth + 1, 0) // Last day of the quarter

      quarters.push({
        label: `Q${q} ${year}`,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      })
    }
  }

  // Generate years (current and 2 previous)
  for (let year = currentYear; year >= currentYear - 2; year--) {
    years.push({
      label: `${year}`,
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`
    })
  }

  return { quarters, years }
}

function DateRangeSelector({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const [hoveredOption, setHoveredOption] = useState(null)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [showSprintCount, setShowSprintCount] = useState(false)
  const [customSprintCount, setCustomSprintCount] = useState(6)
  const containerRef = useRef(null)

  const presets = useMemo(() => generatePresets(), [])

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
        setShowCustom(false)
        setShowSprintCount(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (option) => {
    onChange(option ? { startDate: option.startDate, endDate: option.endDate } : null)
    setIsOpen(false)
    setShowCustom(false)
    setShowSprintCount(false)
  }

  const handleCustomApply = () => {
    if (customStart && customEnd) {
      onChange({ startDate: customStart, endDate: customEnd })
      setIsOpen(false)
      setShowCustom(false)
      setShowSprintCount(false)
    }
  }

  const handleSprintCountApply = () => {
    if (customSprintCount >= 1 && customSprintCount <= 50) {
      onChange({ sprintCount: customSprintCount })
      setIsOpen(false)
      setShowCustom(false)
      setShowSprintCount(false)
    }
  }

  // Determine display label
  const getDisplayLabel = () => {
    if (!value) return 'Last 6 sprints'

    // Check if it's a custom sprint count
    if (value.sprintCount) {
      return `Last ${value.sprintCount} sprints`
    }

    // Check if matches a preset
    for (const q of presets.quarters) {
      if (q.startDate === value.startDate && q.endDate === value.endDate) {
        return q.label
      }
    }
    for (const y of presets.years) {
      if (y.startDate === value.startDate && y.endDate === value.endDate) {
        return y.label
      }
    }

    // Custom range
    return `${value.startDate} - ${value.endDate}`
  }

  const isSelected = (option) => {
    if (!option && !value) return true
    if (!option || !value) return false
    return option.startDate === value.startDate && option.endDate === value.endDate
  }

  return (
    <div ref={containerRef} style={styles.container}>
      <button
        style={{
          ...styles.button,
          ...(isOpen ? styles.buttonOpen : {})
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{getDisplayLabel()}</span>
        <span style={styles.arrow}>{isOpen ? '\u25B2' : '\u25BC'}</span>
      </button>

      {isOpen && (
        <div style={styles.dropdown}>
          {!showCustom && !showSprintCount ? (
            <>
              <div style={styles.section}>
                <div
                  style={{
                    ...styles.option,
                    ...(hoveredOption === 'default' ? styles.optionHovered : {}),
                    ...(isSelected(null) ? styles.optionSelected : {})
                  }}
                  onMouseEnter={() => setHoveredOption('default')}
                  onMouseLeave={() => setHoveredOption(null)}
                  onClick={() => handleSelect(null)}
                >
                  Last 6 sprints
                </div>
              </div>

              <div style={styles.divider} />

              <div style={styles.section}>
                <div style={styles.sectionTitle}>Quarters</div>
                {presets.quarters.slice(0, 6).map((q) => (
                  <div
                    key={q.label}
                    style={{
                      ...styles.option,
                      ...(hoveredOption === q.label ? styles.optionHovered : {}),
                      ...(isSelected(q) ? styles.optionSelected : {})
                    }}
                    onMouseEnter={() => setHoveredOption(q.label)}
                    onMouseLeave={() => setHoveredOption(null)}
                    onClick={() => handleSelect(q)}
                  >
                    {q.label}
                  </div>
                ))}
              </div>

              <div style={styles.divider} />

              <div style={styles.section}>
                <div style={styles.sectionTitle}>Years</div>
                {presets.years.map((y) => (
                  <div
                    key={y.label}
                    style={{
                      ...styles.option,
                      ...(hoveredOption === y.label ? styles.optionHovered : {}),
                      ...(isSelected(y) ? styles.optionSelected : {})
                    }}
                    onMouseEnter={() => setHoveredOption(y.label)}
                    onMouseLeave={() => setHoveredOption(null)}
                    onClick={() => handleSelect(y)}
                  >
                    {y.label}
                  </div>
                ))}
              </div>

              <div style={styles.divider} />

              <div style={styles.section}>
                <div
                  style={{
                    ...styles.option,
                    ...(hoveredOption === 'sprintCount' ? styles.optionHovered : {}),
                    ...(value?.sprintCount ? styles.optionSelected : {})
                  }}
                  onMouseEnter={() => setHoveredOption('sprintCount')}
                  onMouseLeave={() => setHoveredOption(null)}
                  onClick={() => {
                    if (value?.sprintCount) {
                      setCustomSprintCount(value.sprintCount)
                    }
                    setShowSprintCount(true)
                  }}
                >
                  Custom sprint range...
                </div>
                <div
                  style={{
                    ...styles.option,
                    ...(hoveredOption === 'custom' ? styles.optionHovered : {})
                  }}
                  onMouseEnter={() => setHoveredOption('custom')}
                  onMouseLeave={() => setHoveredOption(null)}
                  onClick={() => setShowCustom(true)}
                >
                  Custom date range...
                </div>
              </div>
            </>
          ) : showSprintCount ? (
            <div style={styles.customSection}>
              <label style={styles.customLabel}>Number of sprints</label>
              <div style={styles.sprintCountRow}>
                <span>Last</span>
                <input
                  type="number"
                  min="1"
                  max="50"
                  style={styles.sprintCountInput}
                  value={customSprintCount}
                  onChange={(e) => setCustomSprintCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                />
                <span>sprints</span>
              </div>
              <button
                style={{
                  ...styles.applyButton,
                  opacity: customSprintCount >= 1 ? 1 : 0.5
                }}
                onClick={handleSprintCountApply}
                disabled={customSprintCount < 1}
              >
                Apply
              </button>
            </div>
          ) : (
            <div style={styles.customSection}>
              <label style={styles.customLabel}>Start date</label>
              <input
                type="date"
                style={styles.dateInput}
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />

              <label style={{ ...styles.customLabel, marginTop: '12px' }}>End date</label>
              <input
                type="date"
                style={styles.dateInput}
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />

              <button
                style={{
                  ...styles.applyButton,
                  opacity: customStart && customEnd ? 1 : 0.5
                }}
                onClick={handleCustomApply}
                disabled={!customStart || !customEnd}
              >
                Apply
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default DateRangeSelector
