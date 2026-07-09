import { useEffect, useState } from 'react'
import Dashboard from './pages/Dashboard'
import LandingPage from './pages/landingPage'

function getPath() {
  return window.location.pathname
}

function App() {
  const [path, setPath] = useState(getPath)

  useEffect(() => {
    const handleNavigation = () => setPath(getPath())

    window.addEventListener('popstate', handleNavigation)
    window.addEventListener('moon-agent:navigation', handleNavigation)

    return () => {
      window.removeEventListener('popstate', handleNavigation)
      window.removeEventListener('moon-agent:navigation', handleNavigation)
    }
  }, [])

  if (path === '/app') return <Dashboard />

  return <LandingPage />
}

export default App
