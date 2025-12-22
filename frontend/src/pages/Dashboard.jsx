import { useState, useEffect, useCallback, useRef } from 'react'
import { getBoards, getMetricsSummary, getFutureSprints, getActiveSprint, getPlanningMetrics, getCapacity, getContributorVelocity, getProjectMembers, getTimeInStatusMetrics, getSprintCarryoverMetrics } from '../services/api'
import BoardSelector from '../components/BoardSelector'
import DateRangeSelector from '../components/DateRangeSelector'
import SpaceExclusionList from '../components/SpaceExclusionList'
import MetricCard from '../components/MetricCard'
import VelocityChart from '../components/VelocityChart'
import CompletionChart from '../components/CompletionChart'
import QualityMetrics from '../components/QualityMetrics'
import AlignmentChart from '../components/AlignmentChart'
import TimeInStatusChart from '../components/TimeInStatusChart'
import SprintCarryoverChart from '../components/SprintCarryoverChart'
import SprintSelector from '../components/SprintSelector'
import PlanningMetrics from '../components/PlanningMetrics'
import CapacityPlanning from '../components/CapacityPlanning'
import LoadingStatusModal from '../components/LoadingStatusModal'

const RECENT_BOARDS_KEY = 'sprintAnalyzer_recentBoards'
const METRICS_CACHE_KEY = 'sprintAnalyzer_metricsCache'
const EXCLUDED_SPACES_KEY = 'sprintAnalyzer_excludedSpaces'
const SERVICE_LABEL_KEY = 'sprintAnalyzer_serviceLabel'
const BAMBOO_CREDENTIALS_KEY = 'sprintAnalyzer_bambooCredentials'
const SELECTED_MEMBERS_KEY = 'sprintAnalyzer_selectedMembers'
const MAX_RECENT_BOARDS = 5
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

const styles = {
  container: {
    minHeight: '100vh',
    background: '#f5f5f5'
  },
  header: {
    background: 'white',
    borderBottom: '1px solid #ddd',
    padding: '16px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: {
    fontSize: '20px',
    fontWeight: '600'
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%'
  },
  logoutBtn: {
    background: 'none',
    border: '1px solid #ddd',
    borderRadius: '4px',
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  main: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '24px'
  },
  controls: {
    background: 'white',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  controlsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    flexWrap: 'wrap'
  },
  dateRangeWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  dateRangeLabel: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#666'
  },
  metricsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  metricsTitle: {
    fontSize: '14px',
    color: '#666'
  },
  refreshBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'none',
    border: '1px solid #ddd',
    borderRadius: '4px',
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: '13px',
    color: '#333'
  },
  refreshBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed'
  },
  cacheInfo: {
    fontSize: '11px',
    color: '#999',
    marginLeft: '8px'
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '24px'
  },
  chartSection: {
    background: 'white',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    marginBottom: '24px'
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '4px'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px'
  },
  chartCallouts: {
    display: 'flex',
    gap: '24px',
    flexWrap: 'wrap'
  },
  callout: {
    textAlign: 'right'
  },
  calloutLabel: {
    fontSize: '11px',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  calloutValue: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#1a1a1a'
  },
  calloutUnit: {
    fontSize: '12px',
    fontWeight: '400',
    color: '#666'
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: '#666'
  },
  error: {
    background: '#FFEBE6',
    border: '1px solid #DE350B',
    borderRadius: '4px',
    padding: '12px',
    color: '#DE350B',
    marginBottom: '16px'
  },
  tabContainer: {
    marginBottom: '24px'
  },
  tabs: {
    display: 'flex',
    gap: '0',
    borderBottom: '1px solid #ddd'
  },
  tab: {
    padding: '12px 24px',
    background: '#f5f5f5',
    border: '1px solid #ddd',
    borderBottom: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    color: '#666',
    marginRight: '-1px',
    marginBottom: '-1px',
    position: 'relative',
    transition: 'background 0.15s, color 0.15s'
  },
  tabFirst: {
    borderTopLeftRadius: '8px'
  },
  tabLast: {
    borderTopRightRadius: '8px'
  },
  tabActive: {
    background: 'white',
    color: '#0052CC',
    zIndex: 1,
    borderBottomColor: 'white'
  },
  tabContent: {
    background: 'white',
    borderRadius: '0 0 8px 8px',
    border: '1px solid #ddd',
    borderTop: 'none',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  planningControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
    marginBottom: '24px',
    flexWrap: 'wrap'
  }
}

// Helper to load from localStorage
function loadFromStorage(key, defaultValue) {
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : defaultValue
  } catch {
    return defaultValue
  }
}

// Helper to save to localStorage
function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore storage errors
  }
}

function Dashboard({ credentials, onLogout }) {
  const [boards, setBoards] = useState([])
  const [selectedBoard, setSelectedBoard] = useState(null)
  const [dateRange, setDateRange] = useState(null) // null = last 6 sprints default
  const [excludedSpaces, setExcludedSpaces] = useState([])
  const [serviceLabel, setServiceLabel] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showLoadingModal, setShowLoadingModal] = useState(false)
  const [error, setError] = useState(null)
  const [recentBoards, setRecentBoards] = useState([])
  const [metricsCache, setMetricsCache] = useState({})
  const [lastFetched, setLastFetched] = useState(null)

  // Tab state
  const [activeTab, setActiveTab] = useState('metrics')

  // Planning tab state
  const [availableSprints, setAvailableSprints] = useState([])
  const [selectedSprint, setSelectedSprint] = useState(null)
  const [planningMetrics, setPlanningMetrics] = useState(null)
  const [planningLoading, setPlanningLoading] = useState(false)
  const [sprintsLoading, setSprintsLoading] = useState(false)
  const [velocitySprintCount, setVelocitySprintCount] = useState(6)

  // Capacity/velocity impact state
  const [capacityData, setCapacityData] = useState(null)
  const [contributorVelocity, setContributorVelocity] = useState(null)
  const [capacityLoading, setCapacityLoading] = useState(false)
  const [projectMembers, setProjectMembers] = useState([])

  // Workflow health metrics state
  const [timeInStatusData, setTimeInStatusData] = useState(null)
  const [carryoverData, setCarryoverData] = useState(null)
  const [workflowMetricsLoading, setWorkflowMetricsLoading] = useState(false)

  // Ref to track sprint that was just loaded by the main planning effect
  const lastLoadedSprintRef = useRef(null)

  // Load recent boards, cache, excluded spaces, and service label from localStorage on mount
  useEffect(() => {
    setRecentBoards(loadFromStorage(RECENT_BOARDS_KEY, []))
    setMetricsCache(loadFromStorage(METRICS_CACHE_KEY, {}))
    setExcludedSpaces(loadFromStorage(EXCLUDED_SPACES_KEY, []))
    setServiceLabel(loadFromStorage(SERVICE_LABEL_KEY, null))
  }, [])

  // Load boards list
  useEffect(() => {
    loadBoards()
  }, [])

  // Load metrics when board, date range, excluded spaces, or service label change
  useEffect(() => {
    if (selectedBoard) {
      loadMetrics(selectedBoard, false)
    } else {
      setMetrics(null)
      setLastFetched(null)
    }
  }, [selectedBoard, dateRange, excludedSpaces, serviceLabel])

  // Load workflow health metrics (time in status & carryover) when on metrics tab
  useEffect(() => {
    if (activeTab === 'metrics' && selectedBoard) {
      loadWorkflowMetrics(selectedBoard)
    } else {
      setTimeInStatusData(null)
      setCarryoverData(null)
    }
  }, [activeTab, selectedBoard, dateRange])

  const loadBoards = async () => {
    try {
      const boardList = await getBoards(credentials)
      setBoards(boardList)
    } catch (err) {
      setError('Failed to load boards')
    }
  }

  const loadMetrics = useCallback(async (boardId, forceRefresh = false) => {
    // Build cache key including date range or sprint count, excluded spaces, and service label
    let rangeKey = 'default'
    if (dateRange) {
      if (dateRange.sprintCount) {
        rangeKey = `sprints_${dateRange.sprintCount}`
      } else {
        rangeKey = `${dateRange.startDate}_${dateRange.endDate}`
      }
    }
    const excludeKey = excludedSpaces.length > 0 ? `_excl_${excludedSpaces.sort().join('-')}` : ''
    const serviceLabelKey = serviceLabel ? `_svc_${serviceLabel}` : ''
    const cacheKey = `${boardId}_${rangeKey}${excludeKey}${serviceLabelKey}`

    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cached = metricsCache[cacheKey]
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        setMetrics(cached.data)
        setLastFetched(new Date(cached.timestamp))
        return
      }
    }

    setLoading(true)
    setError(null)
    if (forceRefresh) {
      setShowLoadingModal(true)
    }

    try {
      const data = await getMetricsSummary(credentials, boardId, excludedSpaces, dateRange, serviceLabel)
      setMetrics(data)

      // Update cache with date-range-aware key
      const now = Date.now()
      const newCache = {
        ...metricsCache,
        [cacheKey]: { data, timestamp: now }
      }
      setMetricsCache(newCache)
      saveToStorage(METRICS_CACHE_KEY, newCache)
      setLastFetched(new Date(now))

      // Update recent boards
      updateRecentBoards(boardId)
    } catch (err) {
      setError('Failed to load metrics')
    } finally {
      setLoading(false)
      setShowLoadingModal(false)
    }
  }, [credentials, metricsCache, dateRange, excludedSpaces, serviceLabel])

  const updateRecentBoards = (boardId) => {
    const board = boards.find(b => b.id === boardId)
    if (!board) return

    const newRecent = [
      { id: board.id, name: board.name, projectKey: board.projectKey },
      ...recentBoards.filter(b => b.id !== boardId)
    ].slice(0, MAX_RECENT_BOARDS)

    setRecentBoards(newRecent)
    saveToStorage(RECENT_BOARDS_KEY, newRecent)
  }

  const loadWorkflowMetrics = async (boardId) => {
    setWorkflowMetricsLoading(true)
    try {
      const [timeInStatus, carryover] = await Promise.all([
        getTimeInStatusMetrics(credentials, boardId, dateRange),
        getSprintCarryoverMetrics(credentials, boardId, dateRange)
      ])
      setTimeInStatusData(timeInStatus)
      setCarryoverData(carryover)
    } catch (err) {
      console.error('Failed to load workflow metrics:', err)
      setTimeInStatusData(null)
      setCarryoverData(null)
    } finally {
      setWorkflowMetricsLoading(false)
    }
  }

  const handleExcludedSpacesChange = (newExcluded) => {
    setExcludedSpaces(newExcluded)
    saveToStorage(EXCLUDED_SPACES_KEY, newExcluded)
  }

  const handleServiceLabelChange = (newLabel) => {
    setServiceLabel(newLabel || null)
    saveToStorage(SERVICE_LABEL_KEY, newLabel || null)
  }

  const handleRefresh = () => {
    if (selectedBoard && !loading) {
      loadMetrics(selectedBoard, true)
    }
  }

  const handleSelectRecent = (boardId) => {
    setSelectedBoard(boardId)
  }

  // Load available sprints for planning (active + future)
  const loadAvailableSprints = useCallback(async (boardId) => {
    if (!boardId) {
      setAvailableSprints([])
      return
    }

    setSprintsLoading(true)
    try {
      const [activeSprints, futureSprints] = await Promise.all([
        getActiveSprint(credentials, boardId),
        getFutureSprints(credentials, boardId)
      ])
      const allSprints = [...activeSprints, ...futureSprints]
      setAvailableSprints(allSprints)

      // Auto-select active sprint if available
      if (activeSprints.length > 0 && !selectedSprint) {
        setSelectedSprint(activeSprints[0].id)
      } else if (allSprints.length > 0 && !selectedSprint) {
        setSelectedSprint(allSprints[0].id)
      }
    } catch (err) {
      console.error('Failed to load sprints:', err)
      setAvailableSprints([])
    } finally {
      setSprintsLoading(false)
    }
  }, [credentials, selectedSprint])

  // Load planning metrics for selected sprint
  const loadPlanningMetrics = useCallback(async (boardId, sprintId, forceRefresh = false) => {
    if (!boardId || !sprintId) {
      setPlanningMetrics(null)
      return
    }

    setPlanningLoading(true)
    setError(null)

    try {
      const data = await getPlanningMetrics(credentials, boardId, sprintId, velocitySprintCount)
      setPlanningMetrics(data)
    } catch (err) {
      setError('Failed to load planning metrics')
      setPlanningMetrics(null)
    } finally {
      setPlanningLoading(false)
    }
  }, [credentials, velocitySprintCount])

  // Load capacity and velocity data for planning tab
  const loadCapacityData = useCallback(async (boardId, sprint) => {
    if (!boardId || !sprint) {
      setCapacityData(null)
      return
    }

    // Get BambooHR credentials and selected members from localStorage
    const bambooCredentials = loadFromStorage(BAMBOO_CREDENTIALS_KEY, null)
    const selectedMemberIds = loadFromStorage(`${SELECTED_MEMBERS_KEY}_${boardId}`, [])

    if (!bambooCredentials || selectedMemberIds.length === 0) {
      setCapacityData(null)
      return
    }

    // Get emails of selected members
    const memberEmails = projectMembers
      .filter(m => selectedMemberIds.includes(m.accountId) && m.email)
      .map(m => m.email)

    if (memberEmails.length === 0) {
      setCapacityData(null)
      return
    }

    setCapacityLoading(true)
    try {
      const data = await getCapacity(
        credentials,
        bambooCredentials,
        boardId,
        sprint.startDate?.split('T')[0],
        sprint.endDate?.split('T')[0],
        memberEmails,
        selectedMemberIds.length
      )
      setCapacityData(data)
    } catch (err) {
      console.error('Failed to load capacity:', err)
      setCapacityData(null)
    } finally {
      setCapacityLoading(false)
    }
  }, [credentials, projectMembers])

  // Load contributor velocity data
  const loadContributorVelocity = useCallback(async (boardId) => {
    if (!boardId) {
      setContributorVelocity(null)
      return
    }

    try {
      const data = await getContributorVelocity(credentials, boardId, 6)
      setContributorVelocity(data)
    } catch (err) {
      console.error('Failed to load contributor velocity:', err)
      setContributorVelocity(null)
    }
  }, [credentials])

  // Load project members for a board
  const loadProjectMembers = useCallback(async (boardId) => {
    if (!boardId) {
      setProjectMembers([])
      return
    }

    try {
      const members = await getProjectMembers(credentials, boardId)
      // Filter out "Former User" entries
      const activeMembers = members.filter(m =>
        !m.displayName?.toLowerCase().includes('former user')
      )
      setProjectMembers(activeMembers)
    } catch (err) {
      console.error('Failed to load project members:', err)
      setProjectMembers([])
    }
  }, [credentials])

  // Load all planning tab data in a single coordinated effect
  useEffect(() => {
    if (activeTab !== 'planning' || !selectedBoard) return

    let cancelled = false

    const loadPlanningTabData = async () => {
      // Load sprints, members, and contributor velocity in parallel
      const [activeSprints, futureSprints, members, contribVelocity] = await Promise.all([
        getActiveSprint(credentials, selectedBoard).catch(() => []),
        getFutureSprints(credentials, selectedBoard).catch(() => []),
        getProjectMembers(credentials, selectedBoard).catch(() => []),
        getContributorVelocity(credentials, selectedBoard, 6).catch(() => null)
      ])

      if (cancelled) return

      const allSprints = [...activeSprints, ...futureSprints]
      setAvailableSprints(allSprints)

      const activeMembers = members.filter(m =>
        !m.displayName?.toLowerCase().includes('former user')
      )
      setProjectMembers(activeMembers)
      setContributorVelocity(contribVelocity)

      // Auto-select active sprint if none selected
      let sprintToSelect = selectedSprint
      if (!sprintToSelect && activeSprints.length > 0) {
        sprintToSelect = activeSprints[0].id
        setSelectedSprint(sprintToSelect)
      } else if (!sprintToSelect && allSprints.length > 0) {
        sprintToSelect = allSprints[0].id
        setSelectedSprint(sprintToSelect)
      }

      // Now load sprint-specific data if we have a sprint
      if (sprintToSelect) {
        const sprint = allSprints.find(s => s.id === sprintToSelect)
        lastLoadedSprintRef.current = sprintToSelect
        await loadSprintData(sprintToSelect, sprint, activeMembers)
      }
    }

    const loadSprintData = async (sprintId, sprint, members) => {
      if (cancelled) return

      setPlanningLoading(true)
      setCapacityLoading(true)

      try {
        // Load planning metrics
        const metricsData = await getPlanningMetrics(credentials, selectedBoard, sprintId, velocitySprintCount)
        if (!cancelled) setPlanningMetrics(metricsData)
      } catch (err) {
        if (!cancelled) setPlanningMetrics(null)
      } finally {
        if (!cancelled) setPlanningLoading(false)
      }

      // Load capacity data if configured
      const bambooCredentials = loadFromStorage(BAMBOO_CREDENTIALS_KEY, null)
      const selectedMemberIds = loadFromStorage(`${SELECTED_MEMBERS_KEY}_${selectedBoard}`, [])

      if (bambooCredentials && selectedMemberIds.length > 0 && sprint) {
        const memberEmails = members
          .filter(m => selectedMemberIds.includes(m.accountId) && m.email)
          .map(m => m.email)

        if (memberEmails.length > 0) {
          try {
            const capacityResult = await getCapacity(
              credentials,
              bambooCredentials,
              selectedBoard,
              sprint.startDate?.split('T')[0],
              sprint.endDate?.split('T')[0],
              memberEmails,
              selectedMemberIds.length
            )
            if (!cancelled) setCapacityData(capacityResult)
          } catch (err) {
            if (!cancelled) setCapacityData(null)
          }
        } else {
          if (!cancelled) setCapacityData(null)
        }
      } else {
        if (!cancelled) setCapacityData(null)
      }

      if (!cancelled) setCapacityLoading(false)
    }

    setSprintsLoading(true)
    loadPlanningTabData().finally(() => {
      if (!cancelled) setSprintsLoading(false)
    })

    return () => { cancelled = true }
  }, [activeTab, selectedBoard, credentials, velocitySprintCount])

  // Load sprint-specific data when sprint selection changes (user picks different sprint)
  useEffect(() => {
    if (activeTab !== 'planning' || !selectedBoard || !selectedSprint || availableSprints.length === 0) return

    // Skip if this sprint was just loaded by the main planning effect
    if (lastLoadedSprintRef.current === selectedSprint) {
      lastLoadedSprintRef.current = null // Reset so future changes work
      return
    }

    const sprint = availableSprints.find(s => s.id === selectedSprint)
    if (!sprint) return

    let cancelled = false

    const loadSprintSpecificData = async () => {
      setPlanningLoading(true)
      setCapacityLoading(true)

      try {
        const metricsData = await getPlanningMetrics(credentials, selectedBoard, selectedSprint, velocitySprintCount)
        if (!cancelled) setPlanningMetrics(metricsData)
      } catch (err) {
        if (!cancelled) setPlanningMetrics(null)
      } finally {
        if (!cancelled) setPlanningLoading(false)
      }

      // Load capacity data if configured
      const bambooCredentials = loadFromStorage(BAMBOO_CREDENTIALS_KEY, null)
      const selectedMemberIds = loadFromStorage(`${SELECTED_MEMBERS_KEY}_${selectedBoard}`, [])

      if (bambooCredentials && selectedMemberIds.length > 0 && projectMembers.length > 0) {
        const memberEmails = projectMembers
          .filter(m => selectedMemberIds.includes(m.accountId) && m.email)
          .map(m => m.email)

        if (memberEmails.length > 0) {
          try {
            const capacityResult = await getCapacity(
              credentials,
              bambooCredentials,
              selectedBoard,
              sprint.startDate?.split('T')[0],
              sprint.endDate?.split('T')[0],
              memberEmails,
              selectedMemberIds.length
            )
            if (!cancelled) setCapacityData(capacityResult)
          } catch (err) {
            if (!cancelled) setCapacityData(null)
          }
        } else {
          if (!cancelled) setCapacityData(null)
        }
      } else {
        if (!cancelled) setCapacityData(null)
      }

      if (!cancelled) setCapacityLoading(false)
    }

    loadSprintSpecificData()

    return () => { cancelled = true }
  }, [selectedSprint])

  // Reset planning state when board changes
  useEffect(() => {
    setSelectedSprint(null)
    setPlanningMetrics(null)
    setAvailableSprints([])
  }, [selectedBoard])

  const handlePlanningRefresh = () => {
    if (selectedBoard && selectedSprint) {
      loadPlanningMetrics(selectedBoard, selectedSprint, true)
    }
  }

  const formatLastFetched = () => {
    if (!lastFetched) return ''
    const now = new Date()
    const diffMs = now - lastFetched
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'just now'
    if (diffMins === 1) return '1 min ago'
    if (diffMins < 60) return `${diffMins} mins ago`
    return lastFetched.toLocaleTimeString()
  }

  // Get sprint count label for chart titles
  const getSprintCountLabel = () => {
    const count = metrics?.velocity?.sprints?.length || 0
    if (count === 0) return ''
    return `(${count} Sprint${count === 1 ? '' : 's'})`
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Sprint Analyzer</h1>
        <div style={styles.userInfo}>
          {credentials.user?.avatarUrl && (
            <img
              src={credentials.user.avatarUrl}
              alt=""
              style={styles.avatar}
            />
          )}
          <span>{credentials.user?.displayName || credentials.email}</span>
          <button style={styles.logoutBtn} onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.controls}>
          <div style={styles.controlsRow}>
            <BoardSelector
              boards={boards}
              selectedBoard={selectedBoard}
              onSelect={setSelectedBoard}
              recentBoards={recentBoards}
              onSelectRecent={handleSelectRecent}
            />
            <div style={styles.dateRangeWrapper}>
              <span style={styles.dateRangeLabel}>Time period:</span>
              <DateRangeSelector
                value={dateRange}
                onChange={setDateRange}
              />
            </div>
          </div>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {/* Tab Navigation and Content */}
        {selectedBoard && (
          <div style={styles.tabContainer}>
            <div style={styles.tabs}>
              <button
                style={{
                  ...styles.tab,
                  ...styles.tabFirst,
                  ...(activeTab === 'metrics' ? styles.tabActive : {})
                }}
                onClick={() => setActiveTab('metrics')}
              >
                Metrics
              </button>
              <button
                style={{
                  ...styles.tab,
                  ...(activeTab === 'planning' ? styles.tabActive : {})
                }}
                onClick={() => setActiveTab('planning')}
              >
                Planning
              </button>
              <button
                style={{
                  ...styles.tab,
                  ...styles.tabLast,
                  ...(activeTab === 'capacity' ? styles.tabActive : {})
                }}
                onClick={() => setActiveTab('capacity')}
              >
                Capacity
              </button>
            </div>

            {/* Metrics Tab Content */}
            {activeTab === 'metrics' && (
              <div style={styles.tabContent}>
                {showLoadingModal && <LoadingStatusModal isOpen={showLoadingModal} />}

                {loading && !showLoadingModal && <div style={styles.loading}>Loading metrics...</div>}

                {metrics && !loading && !showLoadingModal && (
                  <>
                    <div style={styles.metricsHeader}>
                      <span style={styles.metricsTitle}>
                        Sprint Metrics
                        {lastFetched && (
                          <span style={styles.cacheInfo}>
                            Updated {formatLastFetched()}
                          </span>
                        )}
                      </span>
                      <button
                        style={{
                          ...styles.refreshBtn,
                          ...(loading ? styles.refreshBtnDisabled : {})
                        }}
                        onClick={handleRefresh}
                        disabled={loading}
                        title="Refresh metrics"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                        </svg>
                        Refresh
                      </button>
                    </div>

                    <div style={styles.metricsGrid}>
              <MetricCard
                title="Average Velocity"
                value={metrics.velocity?.averageVelocity || 0}
                unit="pts/sprint"
              />
              <MetricCard
                title="Completion Rate"
                value={metrics.completion?.averageCompletionRate || 0}
                unit="%"
              />
              <MetricCard
                title="Story Point Coverage"
                value={metrics.coverage?.sprints?.[0]?.coveragePercentage || 0}
                unit="%"
              />
              <MetricCard
                title="Fallback Avg Points"
                value={metrics.coverage?.fallbackAveragePoints || 0}
                unit="pts"
              />
            </div>

            <div style={styles.chartSection}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>Velocity Trend {getSprintCountLabel()}</h2>
                <div style={styles.chartCallouts}>
                  <div style={styles.callout}>
                    <div style={styles.calloutLabel}>Average</div>
                    <div style={styles.calloutValue}>
                      {(metrics.velocity?.averageVelocity || 0).toFixed(1)}
                      <span style={styles.calloutUnit}> pts</span>
                    </div>
                  </div>
                </div>
              </div>
              <VelocityChart data={metrics.velocity?.sprints || []} />
            </div>

            <div style={styles.chartSection}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>Completion Rate {getSprintCountLabel()}</h2>
                <div style={styles.chartCallouts}>
                  <div style={styles.callout}>
                    <div style={styles.calloutLabel}>Average</div>
                    <div style={styles.calloutValue}>
                      {(metrics.completion?.averageCompletionRate || 0).toFixed(1)}
                      <span style={styles.calloutUnit}>%</span>
                    </div>
                  </div>
                </div>
              </div>
              <CompletionChart data={metrics.completion?.sprints || []} />
            </div>

            <div style={styles.chartSection}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>Quality Metrics {getSprintCountLabel()}</h2>
                <div style={styles.chartCallouts}>
                  {(() => {
                    const sprints = metrics.quality?.sprints || []
                    const avgBugRatio = sprints.length > 0
                      ? sprints.reduce((sum, s) => sum + s.bugRatio, 0) / sprints.length
                      : 0
                    const avgIncomplete = sprints.length > 0
                      ? sprints.reduce((sum, s) => sum + s.incompletePercentage, 0) / sprints.length
                      : 0
                    const avgAge = sprints.length > 0
                      ? sprints.reduce((sum, s) => sum + s.averageTicketAgeDays, 0) / sprints.length
                      : 0
                    return (
                      <>
                        <div style={styles.callout}>
                          <div style={styles.calloutLabel}>Avg Bug Ratio</div>
                          <div style={styles.calloutValue}>
                            {avgBugRatio.toFixed(1)}
                            <span style={styles.calloutUnit}>%</span>
                          </div>
                        </div>
                        <div style={styles.callout}>
                          <div style={styles.calloutLabel}>Avg Incomplete</div>
                          <div style={styles.calloutValue}>
                            {avgIncomplete.toFixed(1)}
                            <span style={styles.calloutUnit}>%</span>
                          </div>
                        </div>
                        <div style={styles.callout}>
                          <div style={styles.calloutLabel}>Avg Ticket Age</div>
                          <div style={styles.calloutValue}>
                            {avgAge.toFixed(1)}
                            <span style={styles.calloutUnit}> days</span>
                          </div>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>
              <QualityMetrics data={metrics.quality?.sprints || []} />
            </div>

            <div style={styles.chartSection}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>Strategic Alignment {getSprintCountLabel()}</h2>
                <div style={styles.chartCallouts}>
                  {(() => {
                    const sprints = metrics.alignment?.sprints || []
                    const totalLinked = sprints.reduce((sum, s) => sum + (s.linkedToInitiative || 0), 0)
                    const totalOrphan = sprints.reduce((sum, s) => sum + (s.orphanCount || 0), 0)
                    const total = totalLinked + totalOrphan
                    const linkedPct = total > 0 ? (totalLinked / total * 100) : 0
                    return (
                      <>
                        <div style={styles.callout}>
                          <div style={styles.calloutLabel}>Initiative-Linked</div>
                          <div style={styles.calloutValue}>
                            {linkedPct.toFixed(1)}
                            <span style={styles.calloutUnit}>%</span>
                          </div>
                        </div>
                        <div style={styles.callout}>
                          <div style={styles.calloutLabel}>Total Points</div>
                          <div style={styles.calloutValue}>
                            {total.toFixed(1)}
                            <span style={styles.calloutUnit}> pts</span>
                          </div>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <SpaceExclusionList
                  discoveredSpaces={metrics.alignment?.discoveredSpaces || []}
                  excludedSpaces={excludedSpaces}
                  onChange={handleExcludedSpacesChange}
                />
                {(metrics.alignment?.allLabels?.length > 0) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '13px', color: '#666', fontWeight: '500' }}>
                      Service Label:
                    </label>
                    <select
                      value={serviceLabel || ''}
                      onChange={(e) => handleServiceLabelChange(e.target.value)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '4px',
                        border: '1px solid #ddd',
                        fontSize: '13px',
                        minWidth: '150px'
                      }}
                    >
                      <option value="">None (show all as business)</option>
                      {metrics.alignment.allLabels.map(label => (
                        <option key={label} value={label}>{label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <AlignmentChart
                data={metrics.alignment?.sprints || []}
                discoveredSpaces={(metrics.alignment?.discoveredSpaces || []).map(space => ({
                  ...space,
                  isExcluded: excludedSpaces.includes(space.projectKey)
                }))}
                jiraServer={credentials.server}
                serviceLabel={serviceLabel}
              />
            </div>

            <div style={styles.chartSection}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>Workflow Health {getSprintCountLabel()}</h2>
              </div>
              {workflowMetricsLoading && <div style={styles.loading}>Loading workflow metrics...</div>}
              {!workflowMetricsLoading && timeInStatusData && (
                <TimeInStatusChart data={timeInStatusData} />
              )}
            </div>

            <div style={styles.chartSection}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>Sprint Carryover Analysis {getSprintCountLabel()}</h2>
              </div>
              {workflowMetricsLoading && <div style={styles.loading}>Loading carryover metrics...</div>}
              {!workflowMetricsLoading && carryoverData && (
                <SprintCarryoverChart data={carryoverData} />
              )}
            </div>
                  </>
                )}
              </div>
            )}

            {/* Planning Tab Content */}
            {activeTab === 'planning' && (
              <div style={styles.tabContent}>
                <div style={styles.planningControls}>
                  <SprintSelector
                    sprints={availableSprints}
                    selectedSprint={selectedSprint}
                    onSelect={setSelectedSprint}
                    loading={sprintsLoading}
                  />
                </div>

                {planningLoading && <div style={styles.loading}>Loading planning metrics...</div>}

                {!planningLoading && selectedSprint && planningMetrics && (
                  <PlanningMetrics
                    metrics={planningMetrics}
                    loading={planningLoading}
                    velocitySprintCount={velocitySprintCount}
                    onVelocityCountChange={setVelocitySprintCount}
                    onRefresh={handlePlanningRefresh}
                    capacityData={capacityData}
                    contributorVelocity={contributorVelocity}
                    capacityLoading={capacityLoading}
                  />
                )}

                {!planningLoading && !selectedSprint && availableSprints.length === 0 && !sprintsLoading && (
                  <div style={styles.loading}>
                    No upcoming sprints found for this board
                  </div>
                )}

                {!planningLoading && !selectedSprint && availableSprints.length > 0 && (
                  <div style={styles.loading}>
                    Select a sprint to view planning metrics
                  </div>
                )}
              </div>
            )}

            {/* Capacity Tab Content */}
            {activeTab === 'capacity' && (
              <div style={styles.tabContent}>
                <CapacityPlanning
                  credentials={credentials}
                  boardId={selectedBoard}
                />
              </div>
            )}
          </div>
        )}

        {!selectedBoard && !loading && (
          <div style={styles.loading}>
            Select a board to view sprint metrics
          </div>
        )}
      </main>
    </div>
  )
}

export default Dashboard
