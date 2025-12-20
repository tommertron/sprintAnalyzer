import { useState, useEffect } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

function App() {
  const [credentials, setCredentials] = useState(null)

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
  }

  const handleLogout = () => {
    localStorage.removeItem('jiraCredentials')
    setCredentials(null)
  }

  if (!credentials) {
    return <Login onLogin={handleLogin} />
  }

  return <Dashboard credentials={credentials} onLogout={handleLogout} />
}

export default App
