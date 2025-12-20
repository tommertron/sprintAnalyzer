const styles = {
  container: {
    marginTop: '8px'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px'
  },
  label: {
    fontSize: '12px',
    color: '#666',
    fontWeight: '500'
  },
  hint: {
    fontSize: '11px',
    color: '#999'
  },
  spaceList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px'
  },
  spaceChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    border: '1px solid',
    transition: 'all 0.15s ease'
  },
  included: {
    background: '#E6F0FF',
    borderColor: '#0052CC',
    color: '#0052CC'
  },
  excluded: {
    background: '#f5f5f5',
    borderColor: '#ddd',
    color: '#999',
    textDecoration: 'line-through'
  },
  count: {
    fontSize: '11px',
    opacity: 0.7
  },
  noSpaces: {
    fontSize: '12px',
    color: '#999',
    fontStyle: 'italic'
  }
}

function SpaceExclusionList({ discoveredSpaces = [], excludedSpaces = [], onChange }) {
  if (!discoveredSpaces || discoveredSpaces.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={styles.label}>Parent Spaces:</span>
        </div>
        <div style={styles.noSpaces}>
          No parent spaces found (stories need Story → Epic → Parent hierarchy)
        </div>
      </div>
    )
  }

  const toggleSpace = (projectKey) => {
    if (excludedSpaces.includes(projectKey)) {
      onChange(excludedSpaces.filter(k => k !== projectKey))
    } else {
      onChange([...excludedSpaces, projectKey])
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.label}>Parent Spaces:</span>
        <span style={styles.hint}>(click to exclude from alignment)</span>
      </div>
      <div style={styles.spaceList}>
        {discoveredSpaces.map(space => {
          const isExcluded = excludedSpaces.includes(space.projectKey)
          return (
            <div
              key={space.projectKey}
              style={{
                ...styles.spaceChip,
                ...(isExcluded ? styles.excluded : styles.included)
              }}
              onClick={() => toggleSpace(space.projectKey)}
              title={isExcluded ? 'Click to include' : 'Click to exclude'}
            >
              <span>{space.projectKey}</span>
              <span style={styles.count}>({space.totalCount})</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default SpaceExclusionList
