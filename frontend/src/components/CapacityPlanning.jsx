import { useState, useEffect } from 'react'
import { getProjectMembers } from '../services/api'

const BAMBOO_CREDENTIALS_KEY = 'sprintAnalyzer_bambooCredentials'
const SELECTED_MEMBERS_KEY = 'sprintAnalyzer_selectedMembers'

const styles = {
  container: {
    padding: '0'
  },
  section: {
    marginBottom: '24px'
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '12px',
    color: '#333'
  },
  row: {
    display: 'flex',
    gap: '16px',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    marginBottom: '16px'
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  label: {
    fontSize: '12px',
    fontWeight: '500',
    color: '#666'
  },
  input: {
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    minWidth: '200px'
  },
  button: {
    padding: '8px 16px',
    background: '#0052CC',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    cursor: 'pointer'
  },
  buttonSecondary: {
    padding: '8px 16px',
    background: 'white',
    color: '#333',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    cursor: 'pointer'
  },
  buttonSmall: {
    padding: '4px 8px',
    fontSize: '12px',
    background: 'white',
    color: '#666',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  card: {
    background: '#f8f9fa',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px'
  },
  membersList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '8px',
    marginTop: '8px'
  },
  memberItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px',
    background: 'white',
    borderRadius: '4px',
    border: '1px solid #e9ecef',
    cursor: 'pointer'
  },
  memberItemSelected: {
    background: '#E6F3FF',
    borderColor: '#0052CC'
  },
  memberAvatar: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    background: '#ddd'
  },
  memberName: {
    fontSize: '13px',
    flex: 1
  },
  checkbox: {
    width: '16px',
    height: '16px'
  },
  error: {
    background: '#FFEBE6',
    border: '1px solid #DE350B',
    borderRadius: '4px',
    padding: '12px',
    color: '#DE350B',
    marginBottom: '16px',
    fontSize: '13px'
  },
  info: {
    background: '#E6F3FF',
    border: '1px solid #0052CC',
    borderRadius: '4px',
    padding: '12px',
    color: '#0052CC',
    marginBottom: '16px',
    fontSize: '13px'
  },
  success: {
    background: '#E3FCEF',
    border: '1px solid #00875A',
    borderRadius: '4px',
    padding: '12px',
    color: '#00875A',
    marginBottom: '16px',
    fontSize: '13px'
  },
  loading: {
    color: '#666',
    fontSize: '14px',
    padding: '20px 0'
  }
}

function loadFromStorage(key, defaultValue) {
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : defaultValue
  } catch {
    return defaultValue
  }
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore storage errors
  }
}

function CapacityPlanning({ credentials, boardId, isWhitelisted }) {
  // BambooHR credentials
  const [bambooToken, setBambooToken] = useState('')
  const [bambooSubdomain, setBambooSubdomain] = useState('')
  const [bambooConnected, setBambooConnected] = useState(false)

  // Project members
  const [projectMembers, setProjectMembers] = useState([])
  const [selectedMemberIds, setSelectedMemberIds] = useState(new Set())
  const [membersLoading, setMembersLoading] = useState(false)

  const [error, setError] = useState(null)

  // Load saved credentials and selected members on mount
  useEffect(() => {
    const savedBamboo = loadFromStorage(BAMBOO_CREDENTIALS_KEY, null)
    if (savedBamboo) {
      setBambooToken(savedBamboo.token)
      setBambooSubdomain(savedBamboo.subdomain)
      setBambooConnected(true)
    }
    const savedMembers = loadFromStorage(`${SELECTED_MEMBERS_KEY}_${boardId}`, [])
    if (savedMembers.length > 0) {
      setSelectedMemberIds(new Set(savedMembers))
    }
  }, [boardId])

  // Load project members when board changes
  useEffect(() => {
    if (boardId) {
      loadProjectMembers()
    }
  }, [boardId, credentials])

  const loadProjectMembers = async () => {
    setMembersLoading(true)
    setError(null)
    try {
      const members = await getProjectMembers(credentials, boardId)
      // Filter out "Former User" entries
      const activeMembers = members.filter(m =>
        !m.displayName?.toLowerCase().includes('former user')
      )
      setProjectMembers(activeMembers)
    } catch (err) {
      console.error('Failed to load project members:', err)
      setError('Failed to load project members')
      setProjectMembers([])
    } finally {
      setMembersLoading(false)
    }
  }

  const handleConnectBamboo = () => {
    if (!bambooToken || !bambooSubdomain) {
      setError('Please enter both BambooHR API key and subdomain.')
      return
    }
    saveToStorage(BAMBOO_CREDENTIALS_KEY, {
      token: bambooToken,
      subdomain: bambooSubdomain
    })
    setBambooConnected(true)
    setError(null)
  }

  const handleDisconnectBamboo = () => {
    localStorage.removeItem(BAMBOO_CREDENTIALS_KEY)
    setBambooToken('')
    setBambooSubdomain('')
    setBambooConnected(false)
  }

  const toggleMember = (accountId) => {
    const newSelected = new Set(selectedMemberIds)
    if (newSelected.has(accountId)) {
      newSelected.delete(accountId)
    } else {
      newSelected.add(accountId)
    }
    setSelectedMemberIds(newSelected)
    saveToStorage(`${SELECTED_MEMBERS_KEY}_${boardId}`, [...newSelected])
  }

  const selectAllMembers = () => {
    const allIds = new Set(projectMembers.map(m => m.accountId))
    setSelectedMemberIds(allIds)
    saveToStorage(`${SELECTED_MEMBERS_KEY}_${boardId}`, [...allIds])
  }

  const clearSelection = () => {
    setSelectedMemberIds(new Set())
    saveToStorage(`${SELECTED_MEMBERS_KEY}_${boardId}`, [])
  }

  const handleRefresh = async () => {
    await loadProjectMembers()
  }

  if (!isWhitelisted) {
    return (
      <div style={styles.container}>
        <div style={styles.info}>
          Capacity planning is only available for whitelisted boards.
          Contact your administrator to enable this feature for your team.
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.info}>
        Configure your team members and BambooHR connection here.
        Then go to the <strong>Planning</strong> tab to see capacity impact on upcoming sprints.
      </div>

      {/* BambooHR Connection */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>BambooHR Connection</div>
        {!bambooConnected ? (
          <div style={styles.card}>
            <div style={styles.row}>
              <div style={styles.field}>
                <label style={styles.label}>API Key</label>
                <input
                  type="password"
                  style={styles.input}
                  value={bambooToken}
                  onChange={(e) => setBambooToken(e.target.value)}
                  placeholder="Your BambooHR API key"
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Subdomain</label>
                <input
                  type="text"
                  style={styles.input}
                  value={bambooSubdomain}
                  onChange={(e) => setBambooSubdomain(e.target.value)}
                  placeholder="e.g., yourcompany"
                />
              </div>
              <button style={styles.button} onClick={handleConnectBamboo}>
                Connect
              </button>
            </div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
              Your BambooHR subdomain is the part before .bamboohr.com in your URL.
            </div>
          </div>
        ) : (
          <div style={styles.success}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                Connected to {bambooSubdomain}.bamboohr.com
              </span>
              <button style={styles.buttonSecondary} onClick={handleDisconnectBamboo}>
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Team Members Selection */}
      <div style={styles.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={styles.sectionTitle}>
            Team Members ({selectedMemberIds.size} selected)
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              style={styles.buttonSmall}
              onClick={handleRefresh}
              disabled={membersLoading}
            >
              {membersLoading ? 'Refreshing...' : 'Refresh'}
            </button>
            <button style={styles.buttonSmall} onClick={selectAllMembers}>
              Select All
            </button>
            <button style={styles.buttonSmall} onClick={clearSelection}>
              Clear
            </button>
          </div>
        </div>

        <div style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>
          Select the team members whose time off should be factored into sprint capacity.
        </div>

        {membersLoading ? (
          <div style={styles.loading}>Loading project members...</div>
        ) : projectMembers.length === 0 ? (
          <div style={styles.info}>No members found in recent sprints.</div>
        ) : (
          <div style={styles.membersList}>
            {projectMembers.map(member => (
              <div
                key={member.accountId}
                style={{
                  ...styles.memberItem,
                  ...(selectedMemberIds.has(member.accountId) ? styles.memberItemSelected : {})
                }}
                onClick={() => toggleMember(member.accountId)}
              >
                <input
                  type="checkbox"
                  style={styles.checkbox}
                  checked={selectedMemberIds.has(member.accountId)}
                  onChange={() => {}}
                />
                {member.avatarUrl && (
                  <img src={member.avatarUrl} alt="" style={styles.memberAvatar} />
                )}
                <span style={styles.memberName}>{member.displayName}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default CapacityPlanning
