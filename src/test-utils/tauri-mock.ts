import type { JobListEntry, LaunchdJob, PlistConfig } from "@/types"

const defaultPlistConfig: PlistConfig = {
  label: "",
  program: null,
  program_arguments: null,
  run_at_load: null,
  keep_alive: null,
  start_interval: null,
  start_calendar_interval: null,
  standard_out_path: null,
  standard_error_path: null,
  working_directory: null,
  environment_variables: null,
  disabled: null,
  raw_xml: "",
}

const fakeJobs: JobListEntry[] = [
  {
    label: "com.example.running-agent",
    pid: 1234,
    last_exit_code: 0,
    plist_path: "/Users/test/Library/LaunchAgents/com.example.running-agent.plist",
    source: "UserAgent",
    status: "Running",
  },
  {
    label: "com.example.stopped-agent",
    pid: null,
    last_exit_code: 78,
    plist_path: "/Users/test/Library/LaunchAgents/com.example.stopped-agent.plist",
    source: "UserAgent",
    status: "Unloaded",
  },
  {
    label: "com.apple.system-agent",
    pid: 5678,
    last_exit_code: 0,
    plist_path: "/Library/LaunchAgents/com.apple.system-agent.plist",
    source: "SystemAgent",
    status: "Running",
  },
]

const fakeJobDetails: Record<string, LaunchdJob> = {
  "/Users/test/Library/LaunchAgents/com.example.running-agent.plist": {
    label: "com.example.running-agent",
    plist_path: "/Users/test/Library/LaunchAgents/com.example.running-agent.plist",
    source: "UserAgent",
    status: "Running",
    pid: 1234,
    last_exit_code: 0,
    plist: {
      ...defaultPlistConfig,
      label: "com.example.running-agent",
      program: "/usr/local/bin/my-agent",
      program_arguments: ["/usr/local/bin/my-agent", "--daemon"],
      run_at_load: true,
      keep_alive: true,
      standard_out_path: "/tmp/my-agent.stdout.log",
      standard_error_path: "/tmp/my-agent.stderr.log",
      raw_xml: '<?xml version="1.0"?><!DOCTYPE plist><plist version="1.0"><dict></dict></plist>',
    },
  },
}

type CommandHandler = (args: Record<string, unknown>) => unknown

const handlers: Record<string, CommandHandler> = {
  list_jobs: () => [...fakeJobs],
  get_job_detail: (args) => {
    const path = args.plistPath as string
    return fakeJobDetails[path] ?? null
  },
  start_job: () => undefined,
  stop_job: () => undefined,
  restart_job: () => undefined,
  kickstart_job: () => undefined,
  enable_job: () => undefined,
  disable_job: () => undefined,
  save_job: () => undefined,
  create_job: () => "/Users/test/Library/LaunchAgents/new-job.plist",
  delete_job: () => undefined,
  get_home_dir: () => "/Users/test",
  clear_log_file: () => undefined,
  read_log_file: () => ({
    content: "2024-01-01 12:00:00 INFO Started\n2024-01-01 12:00:01 INFO Running\n",
    modified_at: String(Date.now()),
  }),
  open_log_in_editor: () => undefined,
  reveal_in_finder: () => undefined,
}

let customHandlers: Record<string, CommandHandler> = {}

export function setFakeHandler(command: string, handler: CommandHandler) {
  customHandlers[command] = handler
}

export function resetFakeHandlers() {
  customHandlers = {}
}

export async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const handler = customHandlers[command] ?? handlers[command]
  if (!handler) {
    throw new Error(`Unknown command: ${command}`)
  }
  return handler(args ?? {}) as T
}
