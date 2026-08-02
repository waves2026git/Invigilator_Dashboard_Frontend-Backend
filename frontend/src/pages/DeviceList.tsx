import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDevices } from '../hooks/useDevices'
import { AssignmentModal } from '../components/AssignmentModal'
import type { Device } from '../services/api'
import { BACKEND_URL } from '../services/api'
import { useAuth } from '../contexts/AuthContext'

function Icon({ path, className = 'w-4 h-4' }: { path: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={path} />
    </svg>
  )
}

const ICONS = {
  device: 'M4 6h16v10H4V6Zm4 14h8M12 16v4',
  wifi: 'M5 13a10 10 0 0 1 14 0M8.5 16.5a5 5 0 0 1 7 0M12 20h.01',
  network: 'M3 12h4l3-9 4 18 3-9h4',
  clock: 'M12 8v4l3 3M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z',
  student: 'M22 10 12 5 2 10l10 5 10-5Zm0 0v6M6 12.5V17c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-14v5m0 4h.01',
}

function StatusBadge({ status }: { status: Device['status'] }) {
  const styles: Record<string, string> = {
    online: 'bg-green-50 text-green-700 ring-1 ring-green-200',
    offline: 'bg-gray-100 text-gray-500 ring-1 ring-gray-200',
    registered: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'online' ? 'bg-green-500' : status === 'offline' ? 'bg-gray-400' : 'bg-blue-500'}`} />
      {status}
    </span>
  )
}

const DOWNLOAD_LABELS: Record<string, string> = {
  pending: 'Download not started',
  downloading: 'Downloading exam',
  ready: 'Ready to start',
}

const DOWNLOAD_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  downloading: 'bg-yellow-50 text-yellow-700',
  ready: 'bg-green-50 text-green-700',
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

  // Calculate remaining time if exam started
  let timerDisplay: string | null = null
  if (a?.exam_started_at && a.duration_minutes) {
    const startedAt = new Date(a.exam_started_at).getTime()
    const endAt = startedAt + a.duration_minutes * 60 * 1000
    const remaining = Math.max(0, Math.floor((endAt - Date.now()) / 1000 / 60))
    timerDisplay = remaining > 0 ? `${remaining} min left` : 'Time up'
  }

  const examActive = a?.exam_status === 'active'

  let primaryLabel: string | null = null
  if (a && !examActive) {
    primaryLabel = a.download_status === 'ready' ? 'Start Exam' : 'Start Download'
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
            <Icon path={ICONS.device} className="w-6 h-6 text-gray-400" />
          </div>
          <div>
            <Link to={`/devices/${device.id}`} className="text-lg font-semibold text-gray-900 hover:text-indigo-600 transition-colors">
              {device.device_number || device.device_name}
            </Link>
            <p className="text-sm text-gray-400">{device.hostname || 'Unknown host'}</p>
          </div>
        </div>
        <StatusBadge status={device.status} />
      </div>

      {/* Assignment card */}
      {a && (
        <div className="bg-indigo-50/60 rounded-xl p-5 mb-5 space-y-3">
          <div>
            <div className="font-medium text-indigo-900">{a.exam_name}</div>
            <div className="flex items-center gap-1.5 text-sm text-indigo-700 mt-1">
              <Icon path={ICONS.student} className="w-3.5 h-3.5" />
              {a.student_name}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-medium ${DOWNLOAD_COLORS[a.download_status]}`}
            >
              {DOWNLOAD_LABELS[a.download_status] || a.download_status}
            </span>
            {examActive && (
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                In progress
              </span>
            )}
            {timerDisplay && (
              <span className={`inline-flex items-center gap-1 text-xs font-medium ${timerDisplay === 'Time up' ? 'text-red-600' : 'text-gray-600'}`}>
                <Icon path={ICONS.clock} className="w-3 h-3" />
                {timerDisplay}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Last seen — the one piece of device info worth always showing */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-5">
        <Icon path={ICONS.clock} className="w-3.5 h-3.5" />
        Last seen {timeSince}
      </div>

      {actionError && (
        <div className="mb-3 text-xs text-red-600 bg-red-50 rounded-lg p-2.5">
          {actionError}
        </div>
      )}

      {device.status === 'online' && !a && (
        <button
          onClick={onAssign}
          className="w-full py-3 px-4 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 transition-colors"
        >
          Assign Exam
        </button>
      )}

      {primaryLabel && (
        <button
          onClick={onPrimaryAction}
          disabled={actionLoading}
          className="w-full mb-2 py-3 px-4 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {actionLoading ? 'Working...' : primaryLabel}
        </button>
      )}

      {a && (
        <button
          onClick={onReset}
          disabled={actionLoading}
          className="w-full py-2.5 px-4 text-sm font-medium text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

  const handlePrimaryAction = async (device: Device) => {
    const a = device.assignment
    if (!a) return

    setActionErrors((prev) => ({ ...prev, [device.device_uuid]: '' }))
    setActionLoading((prev) => ({ ...prev, [device.device_uuid]: true }))

    try {
      if (a.download_status !== 'ready') {
        const res = await fetch(`${BACKEND_URL}/api/assignments/device/${device.device_uuid}/continue`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.detail || `Start download failed (${res.status})`)
        }
      } else {
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
      {assigned.length > 0 && (
        <div className="mb-6 bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Exam Readiness</span>
            <span className="text-sm font-bold text-green-600">{ready.length}/{assigned.length} ready</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
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