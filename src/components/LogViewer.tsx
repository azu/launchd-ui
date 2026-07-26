import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useLogs } from "@/hooks/useLogs"
import { clearLogFile, openLogInEditor } from "@/lib/invoke"
import { ArrowDownToLine, ExternalLink, RefreshCw, Trash2 } from "lucide-react"

type LogViewerProps = {
  logPath: string | null
  tailLines?: number
}

const PAGE_SIZE = 200

function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0")
  const m = String(date.getMinutes()).padStart(2, "0")
  const s = String(date.getSeconds()).padStart(2, "0")
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${month}/${day} ${h}:${m}:${s}`
}

export function LogViewer({ logPath, tailLines = PAGE_SIZE }: LogViewerProps) {
  const {
    contentHtml,
    modifiedAt,
    loading,
    error,
    tailing,
    fetchLog,
    startTailing,
    stopTailing,
  } = useLogs()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [visibleLines, setVisibleLines] = useState(tailLines)
  const loadingMoreRef = useRef(false)

  useEffect(() => {
    if (logPath) {
      setVisibleLines(tailLines)
      startTailing(logPath, tailLines)
    }
    return () => stopTailing()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logPath])

  useEffect(() => {
    if (tailing && scrollRef.current) {
      const viewport = scrollRef.current.querySelector(
        '[data-slot="scroll-area-viewport"]'
      )
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight
      }
    }
  }, [contentHtml, tailing])

  const getViewport = useCallback(() => {
    return scrollRef.current?.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as Element | null
  }, [])

  useEffect(() => {
    const viewport = getViewport()
    if (!viewport || !logPath) return

    const handleScroll = () => {
      const atBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 32

      if (atBottom && !tailing) {
        startTailing(logPath, visibleLines)
        return
      }

      if (!atBottom && tailing) {
        stopTailing()
      }

      if (viewport.scrollTop < 16 && !loadingMoreRef.current && !loading) {
        loadingMoreRef.current = true
        const prevHeight = viewport.scrollHeight
        const newLines = visibleLines + PAGE_SIZE
        setVisibleLines(newLines)
        fetchLog(logPath, newLines).then(() => {
          requestAnimationFrame(() => {
            viewport.scrollTop = viewport.scrollHeight - prevHeight
            loadingMoreRef.current = false
          })
        })
      }
    }

    viewport.addEventListener("scroll", handleScroll)
    return () => viewport.removeEventListener("scroll", handleScroll)
  }, [tailing, logPath, visibleLines, loading, getViewport, startTailing, stopTailing, fetchLog])

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
            onClick={() =>
              tailing ? stopTailing() : startTailing(logPath, visibleLines)
            }
          >
            <ArrowDownToLine className={`h-3 w-3 mr-1 ${tailing ? "text-green-500" : ""}`} />
            {tailing ? "Unfollow" : "Follow"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchLog(logPath, visibleLines)}
            disabled={loading}
          >
            <RefreshCw
              className={`h-3 w-3 mr-1 ${loading && !tailing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await clearLogFile(logPath)
              setVisibleLines(tailLines)
              fetchLog(logPath, tailLines)
            }}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Clear
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
        <ScrollArea ref={scrollRef} className="h-64 rounded-md border bg-muted/30">
          <pre
            className="ansi-log p-3 text-xs font-mono whitespace-pre-wrap break-all"
            dangerouslySetInnerHTML={{
              __html: contentHtml || "(empty)",
            }}
          />
        </ScrollArea>
      )}
    </div>
  )
}
