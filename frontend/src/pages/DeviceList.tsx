import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDevices } from '../hooks/useDevices'
import { AssignmentModal } from '../components/AssignmentModal'
import type { Device } from '../services/api'
import { BACKEND_URL } from '../services/api'
import { useAuth } from '../contexts/AuthContext'

function StatusBadge({ status }: { status: Device['status'] }) {
  const styles = {
    online: 'status-online',
    offline: 'status-offline',
    registered: 'status-registered',
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  )
}

const DOWNLOAD_LABELS: Record<string, string> = {
  pending: 'Pending',
  downloading: 'Downloading',
  ready: 'Downloaded',
}

const DOWNLOAD_TOOLTIPS: Record<string, string> = {
  pending: 'Exam audio has not started downloading to the device yet.',
  downloading: 'Exam audio is downloading to the device.',
  ready: 'Exam audio has finished downloading — ready to start.',
}

function DeviceCard({
  device,
  onAssign,
  onReset,
  onPrimaryAction,
  actionError,
  actionLoading,
}: {
  device: Device
  onAssign: () => void
  onReset: () => void
  onPrimaryAction: () => void
  actionError?: string
  actionLoading?: boolean
}) {
  const timeSince = device.last_seen
    ? new Date(device.last_seen).toLocaleString()
    : 'Never'

  const a = device.assignment
  const downloadColors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-600',
    downloading: 'bg-yellow-100 text-yellow-800',
    ready: 'bg-green-100 text-green-800',
  }

  // Calculate remaining time if exam started
  let timerDisplay: string | null = null
  let completionTime: string | null = null
  if (a?.exam_started_at && a.duration_minutes) {
    const startedAt = new Date(a.exam_started_at).getTime()
    const endAt = startedAt + a.duration_minutes * 60 * 1000
    const remaining = Math.max(0, Math.floor((endAt - Date.now()) / 1000 / 60))
    timerDisplay = remaining > 0 ? `${remaining} min left` : 'Time up'
    completionTime = new Date(endAt).toLocaleTimeString()
  }

  const examActive = a?.exam_status === 'active'

  // Single adaptive primary action:
  // - not yet downloaded -> "Start Download" (resumes/kicks off download)
  // - downloaded, exam not active yet -> "Start Exam" (activates the exam)
  // - exam already active -> no button, nothing left to trigger
  let primaryLabel: string | null = null
  if (a && !examActive) {
    primaryLabel = a.download_status === 'ready' ? 'Start Exam' : 'Start Download'
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div>
          <Link to={`/devices/${device.id}`} className="text-lg font-semibold text-gray-900 hover:text-blue-600">
            {device.device_number || device.device_name}
          </Link>
          <p className="text-sm text-gray-500 mt-1">UUID: {device.device_uuid.slice(0, 8)}...</p>
        </div>
        <StatusBadge status={device.status} />
      </div>

      {/* Assignment info */}
      {a && (
        <div className="bg-blue-50 rounded-lg p-3 mb-4 text-sm">
          <div className="font-medium text-blue-900">{a.exam_name}</div>
          <div className="text-blue-700">Student: {a.student_name}</div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span
              className={`px-2 py-0.5 rounded text-xs inline-flex items-center gap-1 ${downloadColors[a.download_status]}`}
              title={DOWNLOAD_TOOLTIPS[a.download_status]}
            >
              {DOWNLOAD_LABELS[a.download_status] || a.download_status}
              <span className="opacity-60">ⓘ</span>
            </span>
            {examActive && (
              <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-800">
                In progress
              </span>
            )}
            {a.exam_started_at && (
              <span className="text-xs text-blue-600">
                Started: {new Date(a.exam_started_at).toLocaleTimeString()}
              </span>
            )}
            {completionTime && (
              <span className="text-xs text-purple-600">
                Ends: {completionTime}
              </span>
            )}
            {timerDisplay && (
              <span className={`text-xs font-medium ${timerDisplay === 'Time up' ? 'text-red-600' : 'text-green-600'}`}>
                {timerDisplay}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
        <div>
          <span className="text-gray-500">Hostname:</span>
          <span className="ml-1 text-gray-900">{device.hostname || '—'}</span>
        </div>
        <div>
          <span className="text-gray-500">IP:</span>
          <span className="ml-1 text-gray-900 font-mono">{device.ip_address || '—'}</span>
        </div>
        <div>
          <span className="text-gray-500">MAC:</span>
          <span className="ml-1 text-gray-900 font-mono text-xs">{device.mac_address || '—'}</span>
        </div>
        <div>
          <span className="text-gray-500">Last Seen:</span>
          <span className="ml-1 text-gray-900">{timeSince}</span>
        </div>
      </div>

      {actionError && (
        <div className="mb-3 text-xs text-red-600 bg-red-50 rounded-lg p-2">
          {actionError}
        </div>
      )}

      {device.status === 'online' && !a && (
        <button
          onClick={onAssign}
          className="w-full py-2 px-4 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
        >
          Assign Exam
        </button>
      )}

      {primaryLabel && (
        <button
          onClick={onPrimaryAction}
          disabled={actionLoading}
          className="w-full mb-2 py-2 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {actionLoading ? 'Working...' : primaryLabel}
        </button>
      )}

      {a && (
        <button
          onClick={onReset}
          disabled={actionLoading}
          className="w-full py-1.5 px-4 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Reset
        </button>
      )}
    </div>
  )
}

export default function DeviceListPage() {
  const { data: devices, isLoading, error, refetch } = useDevices()
  const { token } = useAuth()
  const [assignDevice, setAssignDevice] = useState<Device | null>(null)
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({})
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

  const handleReset = async (device: Device) => {
    if (!confirm(`Reset device ${device.device_number || device.device_name}?`)) return
    setActionErrors((prev) => ({ ...prev, [device.device_uuid]: '' }))
    setActionLoading((prev) => ({ ...prev, [device.device_uuid]: true }))
    try {
      const res = await fetch(`${BACKEND_URL}/api/assignments/device/${device.device_uuid}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || `Reset failed (${res.status})`)
      }
      refetch()
    } catch (e) {
      console.error('Reset failed', e)
      setActionErrors((prev) => ({
        ...prev,
        [device.device_uuid]: e instanceof Error ? e.message : 'Reset failed',
      }))
    } finally {
      setActionLoading((prev) => ({ ...prev, [device.device_uuid]: false }))
    }
  }

  // Single adaptive primary action handler — decides which endpoint to call
  // based on the device's current assignment state, so the invigilator only
  // ever sees one relevant button instead of several overlapping controls.
  const handlePrimaryAction = async (device: Device) => {
    const a = device.assignment
    if (!a) return

    setActionErrors((prev) => ({ ...prev, [device.device_uuid]: '' }))
    setActionLoading((prev) => ({ ...prev, [device.device_uuid]: true }))

    try {
      if (a.download_status !== 'ready') {
        // Not downloaded yet -> resume/kick off download.
        const res = await fetch(`${BACKEND_URL}/api/assignments/device/${device.device_uuid}/continue`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.detail || `Start download failed (${res.status})`)
        }
      } else {
        // Downloaded and waiting -> activate the exam.
        const res = await fetch(`${BACKEND_URL}/api/data/exams/${a.exam_id}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: 'active' }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.detail || `Start exam failed (${res.status})`)
        }
      }
      refetch()
    } catch (e) {
      console.error('Primary action failed', e)
      setActionErrors((prev) => ({
        ...prev,
        [device.device_uuid]: e instanceof Error ? e.message : 'Action failed',
      }))
    } finally {
      setActionLoading((prev) => ({ ...prev, [device.device_uuid]: false }))
    }
  }

  // Calculate progress: devices with download_status = "ready"
  const assigned = devices?.filter(d => d.assignment) || []
  const ready = assigned.filter(d => d.assignment?.download_status === 'ready')
  const progressPct = assigned.length > 0 ? (ready.length / assigned.length) * 100 : 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading devices...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-red-600">Failed to load devices. Is the backend running?</div>
      </div>
    )
  }

  if (!devices || devices.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">No devices registered yet. Power on a Pi to see it appear here.</div>
      </div>
    )
  }

  return (
    <>
      {/* Progress bar */}
      {assigned.length > 0 && (
        <div className="mb-6 bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Exam Readiness</span>
            <span className="text-sm font-bold text-green-600">{ready.length}/{assigned.length} ready</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-green-600 h-2.5 rounded-full transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {devices.map((device) => (
          <DeviceCard
            key={device.id}
            device={device}
            onAssign={() => setAssignDevice(device)}
            onReset={() => handleReset(device)}
            onPrimaryAction={() => handlePrimaryAction(device)}
            actionError={actionErrors[device.device_uuid]}
            actionLoading={actionLoading[device.device_uuid]}
          />
        ))}
      </div>

      {assignDevice && (
        <AssignmentModal
          deviceNumber={assignDevice.device_number || assignDevice.device_name}
          deviceUuid={assignDevice.device_uuid}
          onClose={() => setAssignDevice(null)}
          onAssigned={() => {
            setAssignDevice(null)
            refetch()
          }}
        />
      )}
    </>
  )
}