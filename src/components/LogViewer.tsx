import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useLogs } from "@/hooks/useLogs"
import { openLogInEditor } from "@/lib/invoke"
import { ExternalLink, RefreshCw } from "lucide-react"

type LogViewerProps = {
  logPath: string | null
  tailLines?: number
}

function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0")
  const m = String(date.getMinutes()).padStart(2, "0")
  const s = String(date.getSeconds()).padStart(2, "0")
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${month}/${day} ${h}:${m}:${s}`
}

export function LogViewer({ logPath, tailLines = 200 }: LogViewerProps) {
  const { content, modifiedAt, loading, error, fetchLog } = useLogs()

  useEffect(() => {
    if (logPath) {
      fetchLog(logPath, tailLines)
    }
  }, [logPath, tailLines, fetchLog])

  if (!logPath) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        No log path configured
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-muted-foreground font-mono truncate">
            {logPath}
          </span>
          {modifiedAt && (
            <span className="text-xs text-muted-foreground shrink-0">
              ({formatTime(modifiedAt)})
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchLog(logPath, tailLines)}
            disabled={loading}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openLogInEditor(logPath)}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Open in Editor
          </Button>
        </div>
      </div>
      {error ? (
        <div className="text-sm text-destructive">{error}</div>
      ) : (
        <ScrollArea className="h-64 rounded-md border bg-muted/30">
          <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all">
            {content || "(empty)"}
          </pre>
        </ScrollArea>
      )}
    </div>
  )
}
