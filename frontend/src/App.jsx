import { useState, useEffect, useCallback } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import { setAuthErrorHandler, loadStoredCredentials, saveStoredCredentials, clearStoredCredentials } from './services/api'

function App() {
  const [credentials, setCredentials] = useState(null)
  const [tokenError, setTokenError] = useState(null)
  const [loading, setLoading] = useState(true)

  // Set up global auth error handler
  useEffect(() => {
    setAuthErrorHandler((errorMessage) => {
      setTokenError(errorMessage)
    })
    return () => setAuthErrorHandler(null)
  }, [])

  useEffect(() => {
    // Load credentials from backend file storage
    async function loadCredentials() {
      try {
        const stored = await loadStoredCredentials()
        if (stored?.jira) {
          setCredentials(stored.jira)
        }
      } catch (e) {
        // Backend not available or no credentials stored
        console.log('No stored credentials found')
      } finally {
        setLoading(false)
      }
    }
    loadCredentials()
  }, [])

  const handleLogin = async (creds) => {
    try {
      await saveStoredCredentials({ jira: creds })
    } catch (e) {
      console.error('Failed to save credentials to backend:', e)
    }
    setCredentials(creds)
    setTokenError(null)
  }

  const handleLogout = async () => {
    try {
      await clearStoredCredentials()
    } catch (e) {
      console.error('Failed to clear credentials:', e)
    }
    setCredentials(null)
    setTokenError(null)
  }

  const handleCredentialsUpdate = useCallback(async (updatedCreds) => {
    try {
      await saveStoredCredentials({ jira: updatedCreds })
    } catch (e) {
      console.error('Failed to save credentials to backend:', e)
    }
    setCredentials(updatedCreds)
    setTokenError(null)
  }, [])

  const handleDismissTokenError = useCallback(() => {
    setTokenError(null)
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#666' }}>
        Loading...
      </div>
    )
  }

  if (!credentials) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <Dashboard
      credentials={credentials}
      onLogout={handleLogout}
      onCredentialsUpdate={handleCredentialsUpdate}
      tokenError={tokenError}
      onDismissTokenError={handleDismissTokenError}
    />
  )
}

export default App
