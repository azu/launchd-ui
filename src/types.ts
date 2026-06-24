export type JobSource = "UserAgent" | "SystemAgent" | "SystemDaemon"
export type JobStatus = "Running" | "Loaded" | "Unloaded" | "Unknown"

export type JobListEntry = {
  label: string
  pid: number | null
  last_exit_code: number | null
  plist_path: string
  source: JobSource
  status: JobStatus
  last_run_at: string | null
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
  wake_system: boolean | null
  root_directory: string | null
  umask: string | null
  throttle_interval: number | null
  start_on_mount: boolean | null
  watch_paths: string[] | null
  queue_directories: string[] | null
  process_type: ProcessType | null
  nice: number | null
  abandon_process_group: boolean | null
  soft_resource_limits: ResourceLimits | null
  hard_resource_limits: ResourceLimits | null
  raw_xml: string
}

export type ProcessType = "Background" | "Standard" | "Adaptive" | "Interactive"

export type ResourceLimits = {
  core: number | null
  cpu: number | null
  data: number | null
  file_size: number | null
  memory_lock: number | null
  number_of_files: number | null
  number_of_processes: number | null
  resident_set_size: number | null
  stack: number | null
}

export type LaunchdJob = {
  label: string
  plist_path: string
  source: JobSource
  status: JobStatus
  pid: number | null
  last_exit_code: number | null
  plist: PlistConfig
  last_run_at: string | null
}
