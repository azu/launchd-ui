import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { TableHead } from "@/components/ui/table"
import type { SortState } from "@/components/ui/sort-types"

type SortableTableHeadProps = {
  label: string
  sortKey: string
  sortState: SortState
  onSort: (sortKey: string) => void
  className?: string
}

function SortIcon({
  sortState,
  sortKey,
}: {
  sortState: SortState
  sortKey: string
}) {
  if (sortState.key !== sortKey) {
    return <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
  }

  return sortState.direction === "asc" ? (
    <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
  ) : (
    <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
  )
}

export function SortableTableHead({
  label,
  sortKey,
  sortState,
  onSort,
  className,
}: SortableTableHeadProps) {
  const isActive = sortState.key === sortKey
  const direction = isActive
    ? sortState.direction === "asc"
      ? "ascending"
      : "descending"
    : "none"

  return (
    <TableHead className={className} aria-sort={direction}>
      <button
        type="button"
        className="inline-flex h-8 items-center gap-1 rounded px-1 text-left hover:bg-muted"
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${label}`}
      >
        {label}
        <SortIcon sortState={sortState} sortKey={sortKey} />
      </button>
    </TableHead>
  )
}