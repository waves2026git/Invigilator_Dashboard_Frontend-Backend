import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { fetchDevices, fetchDevice, getWsUrl } from '../services/api'

const DEVICE_EVENTS = new Set(['device_heartbeat', 'device_connected', 'device_disconnected', 'devices_went_offline'])

export function useDevices() {
  const queryClient = useQueryClient()
  const stopRef = useRef(false)

  const query = useQuery({
    queryKey: ['devices'],
    queryFn: fetchDevices,
    refetchInterval: 30000, // HTTP fallback if WS drops
    staleTime: 10000,
  })

  useEffect(() => {
    stopRef.current = false
    let ws: WebSocket
    let retryTimeout: ReturnType<typeof setTimeout>

    function connect() {
      if (stopRef.current) return
      ws = new WebSocket(getWsUrl())

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (DEVICE_EVENTS.has(data.event)) {
            queryClient.invalidateQueries({ queryKey: ['devices'] })
          }
        } catch { /* ignore malformed frames */ }
      }

      ws.onclose = () => {
        if (!stopRef.current) {
          retryTimeout = setTimeout(connect, 3000) // reconnect after 3s
        }
      }
    }

    connect()

    return () => {
      stopRef.current = true
      clearTimeout(retryTimeout)
      ws?.close()
    }
  }, [queryClient])

  return query
}

export function useDevice(id: string) {
  return useQuery({
    queryKey: ['device', id],
    queryFn: () => fetchDevice(id),
    enabled: !!id,
  })
}