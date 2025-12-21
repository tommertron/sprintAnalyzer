import { useState, useEffect } from 'react'

const styles = {
  container: {
    background: 'white',
    borderRadius: '8px',
    padding: '24px 32px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #ddd'
  },
  title: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '20px',
    color: '#172B4D'
  },
  statusContainer: {
    marginBottom: '20px'
  },
  statusItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 0',
    fontSize: '14px',
    color: '#666'
  },
  statusItemActive: {
    color: '#0052CC',
    fontWeight: '500'
  },
  statusItemComplete: {
    color: '#00875A'
  },
  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid #ddd',
    borderTopColor: '#0052CC',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite'
  },
  checkmark: {
    width: '16px',
    height: '16px',
    color: '#00875A'
  },
  pending: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    border: '2px solid #ddd'
  },
  progressBarContainer: {
    height: '6px',
    background: '#E9ECEF',
    borderRadius: '3px',
    overflow: 'hidden',
    marginTop: '16px'
  },
  progressBar: {
    height: '100%',
    background: 'linear-gradient(90deg, #0052CC, #00B8D9)',
    borderRadius: '3px',
    transition: 'width 0.3s ease'
  },
  footer: {
    marginTop: '16px',
    fontSize: '12px',
    color: '#999',
    textAlign: 'center'
  }
}

// Inject keyframes for spinner animation
const styleSheet = document.createElement('style')
styleSheet.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`
if (!document.head.querySelector('style[data-loading-modal]')) {
  styleSheet.setAttribute('data-loading-modal', 'true')
  document.head.appendChild(styleSheet)
}

const LOADING_STEPS = [
  { id: 'sprints', label: 'Fetching sprint data...' },
  { id: 'issues', label: 'Loading sprint issues...' },
  { id: 'velocity', label: 'Calculating velocity metrics...' },
  { id: 'completion', label: 'Analyzing completion rates...' },
  { id: 'quality', label: 'Computing quality metrics...' },
  { id: 'alignment', label: 'Processing strategic alignment...' },
  { id: 'finalizing', label: 'Finalizing results...' }
]

function LoadingStatusModal({ isOpen, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState([])

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0)
      setCompletedSteps([])
      return
    }

    // Simulate progress through steps
    const stepDurations = [400, 800, 600, 500, 500, 600, 300]
    let stepIndex = 0
    let timeoutId

    const advanceStep = () => {
      if (stepIndex < LOADING_STEPS.length) {
        setCurrentStep(stepIndex)

        timeoutId = setTimeout(() => {
          setCompletedSteps(prev => [...prev, LOADING_STEPS[stepIndex].id])
          stepIndex++
          advanceStep()
        }, stepDurations[stepIndex] || 500)
      }
    }

    advanceStep()

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [isOpen])

  if (!isOpen) return null

  const progress = Math.min(((completedSteps.length + 0.5) / LOADING_STEPS.length) * 100, 100)

  return (
    <div style={styles.container}>
      <div style={styles.title}>Loading Sprint Metrics</div>

      <div style={styles.statusContainer}>
        {LOADING_STEPS.map((step, index) => {
          const isComplete = completedSteps.includes(step.id)
          const isActive = index === currentStep && !isComplete

          return (
            <div
              key={step.id}
              style={{
                ...styles.statusItem,
                ...(isActive ? styles.statusItemActive : {}),
                ...(isComplete ? styles.statusItemComplete : {})
              }}
            >
              {isComplete ? (
                <svg style={styles.checkmark} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : isActive ? (
                <div style={styles.spinner} />
              ) : (
                <div style={styles.pending} />
              )}
              <span>{step.label}</span>
            </div>
          )
        })}
      </div>

      <div style={styles.progressBarContainer}>
        <div style={{ ...styles.progressBar, width: `${progress}%` }} />
      </div>

      <div style={styles.footer}>
        Please wait while we analyze your sprint data...
      </div>
    </div>
  )
}

export default LoadingStatusModal
