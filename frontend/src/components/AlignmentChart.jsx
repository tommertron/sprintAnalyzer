import { useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

const COLORS = {
  linked: '#0052CC',
  orphan: '#DFE1E6'
}

const styles = {
  container: {
    display: 'flex',
    gap: '24px',
    alignItems: 'flex-start',
    marginTop: '16px'
  },
  chartWrapper: {
    flex: '0 0 300px'
  },
  breakdown: {
    flex: 1,
    minWidth: '300px'
  },
  breakdownTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#666',
    marginBottom: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  hierarchyItem: {
    fontSize: '13px',
    padding: '4px 0',
    borderLeft: '2px solid transparent'
  },
  expandableRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
    padding: '4px 0',
    borderRadius: '3px'
  },
  expandableRowHover: {
    background: '#f5f5f5'
  },
  expandIcon: {
    width: '16px',
    height: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#666',
    fontSize: '10px',
    flexShrink: 0
  },
  issueLink: {
    fontFamily: 'monospace',
    color: '#0052CC',
    textDecoration: 'none',
    fontSize: '12px'
  },
  issueSummary: {
    color: '#333',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  issuePoints: {
    color: '#666',
    fontSize: '12px',
    flexShrink: 0
  },
  issueType: {
    fontSize: '10px',
    color: '#999',
    background: '#f0f0f0',
    padding: '1px 4px',
    borderRadius: '3px',
    flexShrink: 0
  },
  nestedList: {
    marginLeft: '20px',
    borderLeft: '1px solid #e0e0e0',
    paddingLeft: '8px'
  },
  noData: {
    textAlign: 'center',
    padding: '40px',
    color: '#666'
  },
  noParents: {
    fontSize: '13px',
    color: '#999',
    fontStyle: 'italic'
  }
}

// Expandable hierarchy item component
function HierarchyItem({ item, level, jiraServer, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  const hasChildren = (level === 'initiative' && item.epics?.length > 0) ||
                      (level === 'epic' && item.children?.length > 0) ||
                      (level === 'child' && item.imaginaryFriends?.length > 0)

  const levelColors = {
    initiative: '#0052CC',
    epic: '#6554C0',
    child: '#00875A',
    imaginaryFriend: '#FF991F'
  }

  const levelLabels = {
    initiative: 'Initiative',
    epic: 'Epic',
    child: item.issueType || 'Issue',
    imaginaryFriend: 'Sub-task'
  }

  return (
    <div style={styles.hierarchyItem}>
      <div
        style={{
          ...styles.expandableRow,
          cursor: hasChildren ? 'pointer' : 'default'
        }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        <span style={styles.expandIcon}>
          {hasChildren ? (expanded ? '▼' : '▶') : '•'}
        </span>
        <a
          href={`${jiraServer}/browse/${item.key}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...styles.issueLink, color: levelColors[level] }}
          onClick={(e) => e.stopPropagation()}
        >
          {item.key}
        </a>
        <span style={{ ...styles.issueType, borderColor: levelColors[level] }}>
          {levelLabels[level]}
        </span>
        <span style={styles.issueSummary} title={item.summary}>
          {item.summary}
        </span>
        <span style={styles.issuePoints}>
          {item.points?.toFixed(1) || 0} pts
        </span>
      </div>

      {expanded && hasChildren && (
        <div style={styles.nestedList}>
          {level === 'initiative' && item.epics?.map(epic => (
            <HierarchyItem
              key={epic.key}
              item={epic}
              level="epic"
              jiraServer={jiraServer}
            />
          ))}
          {level === 'epic' && item.children?.map(child => (
            <HierarchyItem
              key={child.key}
              item={child}
              level="child"
              jiraServer={jiraServer}
            />
          ))}
          {level === 'child' && item.imaginaryFriends?.map(friend => (
            <HierarchyItem
              key={friend.key}
              item={friend}
              level="imaginaryFriend"
              jiraServer={jiraServer}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function AlignmentChart({ data, discoveredSpaces = [], jiraServer = '' }) {
  if (!data || data.length === 0) {
    return <div style={styles.noData}>No alignment data available</div>
  }

  // Aggregate across all sprints (now using story points)
  const totals = data.reduce(
    (acc, sprint) => ({
      linked: acc.linked + (sprint.linkedToInitiative || 0),
      adHoc: acc.adHoc + (sprint.orphanCount || 0)
    }),
    { linked: 0, adHoc: 0 }
  )

  const total = totals.linked + totals.adHoc
  if (total === 0) {
    return <div style={styles.noData}>No completed story points in selected sprints</div>
  }

  const pieData = [
    { name: 'Initiative-linked', value: totals.linked, color: COLORS.linked },
    { name: 'Ad-hoc', value: totals.adHoc, color: COLORS.orphan }
  ]

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload
      const percentage = ((item.value / total) * 100).toFixed(1)
      return (
        <div style={{
          background: 'white',
          padding: '8px 12px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontWeight: '500' }}>{item.name}</div>
          <div style={{ color: '#666' }}>
            {item.value.toFixed(1)} pts ({percentage}%)
          </div>
        </div>
      )
    }
    return null
  }

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.05) return null
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fontSize: '14px', fontWeight: '500' }}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  // Collect all initiatives from included spaces
  const includedSpaces = discoveredSpaces.filter(s => !s.isExcluded)
  const allInitiatives = []
  for (const space of includedSpaces) {
    for (const init of space.initiatives || []) {
      allInitiatives.push(init)
    }
  }
  // Sort by points descending
  allInitiatives.sort((a, b) => (b.points || 0) - (a.points || 0))

  return (
    <div style={styles.container}>
      <div style={styles.chartWrapper}>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomizedLabel}
              outerRadius={100}
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(value) => <span style={{ color: '#333', fontSize: '13px' }}>{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div style={styles.breakdown}>
        <div style={styles.breakdownTitle}>Initiative Hierarchy (click to expand)</div>
        {allInitiatives.length === 0 ? (
          <div style={styles.noParents}>No linked initiatives found</div>
        ) : (
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {allInitiatives.slice(0, 15).map(init => (
              <HierarchyItem
                key={init.key}
                item={init}
                level="initiative"
                jiraServer={jiraServer}
              />
            ))}
            {allInitiatives.length > 15 && (
              <div style={{ padding: '8px 0', color: '#999', fontSize: '12px' }}>
                +{allInitiatives.length - 15} more initiatives
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default AlignmentChart
