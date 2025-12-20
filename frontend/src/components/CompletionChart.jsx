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

function CompletionChart({ data }) {
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
      committed: sprint.committed,
      completed: sprint.completed,
      completionRate: sprint.completionRate,
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
          label={{ value: 'Issues', angle: -90, position: 'insideLeft' }}
          tick={{ fontSize: 12 }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          domain={[0, 100]}
          label={{ value: 'Completion %', angle: 90, position: 'insideRight' }}
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
                  <div style={{ color: '#36B37E', marginBottom: '2px' }}>
                    Completed: {data.completed} issues
                  </div>
                  <div style={{ color: '#0052CC', marginBottom: '2px' }}>
                    Committed: {data.committed} issues
                  </div>
                  <div style={{ color: '#FF5630', fontWeight: '500' }}>
                    Rate: {data.completionRate}%
                  </div>
                </div>
              )
            }
            return null
          }}
        />
        <Legend verticalAlign="top" height={36} />
        <Bar yAxisId="left" dataKey="committed" name="Committed" fill="#0052CC" radius={[4, 4, 0, 0]} />
        <Bar yAxisId="left" dataKey="completed" name="Completed" fill="#36B37E" radius={[4, 4, 0, 0]} />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="completionRate"
          name="Completion Rate"
          stroke="#FF5630"
          strokeWidth={2}
          dot={{ fill: '#FF5630', strokeWidth: 2 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export default CompletionChart
