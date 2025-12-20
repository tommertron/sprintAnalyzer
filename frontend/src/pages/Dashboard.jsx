import { useState, useEffect, useCallback } from 'react'
import { getBoards, getMetricsSummary } from '../services/api'
import BoardSelector from '../components/BoardSelector'
import DateRangeSelector from '../components/DateRangeSelector'
import SpaceExclusionList from '../components/SpaceExclusionList'
import MetricCard from '../components/MetricCard'
import VelocityChart from '../components/VelocityChart'
import CompletionChart from '../components/CompletionChart'
import QualityMetrics from '../components/QualityMetrics'
import AlignmentChart from '../components/AlignmentChart'

const RECENT_BOARDS_KEY = 'sprintAnalyzer_recentBoards'
const METRICS_CACHE_KEY = 'sprintAnalyzer_metricsCache'
const EXCLUDED_SPACES_KEY = 'sprintAnalyzer_excludedSpaces'
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
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [recentBoards, setRecentBoards] = useState([])
  const [metricsCache, setMetricsCache] = useState({})
  const [lastFetched, setLastFetched] = useState(null)

  // Load recent boards, cache, and excluded spaces from localStorage on mount
  useEffect(() => {
    setRecentBoards(loadFromStorage(RECENT_BOARDS_KEY, []))
    setMetricsCache(loadFromStorage(METRICS_CACHE_KEY, {}))
    setExcludedSpaces(loadFromStorage(EXCLUDED_SPACES_KEY, []))
  }, [])

  // Load boards list
  useEffect(() => {
    loadBoards()
  }, [])

  // Load metrics when board, date range, or excluded spaces change
  useEffect(() => {
    if (selectedBoard) {
      loadMetrics(selectedBoard, false)
    } else {
      setMetrics(null)
      setLastFetched(null)
    }
  }, [selectedBoard, dateRange, excludedSpaces])

  const loadBoards = async () => {
    try {
      const boardList = await getBoards(credentials)
      setBoards(boardList)
    } catch (err) {
      setError('Failed to load boards')
    }
  }

  const loadMetrics = useCallback(async (boardId, forceRefresh = false) => {
    // Build cache key including date range or sprint count and excluded spaces
    let rangeKey = 'default'
    if (dateRange) {
      if (dateRange.sprintCount) {
        rangeKey = `sprints_${dateRange.sprintCount}`
      } else {
        rangeKey = `${dateRange.startDate}_${dateRange.endDate}`
      }
    }
    const excludeKey = excludedSpaces.length > 0 ? `_excl_${excludedSpaces.sort().join('-')}` : ''
    const cacheKey = `${boardId}_${rangeKey}${excludeKey}`

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

    try {
      const data = await getMetricsSummary(credentials, boardId, excludedSpaces, dateRange)
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
    }
  }, [credentials, metricsCache, dateRange, excludedSpaces])

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

  const handleExcludedSpacesChange = (newExcluded) => {
    setExcludedSpaces(newExcluded)
    saveToStorage(EXCLUDED_SPACES_KEY, newExcluded)
  }

  const handleRefresh = () => {
    if (selectedBoard && !loading) {
      loadMetrics(selectedBoard, true)
    }
  }

  const handleSelectRecent = (boardId) => {
    setSelectedBoard(boardId)
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

        {loading && <div style={styles.loading}>Loading metrics...</div>}

        {metrics && !loading && (
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
              <SpaceExclusionList
                discoveredSpaces={metrics.alignment?.discoveredSpaces || []}
                excludedSpaces={excludedSpaces}
                onChange={handleExcludedSpacesChange}
              />
              <AlignmentChart
                data={metrics.alignment?.sprints || []}
                discoveredSpaces={(metrics.alignment?.discoveredSpaces || []).map(space => ({
                  ...space,
                  isExcluded: excludedSpaces.includes(space.projectKey)
                }))}
                jiraServer={credentials.server}
              />
            </div>
          </>
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
