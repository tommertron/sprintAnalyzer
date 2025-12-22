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

function TimeInStatusChart({ data }) {
  const [viewMode, setViewMode] = useState('average') // 'average' or 'median' or 'p90'

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
        </h3>
        <div style={{ display: 'flex', gap: '8px' }}>
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
                        return (
                          <div
                            key={index}
                            style={{
                              marginBottom: '4px',
                              fontSize: '12px',
                              fontWeight: isBottleneck ? '600' : 'normal'
                            }}
                          >
                            <div style={{ color: entry.color, marginBottom: '2px' }}>
                              {entry.name}: {entry.value?.toFixed(1)} hrs
                              {isBottleneck && ' ⚠️'}
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

      <div style={{
        marginTop: '12px',
        padding: '12px',
        background: '#F4F5F7',
        borderRadius: '4px',
        fontSize: '12px',
        color: '#666'
      }}>
        <strong>💡 Tip:</strong> This chart shows where issues spend time in your workflow.
        The bottleneck status (marked with ⚠️) is where work accumulates the most time.
        Focus process improvements on reducing bottleneck time.
      </div>
    </div>
  )
}

export default TimeInStatusChart
