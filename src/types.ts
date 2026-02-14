export type JobSource = "UserAgent" | "SystemAgent" | "SystemDaemon"
export type JobStatus = "Running" | "Stopped" | "Unknown"

export type JobListEntry = {
  label: string
  pid: number | null
  last_exit_code: number | null
  plist_path: string
  source: JobSource
  status: JobStatus
}

export type CalendarInterval = {
  minute: number | null
  hour: number | null
  day: number | null
  weekday: number | null
  month: number | null
}

export type PlistConfig = {
  label: string
  program: string | null
  program_arguments: string[] | null
  run_at_load: boolean | null
  keep_alive: boolean | null
  start_interval: number | null
  start_calendar_interval: CalendarInterval[] | null
  standard_out_path: string | null
  standard_error_path: string | null
  working_directory: string | null
  environment_variables: Record<string, string> | null
  disabled: boolean | null
  raw_xml: string
}

export type LaunchdJob = {
  label: string
  plist_path: string
  source: JobSource
  status: JobStatus
  pid: number | null
  last_exit_code: number | null
  plist: PlistConfig
}
