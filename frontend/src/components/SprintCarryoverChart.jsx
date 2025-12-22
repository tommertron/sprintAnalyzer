import { useState } from 'react'
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

function SprintCarryoverChart({ data }) {
  const [showRepeatOffenders, setShowRepeatOffenders] = useState(true)

  if (!data || !data.sprints || data.sprints.length === 0) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>No sprint carryover data available</div>
  }

  // Reverse to show oldest first (left to right chronologically)
  const chartData = [...data.sprints].reverse().map(sprint => {
    const sprintLabel = sprint.sprintName.length > 15
      ? sprint.sprintName.substring(0, 15) + '...'
      : sprint.sprintName

    return {
      name: sprintLabel,
      fullName: sprint.sprintName,
      sprintId: sprint.sprintId,
      carryover: sprint.carryoverCount,
      newIssues: sprint.newIssuesCount,
      carryoverPct: sprint.carryoverPercentage,
      carryoverCompletionRate: sprint.carryoverCompletionRate,
      newCompletionRate: sprint.newIssuesCompletionRate,
      repeatOffenders: sprint.repeatOffenders || []
    }
  })

  // Collect all repeat offenders across sprints (dedupe by key)
  const allRepeatOffenders = new Map()
  data.sprints.forEach(sprint => {
    sprint.repeatOffenders?.forEach(offender => {
      if (!allRepeatOffenders.has(offender.key) ||
          allRepeatOffenders.get(offender.key).sprintCount < offender.sprintCount) {
        allRepeatOffenders.set(offender.key, offender)
      }
    })
  })

  const repeatOffendersList = Array.from(allRepeatOffenders.values())
    .sort((a, b) => b.sprintCount - a.sprintCount)

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
          Sprint Carryover & Spillover
        </h3>
        {repeatOffendersList.length > 0 && (
          <button
            onClick={() => setShowRepeatOffenders(!showRepeatOffenders)}
            style={{
              padding: '6px 12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              background: 'white',
              cursor: 'pointer',
              fontSize: '12px',
              color: '#0052CC'
            }}
          >
            {showRepeatOffenders ? 'Hide' : 'Show'} Repeat Offenders
          </button>
        )}
      </div>

      <ResponsiveContainer width="100%" height={360}>
        <ComposedChart data={chartData} margin={{ top: 20, right: 60, left: 20, bottom: 60 }}>
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
            yAxisId="left"
            label={{ value: 'Issue Count', angle: -90, position: 'insideLeft' }}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 100]}
            label={{ value: 'Carryover %', angle: 90, position: 'insideRight' }}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload
                const totalIssues = data.carryover + data.newIssues
                return (
                  <div style={{
                    background: 'white',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    padding: '12px',
                    fontSize: '13px',
                    minWidth: '220px'
                  }}>
                    <div style={{ fontWeight: '600', marginBottom: '8px' }}>
                      {data.fullName}
                    </div>
                    <div style={{ marginBottom: '6px', paddingBottom: '6px', borderBottom: '1px solid #eee' }}>
                      <div style={{ color: '#0052CC', marginBottom: '2px' }}>
                        New Issues: {data.newIssues}
                      </div>
                      <div style={{ color: '#FF5630', marginBottom: '2px' }}>
                        Carryover: {data.carryover}
                      </div>
                      <div style={{ color: '#666', fontSize: '12px' }}>
                        Total: {totalIssues} issues
                      </div>
                    </div>
                    <div style={{ marginBottom: '6px', paddingBottom: '6px', borderBottom: '1px solid #eee' }}>
                      <div style={{ fontWeight: '600', marginBottom: '4px', fontSize: '12px' }}>
                        Carryover Rate: {data.carryoverPct?.toFixed(1)}%
                      </div>
                    </div>
                    <div style={{ fontSize: '12px' }}>
                      <div style={{ fontWeight: '500', marginBottom: '3px' }}>Completion Rates:</div>
                      <div style={{ color: '#0052CC' }}>
                        New: {data.newCompletionRate?.toFixed(0)}%
                      </div>
                      <div style={{ color: '#FF5630' }}>
                        Carryover: {data.carryoverCompletionRate?.toFixed(0)}%
                      </div>
                    </div>
                    {data.repeatOffenders.length > 0 && (
                      <div style={{
                        marginTop: '6px',
                        paddingTop: '6px',
                        borderTop: '1px solid #eee',
                        fontSize: '11px',
                        color: '#666'
                      }}>
                        ⚠️ {data.repeatOffenders.length} repeat offender(s)
                      </div>
                    )}
                  </div>
                )
              }
              return null
            }}
          />
          <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
          <Bar
            yAxisId="left"
            dataKey="newIssues"
            name="New Issues"
            fill="#0052CC"
            stackId="issues"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            yAxisId="left"
            dataKey="carryover"
            name="Carryover Issues"
            fill="#FF5630"
            stackId="issues"
            radius={[4, 4, 0, 0]}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="carryoverPct"
            name="Carryover %"
            stroke="#FFAB00"
            strokeWidth={2}
            dot={{ fill: '#FFAB00', strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {showRepeatOffenders && repeatOffendersList.length > 0 && (
        <div style={{
          marginTop: '16px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '12px',
            background: '#F4F5F7',
            fontWeight: '600',
            fontSize: '13px',
            borderBottom: '1px solid #ddd'
          }}>
            🔴 Repeat Offenders (3+ sprints)
          </div>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#FAFBFC', position: 'sticky', top: 0 }}>
                <tr>
                  <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                    Issue Key
                  </th>
                  <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                    Summary
                  </th>
                  <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>
                    Sprint Count
                  </th>
                </tr>
              </thead>
              <tbody>
                {repeatOffendersList.map((offender, index) => (
                  <tr
                    key={offender.key}
                    style={{
                      background: index % 2 === 0 ? 'white' : '#FAFBFC',
                      borderBottom: '1px solid #eee'
                    }}
                  >
                    <td style={{ padding: '8px', fontFamily: 'monospace', color: '#0052CC' }}>
                      {offender.key}
                    </td>
                    <td style={{ padding: '8px' }}>
                      {offender.summary}
                    </td>
                    <td style={{
                      padding: '8px',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: offender.sprintCount >= 5 ? '#DE350B' : '#FF5630'
                    }}>
                      {offender.sprintCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{
        marginTop: '12px',
        padding: '12px',
        background: '#F4F5F7',
        borderRadius: '4px',
        fontSize: '12px',
        color: '#666'
      }}>
        <strong>💡 Tip:</strong> High carryover rates indicate scope creep or estimation issues.
        Repeat offenders may be blocked, poorly scoped, or too large. Consider breaking them down
        or addressing blockers.
      </div>
    </div>
  )
}

export default SprintCarryoverChart
