import { useEffect, useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LogViewer } from "@/components/LogViewer"
import type { LaunchdJob } from "@/types"
import { getJobDetail, revealInFinder } from "@/lib/invoke"
import type { CalendarInterval } from "@/types"
import { FolderOpen } from "lucide-react"

const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

function formatCalendarInterval(ci: CalendarInterval): string {
  const parts: string[] = []

  // When
  if (ci.weekday !== null && ci.weekday !== undefined) {
    parts.push(`Every ${weekdayNames[ci.weekday]}`)
  } else if (ci.day !== null && ci.day !== undefined) {
    parts.push(`Day ${ci.day} of each month`)
  } else if (ci.month !== null && ci.month !== undefined) {
    parts.push(`Month ${ci.month}`)
  } else {
    parts.push("Every day")
  }

  // Time
  const hour = ci.hour ?? 0
  const minute = ci.minute ?? 0
  parts.push(`at ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`)

  return parts.join(" ")
}

type JobDetailProps = {
  plistPath: string | null
  open: boolean
  onClose: () => void
  onEdit: (job: LaunchdJob) => void
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="col-span-2 text-sm font-mono break-all">{value}</dd>
    </div>
  )
}

export function JobDetail({ plistPath, open, onClose, onEdit }: JobDetailProps) {
  const [job, setJob] = useState<LaunchdJob | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!plistPath || !open) return
    setLoading(true)
    getJobDetail(plistPath)
      .then(setJob)
      .catch(() => setJob(null))
      .finally(() => setLoading(false))
  }, [plistPath, open])

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-[600px] sm:w-[640px] sm:max-w-[640px] overflow-y-auto p-0">
        <SheetHeader>
          <SheetTitle className="text-base font-semibold">
            {job?.label ?? "Loading..."}
          </SheetTitle>
        </SheetHeader>

        {loading && (
          <div className="px-4 py-8 text-center text-muted-foreground">Loading...</div>
        )}

        {job && !loading && (
          <div className="space-y-4 px-4 pb-4">
            <div className="flex items-center gap-2">
              <Badge
                variant={job.status === "Running" || job.status === "Loaded" ? "default" : "secondary"}
                className={
                  job.status === "Running" ? "bg-emerald-500" :
                  job.status === "Loaded" ? "bg-blue-500" : ""
                }
              >
                {job.status}
              </Badge>
              {job.pid && (
                <span className="text-xs text-muted-foreground">PID: {job.pid}</span>
              )}
              {job.last_exit_code !== null && job.last_exit_code !== undefined && (
                <span className="text-xs text-muted-foreground">
                  Exit: {job.last_exit_code}
                </span>
              )}
            </div>

            <div className="flex gap-2">
              {job.source === "UserAgent" && (
                <Button size="sm" variant="outline" onClick={() => onEdit(job)}>
                  Edit
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => revealInFinder(job.plist_path)}
              >
                <FolderOpen className="h-3 w-3 mr-1" />
                Reveal
              </Button>
            </div>

            <Separator />

            <Tabs defaultValue="config">
              <TabsList>
                <TabsTrigger value="config">Configuration</TabsTrigger>
                <TabsTrigger value="logs">Logs</TabsTrigger>
              </TabsList>

              <TabsContent value="config" className="space-y-1">
                <dl>
                  <DetailRow label="Label" value={job.plist.label} />
                  <DetailRow label="Program" value={job.plist.program} />
                  {job.plist.program_arguments && job.plist.program_arguments.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 py-1.5">
                      <dt className="text-sm text-muted-foreground">Arguments</dt>
                      <dd className="col-span-2 space-y-0.5">
                        {job.plist.program_arguments.map((arg, i) => (
                          <div key={i} className="text-sm font-mono break-all">
                            <span className="text-muted-foreground mr-1">[{i}]</span>
                            {arg}
                          </div>
                        ))}
                      </dd>
                    </div>
                  )}
                  {job.plist.run_at_load && (
                    <DetailRow label="Run at Load" value="true" />
                  )}
                  {job.plist.keep_alive && (
                    <DetailRow label="Keep Alive" value="true" />
                  )}
                  <DetailRow
                    label="Interval"
                    value={
                      job.plist.start_interval
                        ? `${job.plist.start_interval}s`
                        : undefined
                    }
                  />
                  <DetailRow
                    label="Working Dir"
                    value={job.plist.working_directory}
                  />
                  <DetailRow label="Stdout" value={job.plist.standard_out_path} />
                  <DetailRow label="Stderr" value={job.plist.standard_error_path} />
                  {job.plist.disabled && (
                    <DetailRow label="Disabled" value="true" />
                  )}
                </dl>
                {job.plist.environment_variables &&
                  Object.keys(job.plist.environment_variables).length > 0 && (
                    <>
                      <Separator />
                      <h4 className="text-sm font-medium pt-2">
                        Environment Variables
                      </h4>
                      <dl>
                        {Object.entries(job.plist.environment_variables).map(
                          ([key, value]) => (
                            <DetailRow key={key} label={key} value={value} />
                          )
                        )}
                      </dl>
                    </>
                  )}
                {job.plist.start_calendar_interval &&
                  job.plist.start_calendar_interval.length > 0 && (
                    <>
                      <Separator />
                      <h4 className="text-sm font-medium pt-2">Schedule</h4>
                      {job.plist.start_calendar_interval.map((interval, i) => (
                        <div key={i} className="text-sm py-0.5">
                          {formatCalendarInterval(interval)}
                        </div>
                      ))}
                    </>
                  )}
              </TabsContent>

              <TabsContent value="logs">
                <div className="space-y-4">
                  {job.plist.standard_out_path && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Standard Output</h4>
                      <LogViewer logPath={job.plist.standard_out_path} />
                    </div>
                  )}
                  {job.plist.standard_error_path && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Standard Error</h4>
                      <LogViewer logPath={job.plist.standard_error_path} />
                    </div>
                  )}
                  {!job.plist.standard_out_path &&
                    !job.plist.standard_error_path && (
                      <div className="text-sm text-muted-foreground py-4">
                        No log paths configured for this agent
                      </div>
                    )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
