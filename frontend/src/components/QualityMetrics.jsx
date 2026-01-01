import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'

function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function QualityMetrics({ data }) {
  if (!data || data.length === 0) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>No sprint data available</div>
  }

  // Reverse to show oldest first (left to right chronologically)
  const chartData = [...data].reverse().map((sprint) => {
    const startFormatted = formatDate(sprint.startDate)
    const endFormatted = formatDate(sprint.endDate)
    const dateRange = startFormatted && endFormatted
      ? `(${startFormatted} - ${endFormatted})`
      : ''

    const sprintLabel = sprint.sprintName.length > 15
      ? sprint.sprintName.substring(0, 15) + '...'
      : sprint.sprintName

    return {
      name: dateRange ? `${sprintLabel} ${dateRange}` : sprintLabel,
      fullName: sprint.sprintName,
      bugRatio: sprint.bugRatio,
      incompletePercentage: sprint.incompletePercentage,
      averageTicketAgeDays: sprint.averageTicketAgeDays,
      averageActiveCycleTimeDays: sprint.averageActiveCycleTimeDays || 0,
      bugCount: sprint.bugCount,
      completedBugs: sprint.completedBugs,
      totalIssues: sprint.totalIssues,
      completedIssues: sprint.completedIssues,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      dateRange
    }
  })

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={chartData} margin={{ top: 20, right: 60, left: 20, bottom: 80 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis
          dataKey="name"
          angle={-45}
          textAnchor="end"
          height={100}
          tick={{ fontSize: 10 }}
          interval={0}
        />
        <YAxis
          yAxisId="left"
          domain={[0, 100]}
          label={{ value: 'Percentage', angle: -90, position: 'insideLeft' }}
          tick={{ fontSize: 12 }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          label={{ value: 'Days', angle: 90, position: 'insideRight' }}
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
                  padding: '10px',
                  fontSize: '13px'
                }}>
                  <div style={{ fontWeight: '500', marginBottom: '6px' }}>
                    {data.fullName}
                  </div>
                  {(data.startDate || data.endDate) && (
                    <div style={{ color: '#666', marginBottom: '6px', fontSize: '12px' }}>
                      {formatDate(data.startDate)} - {formatDate(data.endDate)}
                    </div>
                  )}
                  <div style={{ color: '#DE350B', marginBottom: '2px' }}>
                    Bug Ratio: {data.bugRatio}% ({data.completedBugs} of {data.completedIssues} completed)
                  </div>
                  <div style={{ color: '#FF8B00', marginBottom: '2px' }}>
                    Incomplete: {data.incompletePercentage}% ({data.totalIssues - data.completedIssues} of {data.totalIssues})
                  </div>
                  <div style={{ color: '#00875A', marginBottom: '2px' }}>
                    Active Cycle Time: {data.averageActiveCycleTimeDays} days
                  </div>
                  <div style={{ color: '#6554C0', fontSize: '11px' }}>
                    (Total Ticket Age: {data.averageTicketAgeDays} days)
                  </div>
                </div>
              )
            }
            return null
          }}
        />
        <Legend verticalAlign="top" height={36} />
        <Bar yAxisId="left" dataKey="bugRatio" name="Bug Ratio %" fill="#DE350B" radius={[4, 4, 0, 0]} />
        <Bar yAxisId="left" dataKey="incompletePercentage" name="Incomplete %" fill="#FF8B00" radius={[4, 4, 0, 0]} />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="averageActiveCycleTimeDays"
          name="Active Cycle Time (days)"
          stroke="#00875A"
          strokeWidth={2}
          dot={{ fill: '#00875A', strokeWidth: 2 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export default QualityMetrics
