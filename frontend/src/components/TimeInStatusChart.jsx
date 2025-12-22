import { useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell
} from 'recharts'

function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Color palette for different statuses
const STATUS_COLORS = [
  '#0052CC', // Blue
  '#36B37E', // Green
  '#FF5630', // Red
  '#FFAB00', // Yellow
  '#6554C0', // Purple
  '#00B8D9', // Cyan
  '#FF8B00', // Orange
  '#00875A'  // Dark green
]

function TimeInStatusChart({ data, jiraServer }) {
  const [viewMode, setViewMode] = useState('average') // 'average' or 'median' or 'p90'
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const [selectedSprint, setSelectedSprint] = useState(null)
  const [expandedStatus, setExpandedStatus] = useState(null)

  if (!data || !data.sprints || data.sprints.length === 0) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>No time in status data available</div>
  }

  // Get all unique statuses across all sprints
  const allStatuses = new Set()
  data.sprints.forEach(sprint => {
    sprint.statusBreakdown?.forEach(status => {
      allStatuses.add(status.status)
    })
  })
  const statusList = Array.from(allStatuses)

  // Transform data for stacked bar chart
  const chartData = [...data.sprints].reverse().map(sprint => {
    const sprintLabel = sprint.sprintName.length > 15
      ? sprint.sprintName.substring(0, 15) + '...'
      : sprint.sprintName

    const dataPoint = {
      name: sprintLabel,
      fullName: sprint.sprintName,
      sprintId: sprint.sprintId,
      bottleneck: sprint.bottleneckStatus,
      totalCycleTime: sprint.totalCycleTimeHours
    }

    // Add each status as a key
    sprint.statusBreakdown?.forEach(status => {
      const timeKey = viewMode === 'average' ? 'avgTimeHours' :
                     viewMode === 'median' ? 'medianTimeHours' : 'p90TimeHours'
      dataPoint[status.status] = status[timeKey]

      // Store full status data for tooltip
      dataPoint[`${status.status}_full`] = status
    })

    return dataPoint
  })

  // Get the selected sprint data for diagnostics
  const selectedSprintData = selectedSprint
    ? data.sprints.find(s => s.sprintId === selectedSprint)
    : null

  // Build Jira issue URL
  const getJiraUrl = (issueKey) => {
    if (!jiraServer || !issueKey) return null
    const baseUrl = jiraServer.replace(/\/$/, '')
    return `${baseUrl}/browse/${issueKey}`
  }

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
          Time in Status (Workflow Bottlenecks)
          <span style={{
            display: 'inline-block',
            padding: '2px 6px',
            background: '#FFAB00',
            color: '#172B4D',
            fontSize: '10px',
            fontWeight: '600',
            borderRadius: '3px',
            marginLeft: '8px',
            verticalAlign: 'middle'
          }}>ALPHA</span>
        </h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            style={{
              padding: '6px 12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              background: showDiagnostics ? '#6554C0' : 'white',
              color: showDiagnostics ? 'white' : '#6554C0',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '500'
            }}
          >
            {showDiagnostics ? 'Hide' : 'Show'} Issue Details
          </button>
          <button
            onClick={() => setViewMode('average')}
            style={{
              padding: '6px 12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              background: viewMode === 'average' ? '#0052CC' : 'white',
              color: viewMode === 'average' ? 'white' : '#333',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Average
          </button>
          <button
            onClick={() => setViewMode('median')}
            style={{
              padding: '6px 12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              background: viewMode === 'median' ? '#0052CC' : 'white',
              color: viewMode === 'median' ? 'white' : '#333',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Median
          </button>
          <button
            onClick={() => setViewMode('p90')}
            style={{
              padding: '6px 12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              background: viewMode === 'p90' ? '#0052CC' : 'white',
              color: viewMode === 'p90' ? 'white' : '#333',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            P90
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={380}>
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis
            dataKey="name"
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fontSize: 10 }}
            interval={0}
          />
          <YAxis
            label={{ value: 'Time (hours)', angle: -90, position: 'insideLeft' }}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload
                return (
                  <div style={{
                    background: 'white',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    padding: '12px',
                    maxWidth: '280px'
                  }}>
                    <div style={{ fontWeight: '600', marginBottom: '8px', fontSize: '13px' }}>
                      {data.fullName}
                    </div>
                    {data.bottleneck && (
                      <div style={{
                        color: '#FF5630',
                        marginBottom: '8px',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}>
                        🔴 Bottleneck: {data.bottleneck}
                      </div>
                    )}
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>
                      Total Cycle Time: {data.totalCycleTime?.toFixed(1)} hrs
                    </div>
                    <div style={{ borderTop: '1px solid #eee', paddingTop: '6px' }}>
                      {payload.map((entry, index) => {
                        const statusData = data[`${entry.name}_full`]
                        if (!statusData) return null

                        const isBottleneck = entry.name === data.bottleneck
                        const isTerminal = statusData.isTerminal
                        return (
                          <div
                            key={index}
                            style={{
                              marginBottom: '4px',
                              fontSize: '12px',
                              fontWeight: isBottleneck ? '600' : 'normal',
                              opacity: isTerminal ? 0.7 : 1
                            }}
                          >
                            <div style={{ color: entry.color, marginBottom: '2px' }}>
                              {entry.name}: {entry.value?.toFixed(1)} hrs
                              {isBottleneck && ' ⚠️'}
                              {isTerminal && ' ✓'}
                            </div>
                            <div style={{ color: '#999', fontSize: '11px', marginLeft: '8px' }}>
                              Issues: {statusData.issueCount} |
                              Avg: {statusData.avgTimeHours?.toFixed(1)}h |
                              P90: {statusData.p90TimeHours?.toFixed(1)}h
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              }
              return null
            }}
          />
          <Legend
            verticalAlign="top"
            height={36}
            wrapperStyle={{ fontSize: '12px' }}
          />
          {statusList.map((status, index) => (
            <Bar
              key={status}
              dataKey={status}
              stackId="a"
              fill={STATUS_COLORS[index % STATUS_COLORS.length]}
              radius={index === statusList.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* Diagnostics Panel */}
      {showDiagnostics && (
        <div style={{
          marginTop: '16px',
          border: '1px solid #6554C0',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '12px 16px',
            background: '#F4F5F7',
            borderBottom: '1px solid #ddd',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ fontWeight: '600', fontSize: '14px', color: '#6554C0' }}>
              🔍 Issue Diagnostics
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '12px', color: '#666' }}>Sprint:</label>
              <select
                value={selectedSprint || ''}
                onChange={(e) => {
                  setSelectedSprint(e.target.value ? parseInt(e.target.value) : null)
                  setExpandedStatus(null)
                }}
                style={{
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  fontSize: '12px',
                  minWidth: '200px'
                }}
              >
                <option value="">Select a sprint...</option>
                {data.sprints.map(sprint => (
                  <option key={sprint.sprintId} value={sprint.sprintId}>
                    {sprint.sprintName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedSprintData ? (
            <div style={{ padding: '16px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
                marginBottom: '16px'
              }}>
                <div style={{
                  padding: '12px',
                  background: '#FAFBFC',
                  borderRadius: '6px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase' }}>Total Cycle Time</div>
                  <div style={{ fontSize: '20px', fontWeight: '600', color: '#0052CC' }}>
                    {selectedSprintData.totalCycleTimeHours?.toFixed(1)} hrs
                  </div>
                </div>
                <div style={{
                  padding: '12px',
                  background: '#FAFBFC',
                  borderRadius: '6px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase' }}>Bottleneck</div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#FF5630' }}>
                    {selectedSprintData.bottleneckStatus || 'None'}
                  </div>
                </div>
                <div style={{
                  padding: '12px',
                  background: '#FAFBFC',
                  borderRadius: '6px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase' }}>Statuses Tracked</div>
                  <div style={{ fontSize: '20px', fontWeight: '600', color: '#6554C0' }}>
                    {selectedSprintData.statusBreakdown?.length || 0}
                  </div>
                </div>
              </div>

              {/* Status breakdown with expandable issues */}
              <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#333' }}>
                Issues by Status (click to expand)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedSprintData.statusBreakdown?.map((statusData, idx) => {
                  const isExpanded = expandedStatus === statusData.status
                  const isBottleneck = statusData.status === selectedSprintData.bottleneckStatus
                  const color = STATUS_COLORS[idx % STATUS_COLORS.length]

                  return (
                    <div
                      key={statusData.status}
                      style={{
                        border: `1px solid ${isBottleneck ? '#FF5630' : '#ddd'}`,
                        borderRadius: '6px',
                        overflow: 'hidden',
                        background: isBottleneck ? '#FFF5F3' : 'white'
                      }}
                    >
                      <div
                        onClick={() => setExpandedStatus(isExpanded ? null : statusData.status)}
                        style={{
                          padding: '10px 12px',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: isExpanded ? '#F4F5F7' : 'transparent'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '3px',
                            background: color
                          }} />
                          <span style={{ fontWeight: '500', color: '#333' }}>
                            {statusData.status}
                            {isBottleneck && <span style={{ color: '#FF5630', marginLeft: '6px' }}>⚠️ Bottleneck</span>}
                            {statusData.isTerminal && <span style={{ color: '#36B37E', marginLeft: '6px' }}>✓ Terminal</span>}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: '#666' }}>
                          <span><strong>{statusData.issueCount}</strong> issues</span>
                          <span>Avg: <strong>{statusData.avgTimeHours?.toFixed(1)}h</strong></span>
                          <span>P90: <strong>{statusData.p90TimeHours?.toFixed(1)}h</strong></span>
                          <span style={{ color: '#999' }}>{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </div>

                      {isExpanded && statusData.issues && statusData.issues.length > 0 && (
                        <div style={{ borderTop: '1px solid #eee', maxHeight: '300px', overflowY: 'auto' }}>
                          <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                            <thead style={{ background: '#FAFBFC', position: 'sticky', top: 0 }}>
                              <tr>
                                <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #eee', fontWeight: '600' }}>
                                  Issue Key
                                </th>
                                <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #eee', fontWeight: '600' }}>
                                  Summary
                                </th>
                                <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #eee', fontWeight: '600' }}>
                                  Type
                                </th>
                                <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #eee', fontWeight: '600' }}>
                                  Current Status
                                </th>
                                <th style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid #eee', fontWeight: '600' }}>
                                  Time in Status
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {statusData.issues.map((issue, issueIdx) => {
                                const jiraUrl = getJiraUrl(issue.key)
                                return (
                                  <tr
                                    key={issue.key}
                                    style={{
                                      background: issueIdx % 2 === 0 ? 'white' : '#FAFBFC',
                                      borderBottom: '1px solid #eee'
                                    }}
                                  >
                                    <td style={{ padding: '8px 12px' }}>
                                      {jiraUrl ? (
                                        <a
                                          href={jiraUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          style={{
                                            fontFamily: 'monospace',
                                            color: '#0052CC',
                                            textDecoration: 'none',
                                            fontWeight: '500'
                                          }}
                                        >
                                          {issue.key} ↗
                                        </a>
                                      ) : (
                                        <span style={{ fontFamily: 'monospace', color: '#0052CC' }}>
                                          {issue.key}
                                        </span>
                                      )}
                                    </td>
                                    <td style={{ padding: '8px 12px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {issue.summary}
                                    </td>
                                    <td style={{ padding: '8px 12px', color: '#666' }}>
                                      {issue.issueType}
                                    </td>
                                    <td style={{ padding: '8px 12px' }}>
                                      <span style={{
                                        padding: '2px 8px',
                                        borderRadius: '3px',
                                        background: issue.currentStatus === statusData.status ? '#E3FCEF' : '#F4F5F7',
                                        color: issue.currentStatus === statusData.status ? '#006644' : '#666',
                                        fontSize: '11px'
                                      }}>
                                        {issue.currentStatus}
                                      </span>
                                    </td>
                                    <td style={{
                                      padding: '8px 12px',
                                      textAlign: 'right',
                                      fontWeight: '600',
                                      color: issue.timeHours > statusData.p90TimeHours ? '#FF5630' : '#333'
                                    }}>
                                      {issue.timeHours?.toFixed(1)} hrs
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {isExpanded && (!statusData.issues || statusData.issues.length === 0) && (
                        <div style={{ padding: '16px', textAlign: 'center', color: '#666', fontSize: '12px', borderTop: '1px solid #eee' }}>
                          No issue details available for this status
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: '#666', fontSize: '13px' }}>
              Select a sprint above to view issue-level diagnostics
            </div>
          )}
        </div>
      )}

      <div style={{
        marginTop: '12px',
        padding: '12px',
        background: '#FFF7E6',
        border: '1px solid #FFAB00',
        borderRadius: '4px',
        fontSize: '12px',
        color: '#666'
      }}>
        <strong style={{ color: '#FF8B00' }}>Alpha Feature:</strong> This chart shows where issues spend time in your workflow.
        Data accuracy is still being validated. The bottleneck (marked with warning) is the non-terminal status where work accumulates most.
        Terminal statuses (marked with check) like Done are excluded from bottleneck analysis.
        {showDiagnostics && ' Use the Issue Details panel to inspect individual issues and verify data accuracy.'}
      </div>
    </div>
  )
}

export default TimeInStatusChart
