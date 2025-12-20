import { useState } from 'react'
import { validateCredentials } from '../services/api'

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    padding: '20px'
  },
  card: {
    background: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    padding: '40px',
    width: '100%',
    maxWidth: '400px'
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    marginBottom: '8px',
    color: '#1a1a1a'
  },
  subtitle: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '24px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    marginBottom: '4px',
    display: 'block'
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px'
  },
  button: {
    background: '#0052CC',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '12px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    marginTop: '8px'
  },
  buttonDisabled: {
    background: '#ccc',
    cursor: 'not-allowed'
  },
  error: {
    background: '#FFEBE6',
    border: '1px solid #DE350B',
    borderRadius: '4px',
    padding: '12px',
    color: '#DE350B',
    fontSize: '14px'
  },
  help: {
    fontSize: '12px',
    color: '#666',
    marginTop: '4px'
  }
}

function Login({ onLogin }) {
  const [server, setServer] = useState('')
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const result = await validateCredentials(server, email, token)

      if (result.data?.valid) {
        onLogin({
          server,
          email,
          token,
          user: result.data.user
        })
      } else {
        setError('Invalid credentials')
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to validate credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Sprint Analyzer</h1>
        <p style={styles.subtitle}>Connect with your Jira account to analyze sprint metrics</p>

        {error && <div style={styles.error}>{error}</div>}

        <form style={styles.form} onSubmit={handleSubmit}>
          <div>
            <label style={styles.label}>Jira Server URL</label>
            <input
              style={styles.input}
              type="url"
              placeholder="https://your-company.atlassian.net"
              value={server}
              onChange={(e) => setServer(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={styles.label}>Email</label>
            <input
              style={styles.input}
              type="email"
              placeholder="your.email@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={styles.label}>API Token</label>
            <input
              style={styles.input}
              type="password"
              placeholder="Your Jira API token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
            />
            <p style={styles.help}>
              Generate a token at{' '}
              <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer">
                Atlassian Account Settings
              </a>
            </p>
          </div>

          <button
            type="submit"
            style={{
              ...styles.button,
              ...(loading ? styles.buttonDisabled : {})
            }}
            disabled={loading}
          >
            {loading ? 'Connecting...' : 'Connect to Jira'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login
