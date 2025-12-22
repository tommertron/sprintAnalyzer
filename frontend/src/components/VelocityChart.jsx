import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'

function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function VelocityChart({ data, standardSprintDays }) {
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

    // Use normalized points if available, fall back to raw points
    const displayPoints = sprint.normalizedPoints ?? sprint.completedPoints

    return {
      name: dateRange ? `${sprintLabel} ${dateRange}` : sprintLabel,
      points: displayPoints,
      rawPoints: sprint.completedPoints,
      normalizedPoints: sprint.normalizedPoints,
      workingDays: sprint.workingDays,
      fullName: sprint.sprintName,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      dateRange
    }
  })

  // Calculate average for reference line (using displayed points)
  const avgVelocity = chartData.reduce((sum, d) => sum + d.points, 0) / chartData.length

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
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
          label={{ value: 'Story Points', angle: -90, position: 'insideLeft' }}
          tick={{ fontSize: 12 }}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const data = payload[0].payload
              const hasNormalization = data.normalizedPoints !== undefined && data.normalizedPoints !== data.rawPoints
              return (
                <div style={{
                  background: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  padding: '10px'
                }}>
                  <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                    {data.fullName}
                  </div>
                  {(data.startDate || data.endDate) && (
                    <div style={{ color: '#666', marginBottom: '4px', fontSize: '12px' }}>
                      {formatDate(data.startDate)} - {formatDate(data.endDate)}
                      {data.workingDays && ` (${data.workingDays} working days)`}
                    </div>
                  )}
                  <div style={{ color: '#0052CC' }}>
                    {payload[0].value.toFixed(1)} story points
                    {hasNormalization && ' (normalized)'}
                  </div>
                  {hasNormalization && (
                    <div style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>
                      Raw: {data.rawPoints} pts
                    </div>
                  )}
                </div>
              )
            }
            return null
          }}
        />
        <ReferenceLine
          y={avgVelocity}
          stroke="#FF5630"
          strokeDasharray="5 5"
          label={{
            value: `Avg: ${avgVelocity.toFixed(1)}`,
            position: 'right',
            fill: '#FF5630',
            fontSize: 12
          }}
        />
        <Bar dataKey="points" fill="#0052CC" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export default VelocityChart
