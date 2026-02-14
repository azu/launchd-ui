import { useState, useCallback } from "react"
import { readLogFile } from "@/lib/invoke"

type UseLogsReturn = {
  content: string
  modifiedAt: Date | null
  loading: boolean
  error: string | null
  fetchLog: (path: string, tailLines?: number) => Promise<void>
}

export function useLogs(): UseLogsReturn {
  const [content, setContent] = useState("")
  const [modifiedAt, setModifiedAt] = useState<Date | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchLog = useCallback(async (path: string, tailLines?: number) => {
    setLoading(true)
    setError(null)
    try {
      const result = await readLogFile(path, tailLines)
      setContent(result.content)
      setModifiedAt(
        result.modified_at ? new Date(Number(result.modified_at)) : null
      )
    } catch (e) {
      setError(String(e))
      setContent("")
      setModifiedAt(null)
    } finally {
      setLoading(false)
    }
  }, [])

  return { content, modifiedAt, loading, error, fetchLog }
}
