import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { ResourceMonitor } from "./ResourceMonitor"
import { resetFakeHandlers, setFakeHandler } from "@/test-utils/tauri-mock"

// Mock recharts ResponsiveContainer which doesn't work well in jsdom
vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts")
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 500, height: 180 }}>{children}</div>
    ),
  }
})

beforeEach(() => {
  resetFakeHandlers()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("ResourceMonitor", () => {
  it("shows not-running message when pid is null", () => {
    render(<ResourceMonitor pid={null} enabled={true} />)
    expect(screen.getByTestId("not-running-message")).toBeInTheDocument()
    expect(screen.getByText(/Process is not running/)).toBeInTheDocument()
  })

  it("shows placeholder values before data arrives", () => {
    setFakeHandler("get_process_stats", () => ({
      pid: 1234,
      cpu_percent: 10.5,
      memory_bytes: 104_857_600,
      timestamp: Date.now(),
    }))

    render(<ResourceMonitor pid={1234} enabled={false} />)
    expect(screen.getByTestId("cpu-value")).toHaveTextContent("—")
    expect(screen.getByTestId("memory-value")).toHaveTextContent("—")
  })

  it("renders chart sections when pid is provided", () => {
    render(<ResourceMonitor pid={1234} enabled={false} />)
    expect(screen.getByText("CPU Usage")).toBeInTheDocument()
    expect(screen.getByText("Memory Usage")).toBeInTheDocument()
  })
})
