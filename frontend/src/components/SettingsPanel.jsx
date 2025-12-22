import { useState, useEffect } from 'react'

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  panel: {
    background: 'white',
    borderRadius: '8px',
    padding: '24px',
    width: '480px',
    maxWidth: '90vw',
    maxHeight: '80vh',
    overflow: 'auto',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '1px solid #eee'
  },
  title: {
    fontSize: '18px',
    fontWeight: '600',
    margin: 0
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#666',
    padding: '0',
    lineHeight: 1
  },
  section: {
    marginBottom: '20px'
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '12px'
  },
  optionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  option: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '10px',
    background: '#f9f9f9',
    borderRadius: '6px',
    cursor: 'pointer'
  },
  checkbox: {
    marginTop: '2px',
    width: '16px',
    height: '16px',
    cursor: 'pointer'
  },
  optionContent: {
    flex: 1
  },
  optionLabel: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#333',
    marginBottom: '2px'
  },
  optionDescription: {
    fontSize: '12px',
    color: '#666'
  },
  alphaBadge: {
    display: 'inline-block',
    padding: '2px 6px',
    background: '#FFAB00',
    color: '#172B4D',
    fontSize: '10px',
    fontWeight: '600',
    borderRadius: '3px',
    marginLeft: '8px',
    verticalAlign: 'middle'
  },
  footer: {
    marginTop: '20px',
    paddingTop: '16px',
    borderTop: '1px solid #eee',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px'
  },
  btn: {
    padding: '8px 16px',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  btnSecondary: {
    background: 'white',
    border: '1px solid #ddd',
    color: '#333'
  },
  btnPrimary: {
    background: '#0052CC',
    border: '1px solid #0052CC',
    color: 'white'
  }
}

const METRIC_OPTIONS = [
  {
    id: 'velocityChart',
    label: 'Velocity Trend',
    description: 'Story points completed per sprint over time'
  },
  {
    id: 'completionChart',
    label: 'Completion Rate',
    description: 'Percentage of committed issues completed per sprint'
  },
  {
    id: 'qualityMetrics',
    label: 'Quality Metrics',
    description: 'Bug ratio, incomplete work percentage, and average ticket age'
  },
  {
    id: 'alignmentChart',
    label: 'Strategic Alignment',
    description: 'Work linked to initiatives vs. orphan/ad-hoc work'
  },
  {
    id: 'timeInStatus',
    label: 'Time in Status (Workflow Bottlenecks)',
    description: 'Where issues spend time in your workflow - identifies bottlenecks',
    isAlpha: true,
    alphaNote: 'Data accuracy is still being validated'
  },
  {
    id: 'sprintCarryover',
    label: 'Sprint Carryover Analysis',
    description: 'Issues carried over between sprints and repeat offenders'
  }
]

function SettingsPanel({ isOpen, onClose, hiddenCharts, onHiddenChartsChange }) {
  const [localHidden, setLocalHidden] = useState(new Set(hiddenCharts || []))

  useEffect(() => {
    setLocalHidden(new Set(hiddenCharts || []))
  }, [hiddenCharts, isOpen])

  if (!isOpen) return null

  const handleToggle = (chartId) => {
    const newHidden = new Set(localHidden)
    if (newHidden.has(chartId)) {
      newHidden.delete(chartId)
    } else {
      newHidden.add(chartId)
    }
    setLocalHidden(newHidden)
  }

  const handleSave = () => {
    onHiddenChartsChange(Array.from(localHidden))
    onClose()
  }

  const handleReset = () => {
    setLocalHidden(new Set())
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Display Settings</h2>
          <button style={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>Visible Charts</div>
          <p style={{ fontSize: '13px', color: '#666', marginBottom: '16px', marginTop: 0 }}>
            Uncheck charts you want to hide from the Metrics dashboard.
          </p>
          <div style={styles.optionList}>
            {METRIC_OPTIONS.map((option) => (
              <label
                key={option.id}
                style={styles.option}
              >
                <input
                  type="checkbox"
                  style={styles.checkbox}
                  checked={!localHidden.has(option.id)}
                  onChange={() => handleToggle(option.id)}
                />
                <div style={styles.optionContent}>
                  <div style={styles.optionLabel}>
                    {option.label}
                    {option.isAlpha && (
                      <span style={styles.alphaBadge}>ALPHA</span>
                    )}
                  </div>
                  <div style={styles.optionDescription}>
                    {option.description}
                    {option.alphaNote && (
                      <span style={{ color: '#FF8B00', marginLeft: '4px' }}>
                        ({option.alphaNote})
                      </span>
                    )}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div style={styles.footer}>
          <button
            style={{ ...styles.btn, ...styles.btnSecondary }}
            onClick={handleReset}
          >
            Show All
          </button>
          <button
            style={{ ...styles.btn, ...styles.btnPrimary }}
            onClick={handleSave}
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsPanel
