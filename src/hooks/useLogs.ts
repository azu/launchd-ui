import { useState, useCallback, useRef, useEffect } from "react"
import { readLogFile } from "@/lib/invoke"
import { AnsiUp } from "ansi_up"

const ansiUp = new AnsiUp()
ansiUp.use_classes = true

function stripControl(text: string): string {
  return text
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1a\x1c-\x1f\x7f]/g, "")
}

type UseLogsReturn = {
  contentHtml: string
  modifiedAt: Date | null
  loading: boolean
  error: string | null
  tailing: boolean
  fetchLog: (path: string, tailLines?: number) => Promise<void>
  startTailing: (path: string, tailLines?: number, intervalMs?: number) => void
  stopTailing: () => void
}

export function useLogs(): UseLogsReturn {
  const [contentHtml, setContentHtml] = useState("")
  const [modifiedAt, setModifiedAt] = useState<Date | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tailing, setTailing] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchLog = useCallback(async (path: string, tailLines?: number) => {
    setLoading(true)
    setError(null)
    try {
      const result = await readLogFile(path, tailLines)
      const cleaned = stripControl(result.content)
      setContentHtml(ansiUp.ansi_to_html(cleaned))
      setModifiedAt(
        result.modified_at ? new Date(Number(result.modified_at)) : null
      )
    } catch (e) {
      setError(String(e))
      setContentHtml("")
      setModifiedAt(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const stopTailing = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setTailing(false)
  }, [])

  const startTailing = useCallback(
    (path: string, tailLines?: number, intervalMs = 2000) => {
      stopTailing()
      setTailing(true)
      fetchLog(path, tailLines)
      intervalRef.current = setInterval(() => {
        fetchLog(path, tailLines)
      }, intervalMs)
    },
    [fetchLog, stopTailing]
  )

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  return {
    contentHtml,
    modifiedAt,
    loading,
    error,
    tailing,
    fetchLog,
    startTailing,
    stopTailing,
  }
}
