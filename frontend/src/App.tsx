import { Routes, Route, Navigate } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import DeviceListPage from './pages/DeviceList'
import DeviceDetailsPage from './pages/DeviceDetails'
import ExamControlPage from './pages/ExamControl'
import LoginPage from './pages/Login'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

function AppLayout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar />
        <main className="flex-1 p-6">
          <Routes>
            <Route path="/" element={<Navigate to="/devices" replace />} />
            <Route path="/devices" element={<DeviceListPage />} />
            <Route path="/devices/:id" element={<DeviceDetailsPage />} />
            <Route path="/exams" element={<ExamControlPage />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  )
}