import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { SourceFilter } from "@/types"
import { Search } from "lucide-react"

type SearchBarProps = {
  search: string
  onSearchChange: (value: string) => void
  sourceFilter: SourceFilter
  onSourceFilterChange: (value: SourceFilter) => void
}

const sourceOptions: Array<{ value: SourceFilter; label: string }> = [
  { value: "All", label: "All" },
  { value: "UserAgent", label: "User" },
  { value: "Home", label: "Home" },
  { value: "SystemAgent", label: "System" },
  { value: "SystemDaemon", label: "Daemon" },
]

export function SearchBar({
  search,
  onSearchChange,
  sourceFilter,
  onSourceFilterChange,
}: SearchBarProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search agents..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="flex items-center gap-1">
        {sourceOptions.map((option) => (
          <Button
            key={option.value}
            variant={sourceFilter === option.value ? "default" : "outline"}
            size="sm"
            onClick={() => onSourceFilterChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
