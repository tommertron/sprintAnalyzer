import { useState, useEffect, useCallback } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import { setAuthErrorHandler } from './services/api'

function App() {
  const [credentials, setCredentials] = useState(null)
  const [tokenError, setTokenError] = useState(null)

  // Set up global auth error handler
  useEffect(() => {
    setAuthErrorHandler((errorMessage) => {
      setTokenError(errorMessage)
    })
    return () => setAuthErrorHandler(null)
  }, [])

  useEffect(() => {
    // Check for stored credentials on mount
    const stored = localStorage.getItem('jiraCredentials')
    if (stored) {
      try {
        setCredentials(JSON.parse(stored))
      } catch (e) {
        localStorage.removeItem('jiraCredentials')
      }
    }
  }, [])

  const handleLogin = (creds) => {
    localStorage.setItem('jiraCredentials', JSON.stringify(creds))
    setCredentials(creds)
    setTokenError(null)
  }

  const handleLogout = () => {
    localStorage.removeItem('jiraCredentials')
    setCredentials(null)
    setTokenError(null)
  }

  const handleCredentialsUpdate = useCallback((updatedCreds) => {
    localStorage.setItem('jiraCredentials', JSON.stringify(updatedCreds))
    setCredentials(updatedCreds)
    setTokenError(null)
  }, [])

  const handleDismissTokenError = useCallback(() => {
    setTokenError(null)
  }, [])

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
