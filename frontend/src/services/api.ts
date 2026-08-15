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

// Backend migration: invigilator dashboard backend merged into the main
// Exam-Device_Backend (port 8000) — see backend migration notes.
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

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