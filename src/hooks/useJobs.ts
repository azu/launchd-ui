import { useState, useEffect, useCallback } from "react"
import type { JobListEntry, JobSource } from "@/types"
import { listJobs } from "@/lib/invoke"

type UseJobsReturn = {
  jobs: JobListEntry[]
  filteredJobs: JobListEntry[]
  loading: boolean
  error: string | null
  search: string
  setSearch: (value: string) => void
  sourceFilter: JobSource | "All"
  setSourceFilter: (value: JobSource | "All") => void
  refresh: () => Promise<void>
}

export function useJobs(): UseJobsReturn {
  const [jobs, setJobs] = useState<JobListEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [sourceFilter, setSourceFilter] = useState<JobSource | "All">("All")

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await listJobs()
      setJobs(result)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      search === "" || job.label.toLowerCase().includes(search.toLowerCase())
    const matchesSource =
      sourceFilter === "All" || job.source === sourceFilter
    return matchesSearch && matchesSource
  })

  return {
    jobs,
    filteredJobs,
    loading,
    error,
    search,
    setSearch,
    sourceFilter,
    setSourceFilter,
    refresh,
  }
}
