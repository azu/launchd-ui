import { useCallback, useEffect, useMemo, useState } from "react"
import { getProcessStats } from "@/lib/invoke"
import type { ProcessStats } from "@/types"

const MAX_DATA_POINTS = 60
const POLL_INTERVAL_MS = 2000

export type ProcessStatsPoint = {
  timestamp: number
  cpu_percent: number
  memory_bytes: number
}

type UseProcessStatsResult = {
  data: ProcessStatsPoint[]
  latest: ProcessStatsPoint | null
  error: string | null
}

export function useProcessStats(
  pid: number | null,
  enabled: boolean,
): UseProcessStatsResult {
  const [data, setData] = useState<ProcessStatsPoint[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setData([])
    setError(null)
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
        return next.slice(-MAX_DATA_POINTS)
      })
    } catch (error) {
      setError(String(error))
    }
  }, [pid])

  useEffect(() => {
    if (!enabled || pid === null) return

    void fetchStats()
    const intervalId = window.setInterval(() => {
      void fetchStats()
    }, POLL_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [enabled, fetchStats, pid])

  const latest = useMemo(
    () => data[data.length - 1] ?? null,
    [data],
  )

  return { data, latest, error }
}
