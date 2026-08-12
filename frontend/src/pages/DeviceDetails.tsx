import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useDevice } from '../hooks/useDevices'
import { useAuth } from '../contexts/AuthContext'
import { BACKEND_URL } from '../services/api'
import type { Device } from '../services/api'

export default function DeviceDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const { data: device, isLoading, error, refetch } = useDevice(id || '')
  const { token } = useAuth()
  const [clearing, setClearing] = useState(false)
  const [clearError, setClearError] = useState('')

  const handleClearData = async () => {
    if (!device) return
    if (!confirm(
      `Clear locally stored recordings on ${device.device_number || device.device_name}? ` +
      `Only recordings already confirmed uploaded to the server will be deleted.`
    )) return

    setClearing(true)
    setClearError('')
    try {
      const res = await fetch(`${BACKEND_URL}/api/devices/${device.device_uuid}/clear-data`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || `Clear failed (${res.status})`)
      }
      refetch()
    } catch (e) {
      setClearError(e instanceof Error ? e.message : 'Clear failed')
    } finally {
      setClearing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading device details...</div>
      </div>
    )
  }

  if (error || !device) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-red-600">Device not found.</div>
      </div>
    )
  }

  const StatusBadge = ({ status }: { status: Device['status'] }) => {
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

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-4">
        <Link to="/devices" className="text-sm text-blue-600 hover:underline">
          ← Back to Devices
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{device.device_name}</h1>
          <StatusBadge status={device.status} />
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <DetailRow label="Device UUID" value={device.device_uuid} mono />
            <DetailRow label="Status" value={<StatusBadge status={device.status} />} />
          </div>

          <hr className="border-gray-200" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DetailRow label="Hostname" value={device.hostname} />
            <DetailRow label="IP Address" value={device.ip_address} mono />
            <DetailRow label="MAC Address" value={device.mac_address} mono />
            <DetailRow label="Software Version" value={device.software_version} />
            <DetailRow label="OS Version" value={device.os_version} />
          </div>

          <hr className="border-gray-200" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DetailRow label="Created At" value={new Date(device.created_at).toLocaleString()} />
            <DetailRow label="Last Seen" value={device.last_seen ? new Date(device.last_seen).toLocaleString() : 'Never'} />
            <DetailRow label="Updated At" value={new Date(device.updated_at).toLocaleString()} />
          </div>

          <hr className="border-gray-200" />

          <div>
            {clearError && (
              <div className="mb-3 text-sm text-red-600 bg-red-50 rounded-lg p-2.5">
                {clearError}
              </div>
            )}
            <button
              onClick={handleClearData}
              disabled={clearing || !!device.assignment}
              className="w-full py-2.5 px-4 text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {clearing ? 'Clearing...' : 'Clear Device Data'}
            </button>
            {device.assignment && (
              <p className="text-xs text-gray-400 mt-1.5">
                Disabled while an assignment is active — reset the device first.
              </p>
            )}
            {!device.assignment && (
              <p className="text-xs text-gray-400 mt-1.5">
                Deletes locally stored recordings on the device, but only ones already confirmed uploaded to the server.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className={`mt-1 text-sm ${mono ? 'font-mono' : ''} text-gray-900`}>{value || '—'}</dd>
    </div>
  )
}