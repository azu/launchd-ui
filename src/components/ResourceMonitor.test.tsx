import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ResourceMonitor } from "@/components/ResourceMonitor"

describe("ResourceMonitor", () => {
  it("shows a not-running message when pid is null", () => {
    render(<ResourceMonitor pid={null} enabled={true} />)

    expect(screen.getByTestId("not-running-message")).toBeInTheDocument()
    expect(screen.getByText(/Process is not running/)).toBeInTheDocument()
  })

  it("shows placeholder values before data arrives", () => {
    render(<ResourceMonitor pid={1234} enabled={false} />)

    expect(screen.getByTestId("cpu-value")).toHaveTextContent("-")
    expect(screen.getByTestId("memory-value")).toHaveTextContent("-")
  })

  it("renders CPU and memory sections for a running process", () => {
    render(<ResourceMonitor pid={1234} enabled={false} />)

    expect(screen.getByText("CPU Usage")).toBeInTheDocument()
    expect(screen.getByText("Memory Usage")).toBeInTheDocument()
  })
})
