import { useState, useEffect, useRef } from 'react'
import { getProjectMembers, searchJiraUsers, getHolidays, getTeamTimeOff, loadStoredCredentials, saveStoredCredentials } from '../services/api'
const SELECTED_MEMBERS_KEY = 'sprintAnalyzer_selectedMembers'
const ADDED_MEMBERS_KEY = 'sprintAnalyzer_addedMembers'

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
  },
  searchContainer: {
    position: 'relative',
    marginBottom: '16px'
  },
  searchInput: {
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    width: '300px'
  },
  searchDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    maxWidth: '400px',
    background: 'white',
    border: '1px solid #ddd',
    borderRadius: '4px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    zIndex: 1000,
    maxHeight: '300px',
    overflowY: 'auto'
  },
  searchResult: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    cursor: 'pointer',
    borderBottom: '1px solid #f0f0f0'
  },
  searchResultHover: {
    background: '#f5f5f5'
  },
  searchResultAdded: {
    background: '#E3FCEF',
    color: '#00875A'
  },
  noResults: {
    padding: '12px',
    color: '#666',
    fontSize: '13px',
    textAlign: 'center'
  },
  upcomingSection: {
    marginTop: '24px',
    background: 'white',
    borderRadius: '8px',
    padding: '20px',
    border: '1px solid #e9ecef'
  },
  upcomingTitle: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '16px',
    color: '#333'
  },
  upcomingSubtitle: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#666',
    marginTop: '16px',
    marginBottom: '8px'
  },
  timeOffItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    background: '#FFFAE6',
    borderRadius: '4px',
    marginBottom: '8px',
    fontSize: '13px'
  },
  holidayItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    background: '#F4F5F7',
    borderRadius: '4px',
    marginBottom: '8px',
    fontSize: '13px'
  },
  dateRange: {
    color: '#666',
    fontSize: '12px'
  },
  emptyState: {
    color: '#666',
    fontSize: '13px',
    fontStyle: 'italic',
    padding: '8px 0'
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

function CapacityPlanning({ credentials, boardId }) {
  // BambooHR credentials
  const [bambooToken, setBambooToken] = useState('')
  const [bambooSubdomain, setBambooSubdomain] = useState('')
  const [bambooConnected, setBambooConnected] = useState(false)

  // Project members
  const [projectMembers, setProjectMembers] = useState([])
  const [addedMembers, setAddedMembers] = useState([]) // Manually added via search
  const [selectedMemberIds, setSelectedMemberIds] = useState(new Set())
  const [membersLoading, setMembersLoading] = useState(false)

  // User search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const searchRef = useRef(null)
  const searchTimeoutRef = useRef(null)

  // Upcoming time off and holidays
  const [upcomingTimeOff, setUpcomingTimeOff] = useState([])
  const [upcomingHolidays, setUpcomingHolidays] = useState([])
  const [upcomingLoading, setUpcomingLoading] = useState(false)

  const [error, setError] = useState(null)

  // Load saved credentials and selected members on mount
  useEffect(() => {
    async function loadBambooCredentials() {
      try {
        const stored = await loadStoredCredentials()
        if (stored?.bamboo) {
          setBambooToken(stored.bamboo.token)
          setBambooSubdomain(stored.bamboo.subdomain)
          setBambooConnected(true)
        }
      } catch (e) {
        // No stored credentials
      }
    }
    loadBambooCredentials()

    const savedMembers = loadFromStorage(`${SELECTED_MEMBERS_KEY}_${boardId}`, [])
    if (savedMembers.length > 0) {
      setSelectedMemberIds(new Set(savedMembers))
    }
    const savedAddedMembers = loadFromStorage(`${ADDED_MEMBERS_KEY}_${boardId}`, [])
    if (savedAddedMembers.length > 0) {
      setAddedMembers(savedAddedMembers)
    }
  }, [boardId])

  // Load project members when board changes
  useEffect(() => {
    if (boardId) {
      loadProjectMembers()
    }
  }, [boardId, credentials])

  // Close search dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (searchQuery.length < 2) {
      setSearchResults([])
      setShowSearchDropdown(false)
      return
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const users = await searchJiraUsers(credentials, searchQuery)
        setSearchResults(users)
        setShowSearchDropdown(true)
      } catch (err) {
        console.error('Search failed:', err)
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery, credentials])

  // Load upcoming time off and holidays when BambooHR is connected
  useEffect(() => {
    if (!bambooConnected || !boardId) {
      setUpcomingTimeOff([])
      setUpcomingHolidays([])
      return
    }

    const loadUpcomingData = async () => {
      setUpcomingLoading(true)

      // Get dates: today to 3 months from now
      const today = new Date()
      const threeMonthsLater = new Date()
      threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3)

      const startDate = today.toISOString().split('T')[0]
      const endDate = threeMonthsLater.toISOString().split('T')[0]

      const bambooCredentials = { token: bambooToken, subdomain: bambooSubdomain }

      try {
        // Load holidays and time off in parallel
        const [holidaysResult, timeOffResult] = await Promise.all([
          getHolidays(credentials, bambooCredentials, startDate, endDate).catch(() => ({ holidays: [] })),
          getTeamTimeOff(credentials, bambooCredentials, boardId, null, startDate, endDate).catch(() => ({ timeOff: [] }))
        ])

        // Filter time off to only include selected team members
        const selectedEmails = [...projectMembers, ...addedMembers]
          .filter(m => selectedMemberIds.has(m.accountId) && m.email)
          .map(m => m.email.toLowerCase())

        const filteredTimeOff = (timeOffResult.timeOff || []).filter(pto => {
          const ptoEmail = pto.email?.toLowerCase()
          return selectedEmails.includes(ptoEmail)
        })

        // Sort by start date
        filteredTimeOff.sort((a, b) => new Date(a.startDate) - new Date(b.startDate))

        setUpcomingHolidays(holidaysResult.holidays || [])
        setUpcomingTimeOff(filteredTimeOff)
      } catch (err) {
        console.error('Failed to load upcoming data:', err)
        setUpcomingHolidays([])
        setUpcomingTimeOff([])
      } finally {
        setUpcomingLoading(false)
      }
    }

    loadUpcomingData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bambooConnected, bambooToken, bambooSubdomain, boardId, credentials, selectedMemberIds.size])

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

  const handleConnectBamboo = async () => {
    if (!bambooToken || !bambooSubdomain) {
      setError('Please enter both BambooHR API key and subdomain.')
      return
    }
    try {
      await saveStoredCredentials({
        bamboo: { token: bambooToken, subdomain: bambooSubdomain }
      })
    } catch (e) {
      console.error('Failed to save Bamboo credentials:', e)
    }
    setBambooConnected(true)
    setError(null)
  }

  const handleDisconnectBamboo = async () => {
    try {
      // Clear bamboo credentials by saving null
      const stored = await loadStoredCredentials()
      if (stored?.bamboo) {
        delete stored.bamboo
        await saveStoredCredentials(stored.jira ? { jira: stored.jira } : {})
      }
    } catch (e) {
      console.error('Failed to clear Bamboo credentials:', e)
    }
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
    const allMembersList = [...projectMembers, ...addedMembers]
    const allIds = new Set(allMembersList.map(m => m.accountId))
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

  // Add user from search
  const addUserFromSearch = (user) => {
    // Check if already in project members or added members
    const allMemberIds = new Set([
      ...projectMembers.map(m => m.accountId),
      ...addedMembers.map(m => m.accountId)
    ])

    if (allMemberIds.has(user.accountId)) {
      // Already exists, just close dropdown
      setShowSearchDropdown(false)
      setSearchQuery('')
      return
    }

    // Add to manually added members
    const newAddedMembers = [...addedMembers, user]
    setAddedMembers(newAddedMembers)
    saveToStorage(`${ADDED_MEMBERS_KEY}_${boardId}`, newAddedMembers)

    // Auto-select the newly added user
    const newSelected = new Set(selectedMemberIds)
    newSelected.add(user.accountId)
    setSelectedMemberIds(newSelected)
    saveToStorage(`${SELECTED_MEMBERS_KEY}_${boardId}`, [...newSelected])

    // Clear search
    setShowSearchDropdown(false)
    setSearchQuery('')
  }

  // Remove manually added member
  const removeAddedMember = (accountId) => {
    const newAddedMembers = addedMembers.filter(m => m.accountId !== accountId)
    setAddedMembers(newAddedMembers)
    saveToStorage(`${ADDED_MEMBERS_KEY}_${boardId}`, newAddedMembers)

    // Also remove from selection
    const newSelected = new Set(selectedMemberIds)
    newSelected.delete(accountId)
    setSelectedMemberIds(newSelected)
    saveToStorage(`${SELECTED_MEMBERS_KEY}_${boardId}`, [...newSelected])
  }

  // Check if user is already in the list
  const isUserInList = (accountId) => {
    return projectMembers.some(m => m.accountId === accountId) ||
           addedMembers.some(m => m.accountId === accountId)
  }

  // Combine project members and added members
  const allMembers = [...projectMembers, ...addedMembers]

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

        {/* User Search */}
        <div style={styles.searchContainer} ref={searchRef}>
          <input
            type="text"
            style={styles.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchQuery.length >= 2 && setShowSearchDropdown(true)}
            placeholder="Search to add team members..."
          />
          {searchLoading && (
            <span style={{ position: 'absolute', right: '12px', top: '10px', color: '#666', fontSize: '12px' }}>
              Searching...
            </span>
          )}
          {showSearchDropdown && searchResults.length > 0 && (
            <div style={styles.searchDropdown}>
              {searchResults.map(user => {
                const alreadyAdded = isUserInList(user.accountId)
                return (
                  <div
                    key={user.accountId}
                    style={{
                      ...styles.searchResult,
                      ...(alreadyAdded ? styles.searchResultAdded : {})
                    }}
                    onClick={() => !alreadyAdded && addUserFromSearch(user)}
                    onMouseEnter={(e) => !alreadyAdded && (e.currentTarget.style.background = '#f5f5f5')}
                    onMouseLeave={(e) => !alreadyAdded && (e.currentTarget.style.background = 'white')}
                  >
                    {user.avatarUrl && (
                      <img src={user.avatarUrl} alt="" style={styles.memberAvatar} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px' }}>{user.displayName}</div>
                      {user.email && (
                        <div style={{ fontSize: '11px', color: '#666' }}>{user.email}</div>
                      )}
                    </div>
                    {alreadyAdded && (
                      <span style={{ fontSize: '11px' }}>Added</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {showSearchDropdown && searchQuery.length >= 2 && searchResults.length === 0 && !searchLoading && (
            <div style={styles.searchDropdown}>
              <div style={styles.noResults}>No users found</div>
            </div>
          )}
        </div>

        {membersLoading ? (
          <div style={styles.loading}>Loading project members...</div>
        ) : allMembers.length === 0 ? (
          <div style={styles.info}>No members found. Use the search above to add team members.</div>
        ) : (
          <div style={styles.membersList}>
            {allMembers.map(member => {
              const isManuallyAdded = addedMembers.some(m => m.accountId === member.accountId)
              return (
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
                  {isManuallyAdded && (
                    <button
                      style={{
                        ...styles.buttonSmall,
                        padding: '2px 6px',
                        fontSize: '10px',
                        color: '#DE350B',
                        borderColor: '#DE350B'
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        removeAddedMember(member.accountId)
                      }}
                      title="Remove from list"
                    >
                      ×
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Upcoming Time Off & Holidays Section */}
      {bambooConnected && (
        <div style={styles.upcomingSection}>
          <div style={styles.upcomingTitle}>Upcoming Time Off & Holidays</div>

          {upcomingLoading ? (
            <div style={styles.loading}>Loading upcoming schedule...</div>
          ) : (
            <>
              {/* Holidays */}
              <div style={styles.upcomingSubtitle}>Company Holidays (Next 3 Months)</div>
              {upcomingHolidays.length > 0 ? (
                upcomingHolidays.map((holiday, idx) => (
                  <div key={idx} style={styles.holidayItem}>
                    <span style={{ fontWeight: '500' }}>{holiday.name}</span>
                    <span style={styles.dateRange}>
                      {formatDisplayDate(holiday.date)}
                      {holiday.endDate && holiday.endDate !== holiday.date && ` - ${formatDisplayDate(holiday.endDate)}`}
                    </span>
                  </div>
                ))
              ) : (
                <div style={styles.emptyState}>No upcoming holidays</div>
              )}

              {/* Team Time Off */}
              <div style={styles.upcomingSubtitle}>Team Member Vacations (Next 3 Months)</div>
              {selectedMemberIds.size === 0 ? (
                <div style={styles.emptyState}>Select team members above to see their upcoming time off</div>
              ) : upcomingTimeOff.length > 0 ? (
                upcomingTimeOff.map((pto, idx) => (
                  <div key={idx} style={styles.timeOffItem}>
                    <div>
                      <span style={{ fontWeight: '500' }}>{pto.employeeName}</span>
                      <span style={{ color: '#666', marginLeft: '8px' }}>({pto.type || 'Time Off'})</span>
                    </div>
                    <span style={styles.dateRange}>
                      {formatDisplayDate(pto.startDate)}
                      {pto.startDate !== pto.endDate && ` - ${formatDisplayDate(pto.endDate)}`}
                    </span>
                  </div>
                ))
              ) : (
                <div style={styles.emptyState}>No upcoming time off scheduled</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// Helper to format dates nicely (parses as local time to avoid timezone shift)
function formatDisplayDate(dateStr) {
  if (!dateStr) return ''
  // Parse date parts to avoid timezone conversion issues
  // "2024-12-25" should display as Dec 25, not Dec 24
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default CapacityPlanning
