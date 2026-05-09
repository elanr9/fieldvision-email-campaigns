import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Login from './components/Login.tsx'

const AUTH_KEY = 'fv_authed'

function AuthGate() {
  const [authed, setAuthed] = useState<boolean>(
    () => typeof window !== 'undefined' && window.localStorage.getItem(AUTH_KEY) === '1'
  )

  if (!authed) {
    return (
      <Login
        onSuccess={() => {
          window.localStorage.setItem(AUTH_KEY, '1')
          setAuthed(true)
        }}
      />
    )
  }

  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate />
  </StrictMode>,
)
