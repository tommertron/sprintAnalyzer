const styles = {
  card: {
    background: 'white',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  title: {
    fontSize: '12px',
    fontWeight: '500',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '8px'
  },
  value: {
    fontSize: '32px',
    fontWeight: '600',
    color: '#1a1a1a'
  },
  unit: {
    fontSize: '14px',
    fontWeight: '400',
    color: '#666',
    marginLeft: '4px'
  }
}

function MetricCard({ title, value, unit }) {
  return (
    <div style={styles.card}>
      <div style={styles.title}>{title}</div>
      <div style={styles.value}>
        {typeof value === 'number' ? value.toFixed(1) : value}
        <span style={styles.unit}>{unit}</span>
      </div>
    </div>
  )
}

export default MetricCard
