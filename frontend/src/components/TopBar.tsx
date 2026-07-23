import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

export function TopBar() {
  const [now, setNow] = useState(() => new Date().toLocaleString())
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const id = setInterval(() => setNow(new Date().toLocaleString()), 1000)
    return () => clearInterval(id)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <h2 className="text-lg font-semibold text-gray-900">Devices</h2>
      <div className="flex items-center gap-4">
        <div className="text-sm text-gray-500">{now}</div>
        {user && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-700">{user.name}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  )
}