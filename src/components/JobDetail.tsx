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
import { CommandPanel } from "@/components/CommandPanel"
import { LogViewer } from "@/components/LogViewer"
import type { LaunchdJob, ResourceLimits } from "@/types"
import { getJobDetail, revealInFinder } from "@/lib/invoke"
import { FolderOpen } from "lucide-react"
import { formatCalendarIntervals } from "@/lib/calendar-utils"

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

function formatList(values: string[] | null | undefined): string | undefined {
  return values && values.length > 0 ? values.join("\n") : undefined
}

function formatResourceLimits(limits: ResourceLimits | null | undefined): string | undefined {
  if (!limits) return undefined

  const labels: Record<keyof ResourceLimits, string> = {
    core: "Core",
    cpu: "CPU",
    data: "Data",
    file_size: "FileSize",
    memory_lock: "MemoryLock",
    number_of_files: "NumberOfFiles",
    number_of_processes: "NumberOfProcesses",
    resident_set_size: "ResidentSetSize",
    stack: "Stack",
  }

  const rows = Object.entries(limits)
    .filter(([, value]) => value !== null)
    .map(([key, value]) => `${labels[key as keyof ResourceLimits]}=${value}`)

  return rows.length > 0 ? rows.join("\n") : undefined
}

export function JobDetail({ plistPath, open, onClose, onEdit }: JobDetailProps) {
  const [job, setJob] = useState<LaunchdJob | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("config")

  useEffect(() => {
    if (!plistPath || !open) return
    setLoading(true)
    getJobDetail(plistPath)
      .then(setJob)
      .catch(() => setJob(null))
      .finally(() => setLoading(false))
  }, [plistPath, open])

  return (
    <Sheet
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setActiveTab("config")
          onClose()
        }
      }}
    >
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
              {job.last_run_at && (
                <span className="text-xs text-muted-foreground">
                  Last run: {new Date(Number(job.last_run_at)).toLocaleString()}
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

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="config">Configuration</TabsTrigger>
                <TabsTrigger value="logs">Logs</TabsTrigger>
                <TabsTrigger value="commands">Commands</TabsTrigger>
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
                  {job.plist.wake_system && (
                    <DetailRow label="Wake System" value="true" />
                  )}
                  {job.plist.disabled && (
                    <DetailRow label="Disabled" value="true" />
                  )}
                  <DetailRow label="Root Dir" value={job.plist.root_directory} />
                  <DetailRow label="Umask" value={job.plist.umask} />
                  <DetailRow
                    label="Throttle"
                    value={
                      job.plist.throttle_interval
                        ? `${job.plist.throttle_interval}s`
                        : undefined
                    }
                  />
                  {job.plist.start_on_mount && (
                    <DetailRow label="Start On Mount" value="true" />
                  )}
                  <DetailRow label="Process Type" value={job.plist.process_type} />
                  <DetailRow
                    label="Nice"
                    value={
                      job.plist.nice !== null && job.plist.nice !== undefined
                        ? String(job.plist.nice)
                        : undefined
                    }
                  />
                  {job.plist.abandon_process_group && (
                    <DetailRow label="Abandon Group" value="true" />
                  )}
                  <DetailRow label="Watch Paths" value={formatList(job.plist.watch_paths)} />
                  <DetailRow
                    label="Queue Dirs"
                    value={formatList(job.plist.queue_directories)}
                  />
                  <DetailRow
                    label="Soft Limits"
                    value={formatResourceLimits(job.plist.soft_resource_limits)}
                  />
                  <DetailRow
                    label="Hard Limits"
                    value={formatResourceLimits(job.plist.hard_resource_limits)}
                  />
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
                      <div className="text-sm py-0.5">
                        {formatCalendarIntervals(job.plist.start_calendar_interval)}
                      </div>
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

              <TabsContent value="commands">
                <CommandPanel job={job} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
