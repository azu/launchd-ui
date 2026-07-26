import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useLogs } from "./useLogs"
import { resetFakeHandlers, setFakeHandler } from "@/test-utils/tauri-mock"

beforeEach(() => {
  resetFakeHandlers()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("useLogs", () => {
  it("fetches log content", async () => {
    const { result } = renderHook(() => useLogs())

    await act(async () => {
      await result.current.fetchLog("/tmp/test.log")
    })

    expect(result.current.contentHtml).toContain("Started")
    expect(result.current.error).toBeNull()
  })

  it("converts ANSI codes to HTML spans", async () => {
    setFakeHandler("read_log_file", () => ({
      content: "\x1b[31mERROR\x1b[0m something failed",
      modified_at: String(Date.now()),
    }))

    const { result } = renderHook(() => useLogs())

    await act(async () => {
      await result.current.fetchLog("/tmp/test.log")
    })

    expect(result.current.contentHtml).toContain("ansi-red-fg")
    expect(result.current.contentHtml).toContain("ERROR")
    expect(result.current.contentHtml).not.toContain("\x1b")
  })

  it("renders bold ANSI sequences", async () => {
    setFakeHandler("read_log_file", () => ({
      content: "\x1b[1mbold text\x1b[0m",
      modified_at: String(Date.now()),
    }))

    const { result } = renderHook(() => useLogs())

    await act(async () => {
      await result.current.fetchLog("/tmp/test.log")
    })

    expect(result.current.contentHtml).toContain("font-weight:bold")
    expect(result.current.contentHtml).toContain("bold text")
  })

  it("strips OSC sequences but preserves ANSI color codes", async () => {
    setFakeHandler("read_log_file", () => ({
      content: "\x1b]0;window title\x07\x1b[32mgreen\x1b[0m",
      modified_at: String(Date.now()),
    }))

    const { result } = renderHook(() => useLogs())

    await act(async () => {
      await result.current.fetchLog("/tmp/test.log")
    })

    expect(result.current.contentHtml).toContain("ansi-green-fg")
    expect(result.current.contentHtml).not.toContain("window title")
  })

  it("handles fetch errors", async () => {
    setFakeHandler("read_log_file", () => {
      throw new Error("File not found")
    })

    const { result } = renderHook(() => useLogs())

    await act(async () => {
      await result.current.fetchLog("/tmp/missing.log")
    })

    expect(result.current.error).toContain("File not found")
    expect(result.current.contentHtml).toBe("")
  })

  it("starts and stops tailing", async () => {
    let callCount = 0
    setFakeHandler("read_log_file", () => {
      callCount++
      return {
        content: `line ${callCount}`,
        modified_at: String(Date.now()),
      }
    })

    const { result } = renderHook(() => useLogs())

    await act(async () => {
      result.current.startTailing("/tmp/test.log", 200, 1000)
    })

    expect(result.current.tailing).toBe(true)
    expect(callCount).toBe(1)

    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(callCount).toBe(2)

    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(callCount).toBe(3)

    act(() => {
      result.current.stopTailing()
    })
    expect(result.current.tailing).toBe(false)

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(callCount).toBe(3)
  })

  it("cleans up interval on unmount", async () => {
    const { result, unmount } = renderHook(() => useLogs())

    await act(async () => {
      result.current.startTailing("/tmp/test.log", 200, 1000)
    })

    expect(result.current.tailing).toBe(true)
    unmount()

    // Should not throw after unmount
    await act(async () => {
      vi.advanceTimersByTime(5000)
    })
  })

  it("parses modified_at timestamp", async () => {
    const now = Date.now()
    setFakeHandler("read_log_file", () => ({
      content: "test",
      modified_at: String(now),
    }))

    const { result } = renderHook(() => useLogs())

    await act(async () => {
      await result.current.fetchLog("/tmp/test.log")
    })

    expect(result.current.modifiedAt).toBeInstanceOf(Date)
    expect(result.current.modifiedAt!.getTime()).toBe(now)
  })
})
