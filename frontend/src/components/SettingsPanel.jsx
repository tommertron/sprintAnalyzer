import { useState, useEffect } from 'react'
import { validateCredentials } from '../services/api'

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
  },
  btnDanger: {
    background: '#DE350B',
    border: '1px solid #DE350B',
    color: 'white'
  },
  btnSuccess: {
    background: '#00875A',
    border: '1px solid #00875A',
    color: 'white'
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #eee',
    marginBottom: '20px',
    gap: '0'
  },
  tab: {
    padding: '10px 20px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    color: '#666',
    borderBottom: '2px solid transparent',
    marginBottom: '-1px'
  },
  tabActive: {
    color: '#0052CC',
    borderBottomColor: '#0052CC'
  },
  credentialField: {
    marginBottom: '16px'
  },
  credentialLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#6B778C',
    marginBottom: '4px',
    display: 'block'
  },
  credentialValue: {
    fontSize: '14px',
    color: '#172B4D',
    padding: '8px 12px',
    background: '#F4F5F7',
    borderRadius: '4px',
    wordBreak: 'break-all'
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #DFE1E6',
    borderRadius: '4px',
    fontSize: '14px',
    boxSizing: 'border-box'
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500'
  },
  statusValid: {
    background: '#E3FCEF',
    color: '#006644'
  },
  statusInvalid: {
    background: '#FFEBE6',
    color: '#BF2600'
  },
  statusChecking: {
    background: '#DEEBFF',
    color: '#0747A6'
  },
  errorMessage: {
    padding: '12px',
    background: '#FFEBE6',
    border: '1px solid #FFBDAD',
    borderRadius: '4px',
    color: '#BF2600',
    fontSize: '13px',
    marginBottom: '16px'
  },
  successMessage: {
    padding: '12px',
    background: '#E3FCEF',
    border: '1px solid #ABF5D1',
    borderRadius: '4px',
    color: '#006644',
    fontSize: '13px',
    marginBottom: '16px'
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

function SettingsPanel({ isOpen, onClose, hiddenCharts, onHiddenChartsChange, credentials, onCredentialsUpdate, onLogout, initialTab = 'display' }) {
  const [localHidden, setLocalHidden] = useState(new Set(hiddenCharts || []))
  const [activeTab, setActiveTab] = useState(initialTab)
  const [newToken, setNewToken] = useState('')
  const [tokenStatus, setTokenStatus] = useState(null) // 'checking' | 'valid' | 'invalid'
  const [statusMessage, setStatusMessage] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    setLocalHidden(new Set(hiddenCharts || []))
  }, [hiddenCharts, isOpen])

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab)
      setNewToken('')
      setTokenStatus(null)
      setStatusMessage('')
    }
  }, [isOpen, initialTab])

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

  const handleTestConnection = async () => {
    if (!credentials) return
    setTokenStatus('checking')
    setStatusMessage('Testing connection...')
    try {
      await validateCredentials(credentials.server, credentials.email, credentials.token)
      setTokenStatus('valid')
      setStatusMessage('Connection successful! Your API token is working.')
    } catch (err) {
      setTokenStatus('invalid')
      setStatusMessage(err.response?.data?.error || 'Connection failed. Your API token may be expired or invalid.')
    }
  }

  const handleUpdateToken = async () => {
    if (!newToken.trim() || !credentials) return
    setIsUpdating(true)
    setTokenStatus('checking')
    setStatusMessage('Validating new token...')
    try {
      const result = await validateCredentials(credentials.server, credentials.email, newToken.trim())
      // Token is valid, update credentials
      const updatedCredentials = {
        ...credentials,
        token: newToken.trim(),
        user: result.user
      }
      onCredentialsUpdate(updatedCredentials)
      setTokenStatus('valid')
      setStatusMessage('Token updated successfully!')
      setNewToken('')
    } catch (err) {
      setTokenStatus('invalid')
      setStatusMessage(err.response?.data?.error || 'Invalid token. Please check and try again.')
    } finally {
      setIsUpdating(false)
    }
  }

  const maskToken = (token) => {
    if (!token || token.length < 8) return '••••••••'
    return token.substring(0, 4) + '••••••••' + token.substring(token.length - 4)
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Settings</h2>
          <button style={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        {/* Tabs */}
        <div style={styles.tabs}>
          <button
            style={{ ...styles.tab, ...(activeTab === 'display' ? styles.tabActive : {}) }}
            onClick={() => setActiveTab('display')}
          >
            Display
          </button>
          <button
            style={{ ...styles.tab, ...(activeTab === 'credentials' ? styles.tabActive : {}) }}
            onClick={() => setActiveTab('credentials')}
          >
            API Credentials
          </button>
        </div>

        {/* Display Tab */}
        {activeTab === 'display' && (
          <>
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
          </>
        )}

        {/* Credentials Tab */}
        {activeTab === 'credentials' && credentials && (
          <>
            <div style={styles.section}>
              <div style={styles.sectionTitle}>Current Connection</div>

              {statusMessage && (
                <div style={tokenStatus === 'valid' ? styles.successMessage : tokenStatus === 'invalid' ? styles.errorMessage : { ...styles.successMessage, background: '#DEEBFF', borderColor: '#B3D4FF', color: '#0747A6' }}>
                  {statusMessage}
                </div>
              )}

              <div style={styles.credentialField}>
                <span style={styles.credentialLabel}>Jira Server</span>
                <div style={styles.credentialValue}>{credentials.server}</div>
              </div>

              <div style={styles.credentialField}>
                <span style={styles.credentialLabel}>Email</span>
                <div style={styles.credentialValue}>{credentials.email}</div>
              </div>

              <div style={styles.credentialField}>
                <span style={styles.credentialLabel}>API Token</span>
                <div style={{ ...styles.credentialValue, fontFamily: 'monospace' }}>
                  {maskToken(credentials.token)}
                </div>
              </div>

              <button
                style={{ ...styles.btn, ...styles.btnSecondary, width: '100%', marginTop: '8px' }}
                onClick={handleTestConnection}
                disabled={tokenStatus === 'checking'}
              >
                {tokenStatus === 'checking' ? 'Testing...' : 'Test Connection'}
              </button>
            </div>

            <div style={styles.section}>
              <div style={styles.sectionTitle}>Update API Token</div>
              <p style={{ fontSize: '13px', color: '#666', marginBottom: '12px', marginTop: 0 }}>
                If your token has expired, generate a new one from{' '}
                <a
                  href="https://id.atlassian.com/manage-profile/security/api-tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#0052CC' }}
                >
                  Atlassian API Tokens
                </a>{' '}
                and paste it below.
              </p>

              <div style={styles.credentialField}>
                <span style={styles.credentialLabel}>New API Token</span>
                <input
                  type="password"
                  style={styles.input}
                  value={newToken}
                  onChange={(e) => setNewToken(e.target.value)}
                  placeholder="Paste your new API token here"
                />
              </div>

              <button
                style={{ ...styles.btn, ...styles.btnPrimary, width: '100%' }}
                onClick={handleUpdateToken}
                disabled={!newToken.trim() || isUpdating}
              >
                {isUpdating ? 'Updating...' : 'Update Token'}
              </button>
            </div>

            <div style={{ ...styles.section, marginBottom: 0 }}>
              <div style={styles.sectionTitle}>Sign Out</div>
              <p style={{ fontSize: '13px', color: '#666', marginBottom: '12px', marginTop: 0 }}>
                Clear all stored credentials and return to the login screen.
              </p>
              <button
                style={{ ...styles.btn, ...styles.btnDanger, width: '100%' }}
                onClick={onLogout}
              >
                Sign Out
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default SettingsPanel
