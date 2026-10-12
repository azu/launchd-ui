import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SortableTableHead } from "@/components/ui/sortable-table-head"
import type { SortState } from "@/components/ui/sort-types"
import { JobRow } from "@/components/JobRow"
import type { JobListEntry } from "@/types"
import { useState } from "react"

const sourceLabels: Record<JobListEntry["source"], string> = {
  UserAgent: "User",
  SystemAgent: "System",
  SystemDaemon: "Daemon",
}

function getSortValue(job: JobListEntry, key: string): string | number | null {
  if (key === "source") return sourceLabels[job.source]
  if (key === "pid") return job.pid
  if (key === "last_run_at") {
    return job.last_run_at === null ? null : Number(job.last_run_at)
  }
  if (key === "label") return job.label
  if (key === "status") return job.status
  return null
}

function compareJobs(firstJob: JobListEntry, secondJob: JobListEntry, sortState: SortState) {
  const firstValue = getSortValue(firstJob, sortState.key)
  const secondValue = getSortValue(secondJob, sortState.key)

  if (firstValue === null && secondValue === null) return 0
  if (firstValue === null) return 1
  if (secondValue === null) return -1

  const comparison =
    typeof firstValue === "number" && typeof secondValue === "number"
      ? firstValue - secondValue
      : String(firstValue).localeCompare(String(secondValue))

  return sortState.direction === "asc" ? comparison : -comparison
}

type JobListProps = {
  jobs: JobListEntry[]
  loading: boolean
  onStart: (job: JobListEntry) => void
  onStop: (job: JobListEntry) => void
  onRestart: (job: JobListEntry) => void
  onKickstart: (job: JobListEntry) => void
  onDelete: (job: JobListEntry) => void
  onSelect: (job: JobListEntry) => void
  onRevealInFinder: (job: JobListEntry) => void
}

export function JobList({
  jobs,
  loading,
  onStart,
  onStop,
  onRestart,
  onKickstart,
  onDelete,
  onSelect,
  onRevealInFinder,
}: JobListProps) {
  const [sortState, setSortState] = useState<SortState>({
    key: "label",
    direction: "asc",
  })

  const sortedJobs = [...jobs].sort((firstJob, secondJob) =>
    compareJobs(firstJob, secondJob, sortState)
  )

  function handleSort(sortKey: string) {
    setSortState((currentSort) => ({
      key: sortKey,
      direction:
        currentSort.key === sortKey && currentSort.direction === "asc"
          ? "desc"
          : "asc",
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Loading agents...
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        No agents found
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableTableHead label="Label" sortKey="label" sortState={sortState} onSort={handleSort} />
          <SortableTableHead label="Source" sortKey="source" sortState={sortState} onSort={handleSort} className="w-24" />
          <SortableTableHead label="Status" sortKey="status" sortState={sortState} onSort={handleSort} className="w-24" />
          <SortableTableHead label="PID" sortKey="pid" sortState={sortState} onSort={handleSort} className="w-16" />
          <SortableTableHead label="Last Run" sortKey="last_run_at" sortState={sortState} onSort={handleSort} className="w-24" />
          <TableHead className="w-28">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedJobs.map((job) => (
          <JobRow
            key={job.plist_path}
            job={job}
            onStart={onStart}
            onStop={onStop}
            onRestart={onRestart}
            onKickstart={onKickstart}
            onDelete={onDelete}
            onSelect={onSelect}
            onRevealInFinder={onRevealInFinder}
          />
        ))}
      </TableBody>
    </Table>
  )
}
