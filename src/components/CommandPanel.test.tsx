import { describe, expect, it } from "vitest"
import { buildCommands, shellQuote } from "@/components/CommandPanel"
import type { LaunchdJob } from "@/types"

function job(overrides: Partial<LaunchdJob>): LaunchdJob {
  return {
    label: "com.example.agent",
    plist_path: "/Users/test/Library/LaunchAgents/com.example.agent.plist",
    source: "UserAgent",
    status: "Running",
    pid: 1234,
    last_exit_code: 0,
    last_run_at: null,
    plist: {
      label: "com.example.agent",
      program: "/usr/bin/true",
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
      wake_system: null,
      raw_xml: "",
    },
    ...overrides,
  }
}

describe("CommandPanel command builders", () => {
  it("quotes shell paths only when needed", () => {
    expect(shellQuote("/tmp/com.example.plist")).toBe("/tmp/com.example.plist")
    expect(shellQuote("/tmp/Launch Agents/example's job.plist")).toBe(
      "'/tmp/Launch Agents/example'\\''s job.plist'"
    )
  })

  it("builds user agent commands like the backend launchctl wrapper", () => {
    const commands = buildCommands(job({}))

    expect(commands.map((item) => item.command)).toEqual([
      "launchctl bootstrap gui/$(id -u) /Users/test/Library/LaunchAgents/com.example.agent.plist",
      "launchctl bootout gui/$(id -u) /Users/test/Library/LaunchAgents/com.example.agent.plist",
      "launchctl kickstart -k gui/$(id -u)/com.example.agent",
      "launchctl enable gui/$(id -u)/com.example.agent",
      "launchctl disable gui/$(id -u)/com.example.agent",
      "rm /Users/test/Library/LaunchAgents/com.example.agent.plist",
    ])
  })

  it("quotes labels in service targets", () => {
    const commands = buildCommands(
      job({
        label: "com.example.agent's job",
      })
    )

    expect(commands.map((item) => item.command)).toContain(
      "launchctl kickstart -k gui/$(id -u)/'com.example.agent'\\''s job'"
    )
    expect(commands.map((item) => item.command)).toContain(
      "launchctl enable gui/$(id -u)/'com.example.agent'\\''s job'"
    )
    expect(commands.map((item) => item.command)).toContain(
      "launchctl disable gui/$(id -u)/'com.example.agent'\\''s job'"
    )
  })

  it("uses sudo for system agents", () => {
    const commands = buildCommands(
      job({
        source: "SystemAgent",
        plist_path: "/Library/LaunchAgents/com.example.agent.plist",
      })
    )

    expect(commands.map((item) => item.command)).toEqual([
      "sudo launchctl bootstrap gui/$(id -u) /Library/LaunchAgents/com.example.agent.plist",
      "sudo launchctl bootout gui/$(id -u) /Library/LaunchAgents/com.example.agent.plist",
      "sudo launchctl kickstart -k gui/$(id -u)/com.example.agent",
      "sudo launchctl enable gui/$(id -u)/com.example.agent",
      "sudo launchctl disable gui/$(id -u)/com.example.agent",
      "sudo rm /Library/LaunchAgents/com.example.agent.plist",
    ])
  })

  it("uses the system domain for system daemons", () => {
    const commands = buildCommands(
      job({
        source: "SystemDaemon",
        plist_path: "/Library/LaunchDaemons/com.example.agent.plist",
      })
    )

    expect(commands.map((item) => item.command)).toEqual([
      "sudo launchctl bootstrap system /Library/LaunchDaemons/com.example.agent.plist",
      "sudo launchctl bootout system /Library/LaunchDaemons/com.example.agent.plist",
      "sudo launchctl kickstart -k system/com.example.agent",
      "sudo launchctl enable system/com.example.agent",
      "sudo launchctl disable system/com.example.agent",
      "sudo rm /Library/LaunchDaemons/com.example.agent.plist",
    ])
  })
})
