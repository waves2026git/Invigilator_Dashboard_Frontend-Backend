export interface DeviceAssignment {
  exam_id: string
  exam_name: string
  exam_status: string | null
  student_name: string
  download_status: 'pending' | 'downloading' | 'ready'
  exam_started_at: string | null
  duration_minutes: number
  status: string
}

export interface Device {
  id: string
  device_uuid: string
  device_number: string | null
  device_name: string
  hostname: string | null
  mac_address: string | null
  ip_address: string | null
  software_version: string | null
  os_version: string | null
  status: 'online' | 'offline' | 'registered'
  last_seen: string | null
  created_at: string
  updated_at: string
  assignment: DeviceAssignment | null
}

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8001'
export const WS_BASE_URL = import.meta.env.VITE_WS_URL?.replace('/ws', '') || 'http://localhost:8001'

export async function fetchDevices(): Promise<Device[]> {
  const response = await fetch(`${BACKEND_URL}/api/devices`)
  if (!response.ok) {
    throw new Error('Failed to fetch devices')
  }
  return response.json()
}

export async function fetchDevice(id: string): Promise<Device> {
  const response = await fetch(`${BACKEND_URL}/api/devices/${id}`)
  if (!response.ok) {
    throw new Error('Failed to fetch device')
  }
  return response.json()
}

export function getWsUrl(): string {
  const base = BACKEND_URL.replace('http://', 'ws://').replace('https://', 'wss://')
  return `${base}/ws/dashboard`
}