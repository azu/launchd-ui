import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"
import { useProcessStats } from "./useProcessStats"
import { resetFakeHandlers, setFakeHandler } from "@/test-utils/tauri-mock"

beforeEach(() => {
  resetFakeHandlers()
})

describe("useProcessStats", () => {
  it("does not poll when pid is null", async () => {
    const handler = vi.fn(() => ({
      pid: 1234,
      cpu_percent: 1.0,
      memory_bytes: 1024,
      timestamp: Date.now(),
    }))
    setFakeHandler("get_process_stats", handler)

    renderHook(() => useProcessStats(null, true))

    // Wait a tick to let any effects run
    await act(async () => {})

    expect(handler).not.toHaveBeenCalled()
  })

  it("does not poll when enabled is false", async () => {
    const handler = vi.fn(() => ({
      pid: 1234,
      cpu_percent: 1.0,
      memory_bytes: 1024,
      timestamp: Date.now(),
    }))
    setFakeHandler("get_process_stats", handler)

    renderHook(() => useProcessStats(1234, false))

    await act(async () => {})

    expect(handler).not.toHaveBeenCalled()
  })

  it("fetches data immediately when enabled with a pid", async () => {
    let callCount = 0
    setFakeHandler("get_process_stats", () => {
      callCount++
      return {
        pid: 1234,
        cpu_percent: callCount * 1.5,
        memory_bytes: callCount * 1024,
        timestamp: Date.now(),
      }
    })

    const { result } = renderHook(() => useProcessStats(1234, true))

    await waitFor(() => {
      expect(result.current.data.length).toBeGreaterThanOrEqual(1)
    })

    expect(result.current.latest).not.toBeNull()
    expect(result.current.latest!.cpu_percent).toBe(1.5)
    expect(result.current.error).toBeNull()
  })

  it("resets data when pid changes", async () => {
    setFakeHandler("get_process_stats", (args) => ({
      pid: args.pid as number,
      cpu_percent: 5.0,
      memory_bytes: 2048,
      timestamp: Date.now(),
    }))

    const { result, rerender } = renderHook(
      ({ pid, enabled }: { pid: number | null; enabled: boolean }) =>
        useProcessStats(pid, enabled),
      { initialProps: { pid: 1234, enabled: true } },
    )

    await waitFor(() => {
      expect(result.current.data.length).toBeGreaterThanOrEqual(1)
    })

    // Change PID - data should be reset
    rerender({ pid: 5678, enabled: true })

    // After PID change, data gets reset then new fetch happens
    await waitFor(() => {
      expect(result.current.data.length).toBeGreaterThanOrEqual(1)
    })

    // Data should have been fetched for new PID
    expect(result.current.latest!.cpu_percent).toBe(5.0)
  })

  it("sets error when fetch fails", async () => {
    setFakeHandler("get_process_stats", () => {
      throw new Error("process not found: PID 9999")
    })

    const { result } = renderHook(() => useProcessStats(9999, true))

    await waitFor(() => {
      expect(result.current.error).toContain("process not found")
    })
  })
})
