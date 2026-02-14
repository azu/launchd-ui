import { useState } from "react"
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
import type { PlistConfig, LaunchdJob, CalendarInterval } from "@/types"

type JobFormProps = {
  open: boolean
  onClose: () => void
  onSave: (config: PlistConfig, plistPath?: string) => Promise<void>
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
    raw_xml: "",
  }
}

type ScheduleType = "none" | "interval" | "calendar"

function detectScheduleType(config: PlistConfig): ScheduleType {
  if (config.start_interval) return "interval"
  if (config.start_calendar_interval && config.start_calendar_interval.length > 0) return "calendar"
  return "none"
}

const weekdayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

function getNextOccurrences(ci: CalendarInterval, count: number): Date[] {
  const results: Date[] = []
  const now = new Date()
  const candidate = new Date(now)
  candidate.setSeconds(0, 0)

  // Start from current minute + 1 to find future times
  candidate.setMinutes(candidate.getMinutes() + 1)

  // Search up to 400 days ahead to handle monthly schedules
  const limit = 400 * 24 * 60
  for (let i = 0; i < limit && results.length < count; i++) {
    const matches =
      (ci.month === null || ci.month === undefined || candidate.getMonth() + 1 === ci.month) &&
      (ci.day === null || ci.day === undefined || candidate.getDate() === ci.day) &&
      (ci.weekday === null || ci.weekday === undefined || candidate.getDay() === ci.weekday) &&
      (ci.hour === null || ci.hour === undefined || candidate.getHours() === ci.hour) &&
      (ci.minute === null || ci.minute === undefined || candidate.getMinutes() === ci.minute)

    if (matches) {
      results.push(new Date(candidate))
    }
    candidate.setMinutes(candidate.getMinutes() + 1)
  }
  return results
}

function formatDateTime(date: Date): string {
  const weekday = weekdayLabels[date.getDay()]
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = String(date.getHours()).padStart(2, "0")
  const minute = String(date.getMinutes()).padStart(2, "0")
  return `${month}/${day} (${weekday}) ${hour}:${minute}`
}

export function JobForm({ open, onClose, onSave, editingJob }: JobFormProps) {
  const [config, setConfig] = useState<PlistConfig>(
    editingJob?.plist ?? emptyConfig()
  )
  const [args, setArgs] = useState(
    editingJob?.plist.program_arguments?.join(" ") ?? ""
  )
  const [scheduleType, setScheduleType] = useState<ScheduleType>(
    detectScheduleType(editingJob?.plist ?? emptyConfig())
  )
  const [calendarInterval, setCalendarInterval] = useState<CalendarInterval>(
    editingJob?.plist.start_calendar_interval?.[0] ?? {
      minute: 0,
      hour: 9,
      day: null,
      weekday: null,
      month: null,
    }
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = !!editingJob

  const handleSave = async () => {
    setError(null)
    if (!config.label.trim()) {
      setError("Label is required")
      return
    }

    const parsedArgs = args.trim() ? parseArguments(args.trim()) : null
    const finalConfig: PlistConfig = {
      ...config,
      program_arguments: parsedArgs,
      program: parsedArgs ? parsedArgs[0] : config.program,
      start_interval: scheduleType === "interval" ? (config.start_interval || null) : null,
      start_calendar_interval: scheduleType === "calendar" ? [calendarInterval] : null,
      standard_out_path: config.standard_out_path?.trim() || null,
      standard_error_path: config.standard_error_path?.trim() || null,
      working_directory: config.working_directory?.trim() || null,
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
              onChange={(e) => setConfig({ ...config, label: e.target.value })}
              disabled={isEditing}
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
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="cal-hour">Hour</Label>
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
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">
                  Next runs ({Intl.DateTimeFormat().resolvedOptions().timeZone})
                </p>
                {(() => {
                  const occurrences = getNextOccurrences(calendarInterval, 3)
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
            />
            <p className="text-xs text-muted-foreground">
              File path to write the command's error output. Useful for debugging failures.
            </p>
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
