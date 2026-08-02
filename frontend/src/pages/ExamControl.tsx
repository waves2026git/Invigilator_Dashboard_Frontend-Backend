import { useState, useEffect, useMemo, useCallback } from 'react'
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
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
  published: 'bg-blue-50 text-blue-700 border-blue-200',
  standby: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  active: 'bg-green-50 text-green-700 border-green-200',
  closed: 'bg-red-50 text-red-700 border-red-200',
}

const STATUS_FILTERS = ['all', 'draft', 'published', 'standby', 'active', 'closed'] as const
type StatusFilter = typeof STATUS_FILTERS[number]
type SortOrder = 'newest' | 'oldest'

// Spinner component
function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-white inline-block"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  )
}

// Confirm dialog component
function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  confirmClassName,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  confirmClassName: string
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-lg text-white ${confirmClassName}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ExamControlPage() {
  const { token } = useAuth()
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')
  const [confirm, setConfirm] = useState<{ exam: Exam; action: 'active' | 'closed' } | null>(null)

  const hasActiveExams = exams.some(e => e.status === 'active')

  const fetchExams = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/data/exams/all`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setExams(await res.json())
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { fetchExams() }, [fetchExams])

  // Auto-refresh every 15s when there are active exams
  useEffect(() => {
    if (!hasActiveExams) return
    const interval = setInterval(fetchExams, 15000)
    return () => clearInterval(interval)
  }, [hasActiveExams, fetchExams])

  const updateStatus = async (exam: Exam, newStatus: 'active' | 'closed') => {
    setConfirm(null)
    setUpdating(exam._id)
    setError(null)
    try {
      const res = await fetch(`${BACKEND_URL}/api/data/exams/${exam._id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        setExams(prev => prev.map(e => e._id === exam._id ? { ...e, status: newStatus } : e))
      } else {
        const data = await res.json()
        setError(data.detail || 'Failed to update status')
      }
    } finally {
      setUpdating(null)
    }
  }

  const requestAction = (exam: Exam, action: 'active' | 'closed') => {
    if (action === 'closed') {
      setConfirm({ exam, action })
    } else {
      updateStatus(exam, action)
    }
  }

  const displayedExams = useMemo(() => {
    const filtered = statusFilter === 'all'
      ? exams
      : exams.filter(e => (e.status || 'draft') === statusFilter)

    return [...filtered].sort((a, b) => {
      const cmp = a._id.localeCompare(b._id)
      return sortOrder === 'newest' ? -cmp : cmp
    })
  }, [exams, statusFilter, sortOrder])

  if (loading) return (
    <div className="p-8 flex items-center gap-3 text-gray-500">
      <Spinner />
      <span>Loading exams...</span>
    </div>
  )

  return (
    <>
      <ConfirmDialog
        open={!!confirm}
        title="Close this exam?"
        message={`"${confirm?.exam.exam_name}" will be closed and students will no longer be able to submit answers. This cannot be undone.`}
        confirmLabel="Close Exam"
        confirmClassName="bg-red-600 hover:bg-red-700"
        onConfirm={() => confirm && updateStatus(confirm.exam, confirm.action)}
        onCancel={() => setConfirm(null)}
      />

      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Exam Control</h1>
          </div>

          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>

        {/* Status pill filters */}
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map(s => {
            const count = s === 'all' ? exams.length : exams.filter(e => (e.status || 'draft') === s).length
            const isActive = statusFilter === s
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${
                  isActive
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
              >
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                <span className={`ml-1.5 text-xs ${isActive ? 'text-gray-300' : 'text-gray-400'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Exam</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Questions</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Scheduled</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayedExams.map(exam => (
                <tr key={exam._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{exam.exam_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 font-mono">{exam.exam_code}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{exam.question_count ?? '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {exam.date && exam.time ? `${exam.date} ${exam.time}` : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {exam.duration_minutes ? `${exam.duration_minutes} min` : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${
                      STATUS_COLORS[exam.status] || STATUS_COLORS.draft
                    }`}>
                      {exam.status || 'draft'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {exam.status === 'published' && (
                      <button
                        onClick={() => requestAction(exam, 'active')}
                        disabled={updating === exam._id}
                        title="Start this exam now instead of waiting for its scheduled time"
                        className="px-4 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                      >
                        {updating === exam._id ? <><Spinner /> Activating...</> : 'Activate Now'}
                      </button>
                    )}
                    {exam.status === 'standby' && (
                      <button
                        onClick={() => requestAction(exam, 'active')}
                        disabled={updating === exam._id}
                        className="px-4 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                      >
                        {updating === exam._id ? <><Spinner /> Starting...</> : 'Start Exam'}
                      </button>
                    )}
                    {exam.status === 'active' && (
                      <button
                        onClick={() => requestAction(exam, 'closed')}
                        disabled={updating === exam._id}
                        className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                      >
                        {updating === exam._id ? <><Spinner /> Closing...</> : 'Close Exam'}
                      </button>
                    )}
                    {!['published', 'standby', 'active'].includes(exam.status) && (
                      <span className="text-sm text-gray-400">No action</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {displayedExams.length === 0 && (
            <div className="p-10 text-center">
              <p className="text-gray-500 text-sm mb-3">
                {exams.length === 0 ? 'No exams found.' : `No ${statusFilter} exams.`}
              </p>
              {exams.length > 0 && statusFilter !== 'all' && (
                <button
                  onClick={() => setStatusFilter('all')}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Clear filter
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}