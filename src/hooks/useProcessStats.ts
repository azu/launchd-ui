import { useState, useEffect, useRef, useCallback } from "react"
import { getProcessStats } from "@/lib/invoke"
import type { ProcessStats } from "@/types"

const MAX_DATA_POINTS = 60
const POLL_INTERVAL_MS = 2000

export type StatsDataPoint = {
  timestamp: number
  cpu_percent: number
  memory_bytes: number
}

type UseProcessStatsReturn = {
  data: StatsDataPoint[]
  latest: StatsDataPoint | null
  error: string | null
}

export function useProcessStats(
  pid: number | null,
  enabled: boolean,
): UseProcessStatsReturn {
  const [data, setData] = useState<StatsDataPoint[]>([])
  const [error, setError] = useState<string | null>(null)
  const prevPidRef = useRef<number | null>(null)

  // Reset data when PID changes
  useEffect(() => {
    if (prevPidRef.current !== pid) {
      setData([])
      setError(null)
      prevPidRef.current = pid
    }
  }, [pid])

  const fetchStats = useCallback(async () => {
    if (pid === null) return
    try {
      const stats: ProcessStats = await getProcessStats(pid)
      setError(null)
      setData((prev) => {
        const next = [
          ...prev,
          {
            timestamp: stats.timestamp,
            cpu_percent: stats.cpu_percent,
            memory_bytes: stats.memory_bytes,
          },
        ]
        if (next.length > MAX_DATA_POINTS) {
          return next.slice(next.length - MAX_DATA_POINTS)
        }
        return next
      })
    } catch (e) {
      setError(String(e))
    }
  }, [pid])

  useEffect(() => {
    if (!enabled || pid === null) return

    // Fetch immediately on start
    fetchStats()

    const id = setInterval(fetchStats, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [enabled, pid, fetchStats])

  const latest = data.length > 0 ? data[data.length - 1] : null

  return { data, latest, error }
}
