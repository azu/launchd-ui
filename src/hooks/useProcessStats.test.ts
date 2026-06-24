import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useProcessStats } from "@/hooks/useProcessStats"
import { resetFakeHandlers, setFakeHandler } from "@/test-utils/tauri-mock"

beforeEach(() => {
  resetFakeHandlers()
})

describe("useProcessStats", () => {
  it("does not poll without a pid", async () => {
    const handler = vi.fn()
    setFakeHandler("get_process_stats", handler)

    renderHook(() => useProcessStats(null, true))
    await act(async () => {})

    expect(handler).not.toHaveBeenCalled()
  })

  it("does not poll when disabled", async () => {
    const handler = vi.fn()
    setFakeHandler("get_process_stats", handler)

    renderHook(() => useProcessStats(1234, false))
    await act(async () => {})

    expect(handler).not.toHaveBeenCalled()
  })

  it("fetches stats immediately when enabled", async () => {
    setFakeHandler("get_process_stats", () => ({
      pid: 1234,
      cpu_percent: 12.5,
      memory_bytes: 104_857_600,
      timestamp: Date.now(),
    }))

    const { result } = renderHook(() => useProcessStats(1234, true))

    await waitFor(() => {
      expect(result.current.latest).not.toBeNull()
    })

    expect(result.current.latest?.cpu_percent).toBe(12.5)
    expect(result.current.latest?.memory_bytes).toBe(104_857_600)
    expect(result.current.error).toBeNull()
  })

  it("stores an error when the command fails", async () => {
    setFakeHandler("get_process_stats", () => {
      throw new Error("process not found: PID 9999")
    })

    const { result } = renderHook(() => useProcessStats(9999, true))

    await waitFor(() => {
      expect(result.current.error).toContain("process not found")
    })
  })
})
