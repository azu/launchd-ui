import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { JobList } from "./JobList"
import type { JobListEntry } from "@/types"

const mockJobs: JobListEntry[] = [
  {
    label: "com.example.running",
    pid: 1234,
    last_exit_code: 0,
    plist_path: "/Users/test/Library/LaunchAgents/com.example.running.plist",
    source: "UserAgent",
    status: "Running",
  },
  {
    label: "com.example.stopped",
    pid: null,
    last_exit_code: 78,
    plist_path: "/Users/test/Library/LaunchAgents/com.example.stopped.plist",
    source: "UserAgent",
    status: "Unloaded",
  },
]

const noop = vi.fn()

describe("JobList", () => {
  it("renders loading state", () => {
    render(
      <JobList
        jobs={[]}
        loading={true}
        onStart={noop}
        onStop={noop}
        onRestart={noop}
        onKickstart={noop}
        onDelete={noop}
        onSelect={noop}
        onRevealInFinder={noop}
      />
    )
    expect(screen.getByText("Loading agents...")).toBeInTheDocument()
  })

  it("renders empty state", () => {
    render(
      <JobList
        jobs={[]}
        loading={false}
        onStart={noop}
        onStop={noop}
        onRestart={noop}
        onKickstart={noop}
        onDelete={noop}
        onSelect={noop}
        onRevealInFinder={noop}
      />
    )
    expect(screen.getByText("No agents found")).toBeInTheDocument()
  })

  it("renders job list with labels", () => {
    render(
      <JobList
        jobs={mockJobs}
        loading={false}
        onStart={noop}
        onStop={noop}
        onRestart={noop}
        onKickstart={noop}
        onDelete={noop}
        onSelect={noop}
        onRevealInFinder={noop}
      />
    )
    expect(screen.getByText("com.example.running")).toBeInTheDocument()
    expect(screen.getByText("com.example.stopped")).toBeInTheDocument()
  })

  it("renders status badges", () => {
    render(
      <JobList
        jobs={mockJobs}
        loading={false}
        onStart={noop}
        onStop={noop}
        onRestart={noop}
        onKickstart={noop}
        onDelete={noop}
        onSelect={noop}
        onRevealInFinder={noop}
      />
    )
    expect(screen.getByText("Running")).toBeInTheDocument()
    expect(screen.getByText("Unloaded")).toBeInTheDocument()
  })

  it("renders PID for running job", () => {
    render(
      <JobList
        jobs={mockJobs}
        loading={false}
        onStart={noop}
        onStop={noop}
        onRestart={noop}
        onKickstart={noop}
        onDelete={noop}
        onSelect={noop}
        onRevealInFinder={noop}
      />
    )
    expect(screen.getByText("1234")).toBeInTheDocument()
  })
})
