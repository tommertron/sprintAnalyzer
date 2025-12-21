import MetricCard from './MetricCard'

// Helper to count working days between two dates (excludes weekends)
// Note: endDate is exclusive (sprint ends at start of that day, so last working day is day before)
function countWorkingDays(startDate, endDate) {
  if (!startDate || !endDate) return 10

  const start = new Date(startDate)
  const end = new Date(endDate)
  let count = 0
  const current = new Date(start)

  // End date is exclusive (sprint ends at start of end date)
  while (current < end) {
    const day = current.getDay()
    if (day !== 0 && day !== 6) count++
    current.setDate(current.getDate() + 1)
  }

  return count || 10
}

// Consolidate PTO entries by person (sum total days)
function consolidatePTO(timeOff, sprintStart, sprintEnd, workingDays) {
  if (!timeOff || timeOff.length === 0) return []

  const byPerson = {}
  const sprintStartDate = new Date(sprintStart)
  const sprintEndDate = new Date(sprintEnd)

  for (const pto of timeOff) {
    const name = pto.employeeName || 'Unknown'
    const ptoStart = new Date(pto.startDate)
    // PTO end date is inclusive (last day of PTO), so add 1 day for comparison
    const ptoEndInclusive = new Date(pto.endDate)
    ptoEndInclusive.setDate(ptoEndInclusive.getDate() + 1)

    // Calculate overlap with sprint (sprint end is exclusive)
    const overlapStart = new Date(Math.max(ptoStart, sprintStartDate))
    const overlapEnd = new Date(Math.min(ptoEndInclusive, sprintEndDate))

    if (overlapStart < overlapEnd) {
      // Count working days in overlap
      let daysOff = 0
      const current = new Date(overlapStart)
      while (current < overlapEnd) {
        const day = current.getDay()
        if (day !== 0 && day !== 6) daysOff++
        current.setDate(current.getDate() + 1)
      }

      if (!byPerson[name]) {
        byPerson[name] = { name, totalDays: 0 }
      }
      byPerson[name].totalDays += daysOff
    }
  }

  return Object.values(byPerson).sort((a, b) => b.totalDays - a.totalDays)
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sprintInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  sprintName: {
    fontSize: '20px',
    fontWeight: '600'
  },
  sprintDates: {
    fontSize: '14px',
    color: '#666'
  },
  sprintGoal: {
    fontSize: '14px',
    color: '#666',
    fontStyle: 'italic',
    marginTop: '4px'
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  velocityControl: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px'
  },
  select: {
    padding: '6px 10px',
    borderRadius: '4px',
    border: '1px solid #ddd',
    fontSize: '14px',
    cursor: 'pointer'
  },
  refreshButton: {
    padding: '8px 16px',
    background: '#0052CC',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  refreshButtonDisabled: {
    background: '#ccc',
    cursor: 'not-allowed'
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '16px'
  },
  velocityCard: {
    background: 'white',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  velocityTitle: {
    fontSize: '12px',
    fontWeight: '500',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '8px'
  },
  velocityValue: {
    fontSize: '32px',
    fontWeight: '600'
  },
  velocityComparison: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '8px',
    fontSize: '14px'
  },
  statusBadge: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500'
  },
  statusOver: {
    background: '#FFEBE6',
    color: '#DE350B'
  },
  statusUnder: {
    background: '#DEEBFF',
    color: '#0747A6'
  },
  statusOnTarget: {
    background: '#E3FCEF',
    color: '#006644'
  },
  section: {
    background: 'white',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '16px'
  },
  issueList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  issueItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 12px',
    background: '#f5f5f5',
    borderRadius: '4px'
  },
  issueKey: {
    fontWeight: '500',
    color: '#0052CC',
    fontSize: '13px',
    minWidth: '80px'
  },
  issueSummary: {
    fontSize: '13px',
    color: '#333',
    flex: 1
  },
  issueType: {
    fontSize: '11px',
    color: '#666',
    background: '#e0e0e0',
    padding: '2px 6px',
    borderRadius: '3px'
  },
  emptyState: {
    color: '#666',
    fontSize: '14px',
    fontStyle: 'italic'
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '40px',
    color: '#666'
  },
  capacitySection: {
    background: 'linear-gradient(135deg, #0052CC 0%, #0747A6 100%)',
    borderRadius: '12px',
    padding: '24px',
    color: 'white'
  },
  capacityHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px'
  },
  capacityTitle: {
    fontSize: '12px',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    opacity: 0.9
  },
  capacityValue: {
    fontSize: '48px',
    fontWeight: '700',
    lineHeight: 1
  },
  capacitySubtext: {
    fontSize: '14px',
    opacity: 0.8,
    marginTop: '4px'
  },
  capacityBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    background: 'rgba(255,255,255,0.15)',
    borderRadius: '8px',
    fontSize: '14px'
  },
  impactSection: {
    background: '#FFFAE6',
    border: '1px solid #FFAB00',
    borderRadius: '8px',
    padding: '16px'
  },
  impactTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#172B4D',
    marginBottom: '12px'
  },
  impactRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid rgba(0,0,0,0.05)',
    fontSize: '13px'
  },
  impactName: {
    fontWeight: '500',
    color: '#172B4D'
  },
  impactDays: {
    color: '#666'
  },
  impactPoints: {
    color: '#DE350B',
    fontWeight: '600'
  },
  holidaySection: {
    background: '#F4F5F7',
    borderRadius: '8px',
    padding: '16px',
    marginTop: '16px'
  },
  holidayTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#172B4D',
    marginBottom: '8px'
  },
  holidayItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 0',
    fontSize: '13px',
    color: '#666'
  },
  setupPrompt: {
    background: '#E6F3FF',
    border: '1px solid #0052CC',
    borderRadius: '8px',
    padding: '16px',
    color: '#0052CC',
    fontSize: '13px'
  }
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function PlanningMetrics({
  metrics,
  loading = false,
  velocitySprintCount = 6,
  onVelocityCountChange,
  onRefresh,
  capacityData,
  contributorVelocity,
  capacityLoading,
  isWhitelisted
}) {
  if (loading) {
    return <div style={styles.loading}>Loading planning metrics...</div>
  }

  if (!metrics) {
    return <div style={styles.loading}>Select a sprint to view planning metrics</div>
  }

  // Calculate working days for this sprint
  const sprintWorkingDays = countWorkingDays(metrics.sprint?.startDate, metrics.sprint?.endDate)

  // Calculate velocity impact from capacity data
  const calculateVelocityImpact = () => {
    if (!capacityData || !contributorVelocity) return null

    const teamPointsPerDay = contributorVelocity.teamPointsPerDay || 0
    const contributors = contributorVelocity.contributors || []

    // Consolidate PTO by person
    const consolidatedPTO = consolidatePTO(
      capacityData.timeOff,
      capacityData.sprintStart,
      capacityData.sprintEnd,
      sprintWorkingDays
    )

    // Calculate impact for each person
    const impactDetails = []
    let totalPointsLost = 0

    for (const pto of consolidatedPTO) {
      // Find contributor by name match
      const contributor = contributors.find(c =>
        c.displayName?.toLowerCase() === pto.name?.toLowerCase()
      )

      const pointsPerDay = contributor?.pointsPerDay || teamPointsPerDay / (capacityData.teamSize || 5)
      const pointsLost = pointsPerDay * pto.totalDays

      impactDetails.push({
        name: pto.name,
        daysOff: pto.totalDays,
        pointsPerDay: Math.round(pointsPerDay * 100) / 100,
        pointsLost: Math.round(pointsLost * 10) / 10
      })

      totalPointsLost += pointsLost
    }

    // Calculate holiday impact
    const holidayDays = capacityData.holidays?.length || 0
    const holidayImpact = holidayDays * teamPointsPerDay

    // Expected velocity based on sprint length (points per day * working days)
    const expectedVelocity = teamPointsPerDay * sprintWorkingDays
    const projectedVelocity = Math.max(0, expectedVelocity - totalPointsLost - holidayImpact)

    return {
      expectedVelocity: Math.round(expectedVelocity * 10) / 10,
      projectedVelocity: Math.round(projectedVelocity * 10) / 10,
      totalPointsLost: Math.round(totalPointsLost * 10) / 10,
      holidayImpact: Math.round(holidayImpact * 10) / 10,
      impactDetails,
      teamPointsPerDay: Math.round(teamPointsPerDay * 100) / 100,
      sprintWorkingDays
    }
  }

  const velocityImpact = calculateVelocityImpact()

  // Get status comparing total points to projected velocity (adjusted for sprint length)
  const getAdjustedStatus = () => {
    if (!velocityImpact) return metrics.velocityStatus
    const delta = metrics.totalPoints - velocityImpact.projectedVelocity
    const threshold = velocityImpact.projectedVelocity * 0.1 // 10% threshold
    if (delta > threshold) return 'over'
    if (delta < -threshold) return 'under'
    return 'on_target'
  }

  const getAdjustedStatusLabel = () => {
    if (!velocityImpact) return getStatusLabel(metrics.velocityStatus, metrics.velocityDelta)
    const delta = Math.round(metrics.totalPoints - velocityImpact.projectedVelocity)
    const status = getAdjustedStatus()
    if (status === 'over') return `${Math.abs(delta)} pts over`
    if (status === 'under') return `${Math.abs(delta)} pts under`
    return 'On target'
  }

  const getStatusStyle = (status) => {
    switch (status) {
      case 'over': return { ...styles.statusBadge, ...styles.statusOver }
      case 'under': return { ...styles.statusBadge, ...styles.statusUnder }
      default: return { ...styles.statusBadge, ...styles.statusOnTarget }
    }
  }

  const getStatusLabel = (status, delta) => {
    const absDelta = Math.abs(delta)
    switch (status) {
      case 'over': return `${absDelta} pts over`
      case 'under': return `${absDelta} pts under`
      default: return 'On target'
    }
  }

  const getVelocityColor = (status) => {
    switch (status) {
      case 'over': return '#DE350B'
      case 'under': return '#0747A6'
      default: return '#006644'
    }
  }

  return (
    <div style={styles.container}>
      {/* Header with sprint info and controls */}
      <div style={styles.header}>
        <div style={styles.sprintInfo}>
          <div style={styles.sprintName}>{metrics.sprint.name}</div>
          <div style={styles.sprintDates}>
            {formatDate(metrics.sprint.startDate)} - {formatDate(metrics.sprint.endDate)}
          </div>
          {metrics.sprint.goal && (
            <div style={styles.sprintGoal}>Goal: {metrics.sprint.goal}</div>
          )}
        </div>
        <div style={styles.controls}>
          <div style={styles.velocityControl}>
            <label>Compare to last</label>
            <select
              style={styles.select}
              value={velocitySprintCount}
              onChange={(e) => onVelocityCountChange(parseInt(e.target.value))}
            >
              <option value={3}>3 sprints</option>
              <option value={6}>6 sprints</option>
              <option value={10}>10 sprints</option>
              <option value={12}>12 sprints</option>
            </select>
          </div>
          <button
            style={{
              ...styles.refreshButton,
              ...(loading ? styles.refreshButtonDisabled : {})
            }}
            onClick={onRefresh}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Main metrics grid */}
      <div style={styles.metricsGrid}>
        {/* Velocity comparison card - use points/day expected if available */}
        <div style={styles.velocityCard}>
          <div style={styles.velocityTitle}>Total Points</div>
          <div style={{ ...styles.velocityValue, color: getVelocityColor(velocityImpact ? getAdjustedStatus() : metrics.velocityStatus) }}>
            {metrics.totalPoints}
          </div>
          <div style={styles.velocityComparison}>
            {velocityImpact ? (
              <>
                <span>vs {velocityImpact.projectedVelocity} projected</span>
                <span style={getStatusStyle(getAdjustedStatus())}>
                  {getAdjustedStatusLabel()}
                </span>
              </>
            ) : (
              <>
                <span>vs {metrics.historicalVelocity} avg</span>
                <span style={getStatusStyle(metrics.velocityStatus)}>
                  {getStatusLabel(metrics.velocityStatus, metrics.velocityDelta)}
                </span>
              </>
            )}
          </div>
        </div>

        <MetricCard
          title="Avg Points/Story"
          value={metrics.averagePointsPerStory}
          unit="pts"
        />
        <MetricCard
          title="Stories"
          value={metrics.totalStories}
          unit="total"
        />
        <MetricCard
          title="Initiative Aligned"
          value={metrics.initiativeLinkedPercent}
          unit="%"
        />
        <MetricCard
          title="Bugs"
          value={metrics.bugCount}
          unit={`(${metrics.bugRatio}%)`}
        />
        <MetricCard
          title="Missing Points"
          value={metrics.storiesMissingPoints}
          unit="stories"
        />
      </div>

      {/* Capacity Impact Section */}
      {isWhitelisted && (
        <>
          {capacityLoading && (
            <div style={styles.loading}>Loading capacity data...</div>
          )}

          {!capacityLoading && velocityImpact && (
            <>
              {/* Projected Velocity Card */}
              <div style={styles.capacitySection}>
                <div style={styles.capacityHeader}>
                  <div>
                    <div style={styles.capacityTitle}>Projected Sprint Velocity</div>
                    <div style={styles.capacityValue}>{velocityImpact.projectedVelocity}</div>
                    <div style={styles.capacitySubtext}>
                      story points ({sprintWorkingDays} working days)
                    </div>
                  </div>
                  <div style={styles.capacityBadge}>
                    {velocityImpact.totalPointsLost + velocityImpact.holidayImpact > 0 ? (
                      <>
                        <span style={{ fontSize: '18px' }}>↓</span>
                        <div>
                          <div style={{ fontWeight: '600' }}>
                            -{(velocityImpact.totalPointsLost + velocityImpact.holidayImpact).toFixed(1)} pts
                          </div>
                          <div style={{ fontSize: '11px', opacity: 0.8 }}>
                            from {velocityImpact.expectedVelocity} expected
                          </div>
                        </div>
                      </>
                    ) : (
                      <span>Full capacity</span>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: '12px', opacity: 0.8 }}>
                  Based on {velocityImpact.teamPointsPerDay} pts/day team average
                </div>
              </div>

              {/* Team Members Away */}
              {velocityImpact.impactDetails.length > 0 && (
                <div style={styles.impactSection}>
                  <div style={styles.impactTitle}>Team Members Away This Sprint</div>
                  {velocityImpact.impactDetails.map((impact, idx) => (
                    <div key={idx} style={styles.impactRow}>
                      <div>
                        <span style={styles.impactName}>{impact.name}</span>
                        <span style={styles.impactDays}> - {impact.daysOff} day{impact.daysOff !== 1 ? 's' : ''} away</span>
                      </div>
                      <span style={styles.impactPoints}>-{impact.pointsLost} pts</span>
                    </div>
                  ))}
                  {velocityImpact.holidayImpact > 0 && (
                    <div style={styles.impactRow}>
                      <div>
                        <span style={styles.impactName}>Company Holidays</span>
                        <span style={styles.impactDays}> - {capacityData?.holidays?.length} day{capacityData?.holidays?.length !== 1 ? 's' : ''}</span>
                      </div>
                      <span style={styles.impactPoints}>-{velocityImpact.holidayImpact} pts</span>
                    </div>
                  )}
                </div>
              )}

              {/* Holidays */}
              {capacityData?.holidays?.length > 0 && (
                <div style={styles.holidaySection}>
                  <div style={styles.holidayTitle}>Company Holidays</div>
                  {capacityData.holidays.map((holiday, idx) => (
                    <div key={idx} style={styles.holidayItem}>
                      <span>{holiday.name}</span>
                      <span>{holiday.date}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {!capacityLoading && !velocityImpact && (
            <div style={styles.setupPrompt}>
              <strong>Capacity planning not configured.</strong> Go to the Capacity tab to select team members and connect BambooHR to see velocity impact from time off.
            </div>
          )}
        </>
      )}

      {/* Stories missing points section */}
      {metrics.storiesMissingPointsList && metrics.storiesMissingPointsList.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            Stories Missing Point Estimates ({metrics.storiesMissingPointsList.length})
          </div>
          <div style={styles.issueList}>
            {metrics.storiesMissingPointsList.map((issue) => (
              <div key={issue.key} style={styles.issueItem}>
                <span style={styles.issueKey}>{issue.key}</span>
                <span style={styles.issueSummary}>{issue.summary}</span>
                <span style={styles.issueType}>{issue.issueType}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {metrics.storiesMissingPoints === 0 && (
        <div style={styles.section}>
          <div style={styles.emptyState}>
            All stories have point estimates
          </div>
        </div>
      )}
    </div>
  )
}

export default PlanningMetrics
