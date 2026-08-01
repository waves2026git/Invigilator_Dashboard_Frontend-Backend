import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

interface Student {
  _id: string
  name: string
  student_id: number
  assigned?: boolean  // already assigned to another device for this exam
}

interface Exam {
  _id: string
  exam_name: string
  exam_code: number
  question_count: number
  status: string
}

interface AssignmentModalProps {
  deviceNumber: string
  deviceUuid: string
  onClose: () => void
  onAssigned: () => void
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8001'

export function AssignmentModal({ deviceNumber, deviceUuid, onClose, onAssigned }: AssignmentModalProps) {
  const { token } = useAuth()
  const [exams, setExams] = useState<Exam[]>([])
  const [selectedExam, setSelectedExam] = useState('')
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set())
  const [studentSearch, setStudentSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Fetch exams on mount
  useEffect(() => {
    const fetchExams = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/data/exams/all`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (!res.ok) throw new Error('Failed to fetch exams')
        const data = await res.json()
        // Filter to only standby/active exams
        setExams(data.filter((e: Exam) => ['published', 'standby', 'active'].includes(e.status)))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load exams')
      } finally {
        setLoading(false)
      }
    }
    fetchExams()
  }, [token])

  // Fetch enrolled students when exam selected
  useEffect(() => {
    if (!selectedExam) {
      setStudents([])
      setSelectedStudents(new Set())
      setStudentSearch('')
      return
    }

    const fetchStudents = async () => {
      setLoadingStudents(true)
      setError('')
      try {
        const res = await fetch(`${BACKEND_URL}/api/data/exams/${selectedExam}/students`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (!res.ok) throw new Error('Failed to fetch students')
        setStudents(await res.json())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load students')
      } finally {
        setLoadingStudents(false)
      }
    }
    fetchStudents()
  }, [selectedExam, token])

  const filteredStudents = students.filter((s) => {
    const q = studentSearch.trim().toLowerCase()
    if (!q) return true
    return (
      s.name.toLowerCase().includes(q) ||
      s.student_id.toString().includes(q)
    )
  })

  const toggleStudent = (studentId: string) => {
    setSelectedStudents((prev) => {
      const next = new Set(prev)
      if (next.has(studentId)) {
        next.delete(studentId)
      } else {
        next.add(studentId)
      }
      return next
    })
  }

  const allFilteredSelected =
    filteredStudents.length > 0 &&
    filteredStudents.every((s) => selectedStudents.has(s.student_id.toString()))

  const handleSelectAll = () => {
    setSelectedStudents((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) {
        // Unselect all currently-filtered students
        filteredStudents.forEach((s) => next.delete(s.student_id.toString()))
      } else {
        // Select all currently-filtered students
        filteredStudents.forEach((s) => next.add(s.student_id.toString()))
      }
      return next
    })
  }

  const handleAssign = async () => {
    if (selectedStudents.size === 0 || !selectedExam) {
      setError('Please select an exam and at least one student')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const studentIds = Array.from(selectedStudents)
      const results = await Promise.allSettled(
        studentIds.map((studentId) =>
          fetch(`${BACKEND_URL}/api/assignments`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              device_number: deviceNumber,
              student_id: studentId,
              exam_id: selectedExam,
            }),
          }).then(async (response) => {
            if (!response.ok) {
              const data = await response.json().catch(() => ({}))
              throw new Error(data.detail || `Assignment failed for student ${studentId}`)
            }
            return response
          })
        )
      )

      const failures = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]
      if (failures.length > 0) {
        const messages = failures.map((f) => f.reason?.message || 'Unknown error')
        throw new Error(
          failures.length === studentIds.length
            ? messages[0]
            : `${failures.length} of ${studentIds.length} assignments failed: ${messages[0]}`
        )
      }

      onAssigned()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assignment failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Assign Exam to {deviceNumber}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading exams...</div>
        ) : (
          <div className="space-y-4">
            {/* Step 1: Select Exam */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                1. Select Exam
              </label>
              <select
                value={selectedExam}
                onChange={(e) => {
                  setSelectedExam(e.target.value)
                  setSelectedStudents(new Set())
                  setStudentSearch('')
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select Exam --</option>
                {exams.map((e) => (
                  <option key={e._id} value={e._id}>
                    {e.exam_name} (Code: {e.exam_code}) - {e.status}
                  </option>
                ))}
              </select>
              {exams.length === 0 && (
                <p className="text-sm text-gray-500 mt-1">No exams available</p>
              )}
            </div>

            {/* Step 2: Select Students (appears after exam selected) */}
            {selectedExam && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    2. Select Students (enrolled in this exam)
                    {selectedStudents.size > 0 && (
                      <span className="text-gray-500 font-normal"> — {selectedStudents.size} selected</span>
                    )}
                  </label>
                  {students.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {allFilteredSelected ? 'Unselect All' : 'Assign All'}
                    </button>
                  )}
                </div>

                {students.length > 0 && (
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Search by name or ID..."
                    className="w-full px-3 py-2 mb-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                )}

                {loadingStudents ? (
                  <div className="text-center py-4 text-gray-500">Loading students...</div>
                ) : students.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg">
                    No unassigned students for this exam
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg">
                    No students match "{studentSearch}"
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg divide-y max-h-60 overflow-y-auto">
                    {filteredStudents.map((s) => {
                      const idStr = s.student_id.toString()
                      const checked = selectedStudents.has(idStr)
                      return (
                        <label
                          key={s._id}
                          className={`flex items-center p-3 cursor-pointer hover:bg-gray-50 ${
                            checked ? 'bg-blue-50' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleStudent(idStr)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="ml-3 text-sm text-gray-900">
                            {s.name} <span className="text-gray-500">(ID: {s.student_id})</span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                onClick={onClose}
                className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                disabled={submitting || selectedStudents.size === 0 || !selectedExam}
                className="flex-1 py-2 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting
                  ? 'Assigning...'
                  : selectedStudents.size > 1
                  ? `Assign Exam (${selectedStudents.size})`
                  : 'Assign Exam'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}