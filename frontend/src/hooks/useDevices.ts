import { useQuery } from '@tanstack/react-query'
import { fetchDevices, fetchDevice } from '../services/api'

// No WebSocket anywhere in this system anymore — see
// Exam-Device_Backend/docs/MQTT_ARCHITECTURE.md. Plain polling is the only
// live-update mechanism for this dashboard now; 3s keeps device state
// changes (online/offline, assignment progress) close to real-time without
// needing a push channel. staleTime 0 so a refocus/remount always refetches
// instead of serving a stale cached page in between ticks.
export function useDevices() {
  return useQuery({
    queryKey: ['devices'],
    queryFn: fetchDevices,
    refetchInterval: 3000,
    staleTime: 0,
  })
}

export function useDevice(id: string) {
  return useQuery({
    queryKey: ['device', id],
    queryFn: () => fetchDevice(id),
    enabled: !!id,
  })
}
