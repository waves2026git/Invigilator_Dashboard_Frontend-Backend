import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

interface Exam {
  _id: string
  exam_name: string
  exam_code: number
  question_count: number
  status: string
  date?: string
  time?: string
  duration_minutes?: number
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8001'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  published: 'bg-blue-100 text-blue-800',
  standby: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  closed: 'bg-red-100 text-red-800',
}

export default function ExamControlPage() {
  const { token } = useAuth()
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchExams = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/data/exams/all`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setExams(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchExams() }, [token])

  const updateStatus = async (exam: Exam, newStatus: 'active' | 'closed') => {
    setUpdating(exam._id)
    setError(null)
    try {
      const res = await fetch(`${BACKEND_URL}/api/data/exams/${exam._id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        setExams(exams.map(e => e._id === exam._id ? { ...e, status: newStatus } : e))
      } else {
        const data = await res.json()
        setError(data.detail || 'Failed to update')
      }
    } finally {
      setUpdating(null)
    }
  }

  if (loading) return <div className="p-6 text-gray-500">Loading exams...</div>

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Exam Control</h1>
      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg">{error}</div>}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Exam</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scheduled</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {exams.map(exam => (
              <tr key={exam._id}>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{exam.exam_name}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{exam.exam_code}</td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {exam.date && exam.time ? `${exam.date} ${exam.time}` : '-'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {exam.duration_minutes ? `${exam.duration_minutes} min` : '-'}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    STATUS_COLORS[exam.status] || 'bg-gray-100 text-gray-600'
                  }`}>
                    {exam.status || 'draft'}
                  </span>
                </td>
                <td className="px-6 py-4 space-x-2">
                  {exam.status === 'standby' && (
                    <button
                      onClick={() => updateStatus(exam, 'active')}
                      disabled={updating === exam._id}
                      className="px-4 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {updating === exam._id ? '...' : 'Start Exam'}
                    </button>
                  )}
                  {exam.status === 'active' && (
                    <button
                      onClick={() => updateStatus(exam, 'closed')}
                      disabled={updating === exam._id}
                      className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {updating === exam._id ? '...' : 'Close Exam'}
                    </button>
                  )}
                  {!['standby', 'active'].includes(exam.status) && (
                    <span className="text-sm text-gray-400">No action</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {exams.length === 0 && (
          <div className="p-6 text-center text-gray-500">No exams found</div>
        )}
      </div>
    </div>
  )
}
