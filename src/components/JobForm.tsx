import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChevronDown, ChevronRight } from "lucide-react"
import type {
  CalendarInterval,
  LaunchdJob,
  PlistConfig,
  ProcessType,
  ResourceLimits,
} from "@/types"
import { getHomeDir, validateRawPlist } from "@/lib/invoke"
import {
  detectHourRange,
  expandHourRange,
  getNextOccurrences,
  getNextOccurrencesMulti,
  formatDateTime,
} from "@/lib/calendar-utils"

type JobFormProps = {
  open: boolean
  onClose: () => void
  onSave: (config: PlistConfig, plistPath?: string) => Promise<void>
  onSaveRaw?: (plistPath: string, xml: string) => Promise<void>
  editingJob?: LaunchdJob | null
}

function parseArguments(input: string): string[] {
  const result: string[] = []
  let current = ""
  let inDouble = false
  let inSingle = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble
    } else if (ch === "'" && !inDouble) {
      inSingle = !inSingle
    } else if (ch === " " && !inDouble && !inSingle) {
      if (current.length > 0) {
        result.push(current)
        current = ""
      }
    } else {
      current += ch
    }
  }
  if (current.length > 0) {
    result.push(current)
  }
  return result
}

function formatArguments(args: string[]): string {
  return args
    .map((arg) => (arg.includes(" ") ? `"${arg}"` : arg))
    .join(" ")
}

function emptyResourceLimits(): ResourceLimits {
  return {
    core: null,
    cpu: null,
    data: null,
    file_size: null,
    memory_lock: null,
    number_of_files: null,
    number_of_processes: null,
    resident_set_size: null,
    stack: null,
  }
}

function emptyConfig(): PlistConfig {
  return {
    label: "",
    program: null,
    program_arguments: null,
    run_at_load: false,
    keep_alive: false,
    start_interval: null,
    start_calendar_interval: null,
    standard_out_path: null,
    standard_error_path: null,
    working_directory: null,
    environment_variables: null,
    disabled: false,
    wake_system: false,
    root_directory: null,
    umask: null,
    throttle_interval: null,
    start_on_mount: false,
    watch_paths: null,
    queue_directories: null,
    process_type: null,
    nice: null,
    abandon_process_group: false,
    soft_resource_limits: null,
    hard_resource_limits: null,
    raw_xml: "",
  }
}

function parseLines(input: string): string[] | null {
  const lines = input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
  return lines.length > 0 ? lines : null
}

function formatLines(values: string[] | null | undefined): string {
  return values?.join("\n") ?? ""
}

function parseEnvironmentVariables(input: string): Record<string, string> | null {
  const entries: [string, string][] = []
  for (const line of input.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const index = trimmed.indexOf("=")
    if (index <= 0) continue
    entries.push([trimmed.slice(0, index).trim(), trimmed.slice(index + 1)])
  }
  return entries.length > 0 ? Object.fromEntries(entries) : null
}

function formatEnvironmentVariables(values: Record<string, string> | null | undefined): string {
  return Object.entries(values ?? {})
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")
}

function normalizeResourceLimits(limits: ResourceLimits | null): ResourceLimits | null {
  if (!limits) return null
  return Object.values(limits).some((value) => value !== null) ? limits : null
}

function setLimitValue(
  limits: ResourceLimits | null,
  key: keyof ResourceLimits,
  value: string,
): ResourceLimits | null {
  const next = { ...(limits ?? emptyResourceLimits()), [key]: value ? Number(value) : null }
  return normalizeResourceLimits(next)
}

type ScheduleType = "none" | "interval" | "calendar"

type HourMode = "specific" | "every" | "range"

function detectScheduleType(config: PlistConfig): ScheduleType {
  if (config.start_interval) return "interval"
  if (config.start_calendar_interval && config.start_calendar_interval.length > 0) return "calendar"
  return "none"
}

function detectHourMode(config: PlistConfig): HourMode {
  if (config.start_calendar_interval && config.start_calendar_interval.length > 0) {
    const range = detectHourRange(config.start_calendar_interval)
    if (range) return "range"
    const first = config.start_calendar_interval[0]
    if (first.hour === null || first.hour === undefined) return "every"
  }
  return "specific"
}

const weekdayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

export function JobForm({ open, onClose, onSave, onSaveRaw, editingJob }: JobFormProps) {
  const [config, setConfig] = useState<PlistConfig>(
    editingJob?.plist ?? emptyConfig()
  )
  const [args, setArgs] = useState(
    editingJob?.plist.program_arguments
      ? formatArguments(editingJob.plist.program_arguments)
      : ""
  )
  const [environmentText, setEnvironmentText] = useState(
    formatEnvironmentVariables(editingJob?.plist.environment_variables)
  )
  const [watchPathsText, setWatchPathsText] = useState(
    formatLines(editingJob?.plist.watch_paths)
  )
  const [queueDirectoriesText, setQueueDirectoriesText] = useState(
    formatLines(editingJob?.plist.queue_directories)
  )
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [rawXml, setRawXml] = useState(editingJob?.plist.raw_xml ?? "")
  const [rawStatus, setRawStatus] = useState<string | null>(null)
  const initPlist = editingJob?.plist ?? emptyConfig()
  const [scheduleType, setScheduleType] = useState<ScheduleType>(
    detectScheduleType(initPlist)
  )
  const existingRange = editingJob?.plist.start_calendar_interval
    ? detectHourRange(editingJob.plist.start_calendar_interval)
    : null
  const [calendarInterval, setCalendarInterval] = useState<CalendarInterval>(
    existingRange
      ? existingRange.base
      : editingJob?.plist.start_calendar_interval?.[0] ?? {
          minute: 0,
          hour: 9,
          day: null,
          weekday: null,
          month: null,
        }
  )
  const [hourMode, setHourMode] = useState<HourMode>(detectHourMode(initPlist))
  const [hourRange, setHourRange] = useState<{ from: number; to: number }>(
    existingRange ? { from: existingRange.from, to: existingRange.to } : { from: 7, to: 23 }
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [homeDir, setHomeDir] = useState<string | null>(null)

  const isEditing = !!editingJob

  useEffect(() => {
    if (!isEditing) {
      getHomeDir().then(setHomeDir).catch(() => {})
    }
  }, [isEditing])

  const handleSave = async () => {
    setError(null)
    if (!config.label.trim()) {
      setError("Label is required")
      return
    }
    if (scheduleType === "calendar" && hourMode === "range" && hourRange.from > hourRange.to) {
      setError("Hour range 'from' must be less than or equal to 'to'")
      return
    }

    const parsedArgs = args.trim() ? parseArguments(args.trim()) : null
    const finalConfig: PlistConfig = {
      ...config,
      program_arguments: parsedArgs,
      program: parsedArgs ? parsedArgs[0] : config.program,
      start_interval: scheduleType === "interval" ? (config.start_interval || null) : null,
      start_calendar_interval: scheduleType === "calendar"
        ? hourMode === "range"
          ? expandHourRange(calendarInterval, hourRange.from, hourRange.to)
          : [calendarInterval]
        : null,
      wake_system: scheduleType === "calendar" ? (config.wake_system || null) : null,
      standard_out_path: config.standard_out_path?.trim() || null,
      standard_error_path: config.standard_error_path?.trim() || null,
      working_directory: config.working_directory?.trim() || null,
      environment_variables: parseEnvironmentVariables(environmentText),
      root_directory: config.root_directory?.trim() || null,
      umask: config.umask?.trim() || null,
      throttle_interval: config.throttle_interval || null,
      start_on_mount: config.start_on_mount || null,
      watch_paths: parseLines(watchPathsText),
      queue_directories: parseLines(queueDirectoriesText),
      process_type: config.process_type,
      nice: config.nice,
      abandon_process_group: config.abandon_process_group || null,
      soft_resource_limits: normalizeResourceLimits(config.soft_resource_limits),
      hard_resource_limits: normalizeResourceLimits(config.hard_resource_limits),
    }

    setSaving(true)
    try {
      await onSave(finalConfig, editingJob?.plist_path)
      onClose()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleValidateRaw = async () => {
    setError(null)
    setRawStatus(null)
    try {
      await validateRawPlist(rawXml)
      setRawStatus("Raw plist is valid.")
    } catch (e) {
      setError(String(e))
    }
  }

  const handleSaveRaw = async () => {
    if (!editingJob || !onSaveRaw) return

    setError(null)
    setRawStatus(null)
    setSaving(true)
    try {
      await validateRawPlist(rawXml)
      await onSaveRaw(editingJob.plist_path, rawXml)
      onClose()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Agent" : "New Agent"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-1.5">
            <Label htmlFor="label">
              Label <span className="text-destructive">*</span>
            </Label>
            <Input
              id="label"
              placeholder="com.example.my-agent"
              value={config.label}
              onChange={(e) => {
                const label = e.target.value.replace(/\s/g, "")
                const updates: Partial<PlistConfig> = { label }
                if (!isEditing && homeDir && label.trim()) {
                  const logDir = `${homeDir}/Library/Logs/launchd-ui`
                  updates.standard_out_path = `${logDir}/${label}.stdout.log`
                  updates.standard_error_path = `${logDir}/${label}.stderr.log`
                }
                setConfig({ ...config, ...updates })
              }}
              disabled={isEditing}
              spellCheck={false}
              autoCorrect="off"
            />
            <p className="text-xs text-muted-foreground">
              Unique identifier for this agent. Use reverse domain notation (e.g. com.yourname.task).
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="args">
              Program Arguments <span className="text-destructive">*</span>
            </Label>
            <Input
              id="args"
              placeholder="/usr/bin/my-program --flag value"
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              spellCheck={false}
              autoCorrect="off"
            />
            <p className="text-xs text-muted-foreground">
              The command to execute, followed by its arguments. Space-separated. Use quotes for arguments containing spaces (e.g. /usr/bin/cmd "arg with spaces").
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="run-at-load">Run at Load</Label>
              <Select
                value={config.run_at_load ? "true" : "false"}
                onValueChange={(v) =>
                  setConfig({ ...config, run_at_load: v === "true" })
                }
              >
                <SelectTrigger id="run-at-load">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Start automatically when loaded by launchd.
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="keep-alive">Keep Alive</Label>
              <Select
                value={config.keep_alive ? "true" : "false"}
                onValueChange={(v) =>
                  setConfig({ ...config, keep_alive: v === "true" })
                }
              >
                <SelectTrigger id="keep-alive">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Restart automatically if the process exits.
              </p>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>
              Schedule <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Select
              value={scheduleType}
              onValueChange={(v) => setScheduleType(v as ScheduleType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No schedule</SelectItem>
                <SelectItem value="interval">Run every N seconds</SelectItem>
                <SelectItem value="calendar">Run at specific time</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              How to trigger this agent. "No schedule" means manual start only.
            </p>
          </div>

          {scheduleType === "interval" && (
            <div className="grid gap-1.5">
              <Label htmlFor="interval">Interval (seconds)</Label>
              <Input
                id="interval"
                type="number"
                placeholder="300"
                value={config.start_interval ?? ""}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    start_interval: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                e.g. 300 = every 5 minutes, 3600 = every hour.
              </p>
              {config.start_interval && config.start_interval > 0 && (
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">
                    Next runs
                  </p>
                  <ul className="space-y-0.5">
                    {[1, 2, 3].map((n) => {
                      const d = new Date(Date.now() + config.start_interval! * 1000 * n)
                      return (
                        <li key={n} className="text-sm font-mono">
                          {formatDateTime(d)}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}

          {scheduleType === "calendar" && (
            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <Label>Hour</Label>
                <Select
                  value={hourMode}
                  onValueChange={(v) => {
                    const mode = v as HourMode
                    setHourMode(mode)
                    if (mode === "specific" && (calendarInterval.hour === null || calendarInterval.hour === undefined)) {
                      setCalendarInterval({ ...calendarInterval, hour: 9 })
                    }
                    if (mode === "every") {
                      setCalendarInterval({ ...calendarInterval, hour: null })
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="specific">Specific hour</SelectItem>
                    <SelectItem value="every">Every hour</SelectItem>
                    <SelectItem value="range">Hour range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {hourMode === "specific" && (
                <div className="grid gap-1.5">
                  <Input
                    id="cal-hour"
                    type="number"
                    min={0}
                    max={23}
                    placeholder="9"
                    value={calendarInterval.hour ?? ""}
                    onChange={(e) =>
                      setCalendarInterval({
                        ...calendarInterval,
                        hour: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </div>
              )}
              {hourMode === "range" && (
                <div className="grid gap-1.5">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      placeholder="7"
                      value={hourRange.from}
                      onChange={(e) =>
                        setHourRange({ ...hourRange, from: Number(e.target.value) })
                      }
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">to</span>
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      placeholder="23"
                      value={hourRange.to}
                      onChange={(e) =>
                        setHourRange({ ...hourRange, to: Number(e.target.value) })
                      }
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Runs every hour within this range (e.g. 7 to 23 = runs at 7:00, 8:00, ... 23:00).
                  </p>
                </div>
              )}
              <div className="grid gap-1.5">
                <Label htmlFor="cal-minute">Minute</Label>
                <Input
                  id="cal-minute"
                  type="number"
                  min={0}
                  max={59}
                  placeholder="0"
                  value={calendarInterval.minute ?? ""}
                  onChange={(e) =>
                    setCalendarInterval({
                      ...calendarInterval,
                      minute: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cal-weekday">
                  Weekday <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Select
                  value={calendarInterval.weekday !== null && calendarInterval.weekday !== undefined ? String(calendarInterval.weekday) : "any"}
                  onValueChange={(v) =>
                    setCalendarInterval({
                      ...calendarInterval,
                      weekday: v === "any" ? null : Number(v),
                    })
                  }
                >
                  <SelectTrigger id="cal-weekday">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Every day</SelectItem>
                    {weekdayLabels.map((label, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cal-day">
                  Day of month <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="cal-day"
                  type="number"
                  min={1}
                  max={31}
                  placeholder="Leave empty for every day"
                  value={calendarInterval.day ?? ""}
                  onChange={(e) =>
                    setCalendarInterval({
                      ...calendarInterval,
                      day: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="wake-system">Wake System</Label>
                <Select
                  value={config.wake_system ? "true" : "false"}
                  onValueChange={(v) =>
                    setConfig({ ...config, wake_system: v === "true" })
                  }
                >
                  <SelectTrigger id="wake-system">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Wake the system from sleep to run this agent at the scheduled time.
                </p>
              </div>
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">
                  Next runs ({Intl.DateTimeFormat().resolvedOptions().timeZone})
                </p>
                {(() => {
                  const intervals = hourMode === "range"
                    ? expandHourRange(calendarInterval, hourRange.from, hourRange.to)
                    : [calendarInterval]
                  if (intervals.length === 0) {
                    return <p className="text-xs text-destructive">Invalid hour range</p>
                  }
                  const occurrences = intervals.length > 1
                    ? getNextOccurrencesMulti(intervals, 3)
                    : getNextOccurrences(intervals[0], 3)
                  if (occurrences.length === 0) {
                    return <p className="text-xs text-muted-foreground">No upcoming runs found</p>
                  }
                  return (
                    <ul className="space-y-0.5">
                      {occurrences.map((d, i) => (
                        <li key={i} className="text-sm font-mono">
                          {formatDateTime(d)}
                        </li>
                      ))}
                    </ul>
                  )
                })()}
              </div>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="working-dir">
              Working Directory <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="working-dir"
              placeholder="/path/to/working/directory"
              value={config.working_directory ?? ""}
              onChange={(e) =>
                setConfig({ ...config, working_directory: e.target.value })
              }
              spellCheck={false}
              autoCorrect="off"
            />
            <p className="text-xs text-muted-foreground">
              Directory to use as the current working directory when running the command.
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="stdout">
              Standard Output Path <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="stdout"
              placeholder="/tmp/my-agent.stdout.log"
              value={config.standard_out_path ?? ""}
              onChange={(e) =>
                setConfig({ ...config, standard_out_path: e.target.value })
              }
              spellCheck={false}
              autoCorrect="off"
            />
            <p className="text-xs text-muted-foreground">
              File path to write the command's standard output. Useful for checking execution results.
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="stderr">
              Standard Error Path <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="stderr"
              placeholder="/tmp/my-agent.stderr.log"
              value={config.standard_error_path ?? ""}
              onChange={(e) =>
                setConfig({ ...config, standard_error_path: e.target.value })
              }
              spellCheck={false}
              autoCorrect="off"
            />
            <p className="text-xs text-muted-foreground">
              File path to write the command's error output. Useful for debugging failures.
            </p>
          </div>

          <div className="rounded-lg border">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              onClick={() => setAdvancedOpen((value) => !value)}
            >
              <div>
                <h3 className="text-sm font-medium">Advanced configuration</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Optional launchd keys and raw plist editing for unsupported fields.
                </p>
              </div>
              {advancedOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {advancedOpen && (
            <div className="grid gap-4 border-t p-4">
              <div className="grid gap-1.5">
                <Label htmlFor="environment">
                  Environment Variables <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                </Label>
                <textarea
                  id="environment"
                  className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm font-mono outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  placeholder={"PATH=/usr/local/bin:/usr/bin:/bin\nNODE_ENV=production"}
                  value={environmentText}
                  onChange={(e) => setEnvironmentText(e.target.value)}
                  spellCheck={false}
                  autoCorrect="off"
                />
                <p className="text-xs text-muted-foreground">
                  One KEY=value pair per line. Values are written as strings.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="root-dir">
                    Root Directory <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="root-dir"
                    placeholder="/path/to/chroot"
                    value={config.root_directory ?? ""}
                    onChange={(e) =>
                      setConfig({ ...config, root_directory: e.target.value })
                    }
                    spellCheck={false}
                    autoCorrect="off"
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="umask">
                    Umask <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="umask"
                    placeholder="022"
                    value={config.umask ?? ""}
                    onChange={(e) => setConfig({ ...config, umask: e.target.value })}
                    spellCheck={false}
                    autoCorrect="off"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="throttle">
                    Throttle Interval <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="throttle"
                    type="number"
                    min={0}
                    placeholder="10"
                    value={config.throttle_interval ?? ""}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        throttle_interval: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum seconds between launches after repeated exits.
                  </p>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="nice">
                    Nice <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="nice"
                    type="number"
                    min={-20}
                    max={20}
                    placeholder="0"
                    value={config.nice ?? ""}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        nice: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="process-type">
                    Process Type <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Select
                    value={config.process_type ?? "default"}
                    onValueChange={(v) =>
                      setConfig({
                        ...config,
                        process_type: v === "default" ? null : (v as ProcessType),
                      })
                    }
                  >
                    <SelectTrigger id="process-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default</SelectItem>
                      <SelectItem value="Background">Background</SelectItem>
                      <SelectItem value="Standard">Standard</SelectItem>
                      <SelectItem value="Adaptive">Adaptive</SelectItem>
                      <SelectItem value="Interactive">Interactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="start-on-mount">Start On Mount</Label>
                  <Select
                    value={config.start_on_mount ? "true" : "false"}
                    onValueChange={(v) =>
                      setConfig({ ...config, start_on_mount: v === "true" })
                    }
                  >
                    <SelectTrigger id="start-on-mount">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="abandon-process-group">Abandon Process Group</Label>
                <Select
                  value={config.abandon_process_group ? "true" : "false"}
                  onValueChange={(v) =>
                    setConfig({ ...config, abandon_process_group: v === "true" })
                  }
                >
                  <SelectTrigger id="abandon-process-group">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  If enabled, launchd will not kill remaining child processes when the job exits.
                </p>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="watch-paths">
                  Watch Paths <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                </Label>
                <textarea
                  id="watch-paths"
                  className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm font-mono outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  placeholder={"/path/to/file\n/path/to/directory"}
                  value={watchPathsText}
                  onChange={(e) => setWatchPathsText(e.target.value)}
                  spellCheck={false}
                  autoCorrect="off"
                />
                <p className="text-xs text-muted-foreground">
                  One path per line. Starts the job when any listed path changes.
                </p>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="queue-directories">
                  Queue Directories <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                </Label>
                <textarea
                  id="queue-directories"
                  className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm font-mono outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  placeholder={"/path/to/queue"}
                  value={queueDirectoriesText}
                  onChange={(e) => setQueueDirectoriesText(e.target.value)}
                  spellCheck={false}
                  autoCorrect="off"
                />
                <p className="text-xs text-muted-foreground">
                  One directory per line. Keeps the job alive while listed directories are not empty.
                </p>
              </div>

              <div className="grid gap-3 rounded-md border bg-muted/20 p-3">
                <div>
                  <h4 className="text-sm font-medium">Resource Limits</h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Optional setrlimit values. Commonly used for file descriptors and process limits.
                  </p>
                </div>

                <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 text-xs font-medium text-muted-foreground">
                  <span>Limit</span>
                  <span>Soft</span>
                  <span>Hard</span>
                </div>

                {[
                  ["Core bytes", "core"],
                  ["Number of Files", "number_of_files"],
                  ["Number of Processes", "number_of_processes"],
                  ["CPU seconds", "cpu"],
                  ["Data bytes", "data"],
                  ["File Size bytes", "file_size"],
                  ["Memory Lock bytes", "memory_lock"],
                  ["Resident Set bytes", "resident_set_size"],
                  ["Stack bytes", "stack"],
                ].map(([label, key]) => (
                  <div key={key} className="grid grid-cols-[1fr_1fr_1fr] items-center gap-2">
                    <Label className="text-xs">{label}</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder={key === "number_of_files" ? "65536" : ""}
                      value={config.soft_resource_limits?.[key as keyof ResourceLimits] ?? ""}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          soft_resource_limits: setLimitValue(
                            config.soft_resource_limits,
                            key as keyof ResourceLimits,
                            e.target.value,
                          ),
                        })
                      }
                    />
                    <Input
                      type="number"
                      min={0}
                      placeholder={key === "number_of_files" ? "65536" : ""}
                      value={config.hard_resource_limits?.[key as keyof ResourceLimits] ?? ""}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          hard_resource_limits: setLimitValue(
                            config.hard_resource_limits,
                            key as keyof ResourceLimits,
                            e.target.value,
                          ),
                        })
                      }
                    />
                  </div>
                ))}
              </div>

              {isEditing && (
                <div className="grid gap-3 rounded-md border bg-muted/20 p-3">
                  <div>
                    <h4 className="text-sm font-medium">Raw plist XML</h4>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Use this for unsupported or complex keys. Validation uses plutil before saving.
                    </p>
                  </div>
                  <textarea
                    className="min-h-64 rounded-md border bg-background px-3 py-2 text-xs font-mono outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    value={rawXml}
                    onChange={(e) => {
                      setRawStatus(null)
                      setRawXml(e.target.value)
                    }}
                    spellCheck={false}
                    autoCorrect="off"
                  />
                  {rawStatus && (
                    <div className="text-xs text-muted-foreground">{rawStatus}</div>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleValidateRaw()}
                    >
                      Validate XML
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleSaveRaw()}
                      disabled={saving || !onSaveRaw}
                    >
                      Save Raw XML
                    </Button>
                  </div>
                </div>
              )}
            </div>
            )}
          </div>

          {error && <div className="text-sm text-destructive">{error}</div>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : isEditing ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
