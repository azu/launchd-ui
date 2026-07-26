import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useTheme } from "./useTheme"

let matchesDark = false
const listeners: Array<() => void> = []

beforeEach(() => {
  matchesDark = false
  listeners.length = 0
  localStorage.clear()
  document.documentElement.classList.remove("dark")

  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: matchesDark,
    addEventListener: (_: string, handler: () => void) => {
      listeners.push(handler)
    },
    removeEventListener: (_: string, handler: () => void) => {
      const idx = listeners.indexOf(handler)
      if (idx >= 0) listeners.splice(idx, 1)
    },
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
})

describe("useTheme", () => {
  it("defaults to system theme", () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe("system")
  })

  it("applies dark class when system prefers dark", () => {
    matchesDark = true
    renderHook(() => useTheme())
    expect(document.documentElement.classList.contains("dark")).toBe(true)
  })

  it("does not apply dark class when system prefers light", () => {
    matchesDark = false
    renderHook(() => useTheme())
    expect(document.documentElement.classList.contains("dark")).toBe(false)
  })

  it("cycles through system -> dark -> light -> system", () => {
    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe("system")

    act(() => result.current.cycle())
    expect(result.current.theme).toBe("dark")
    expect(document.documentElement.classList.contains("dark")).toBe(true)

    act(() => result.current.cycle())
    expect(result.current.theme).toBe("light")
    expect(document.documentElement.classList.contains("dark")).toBe(false)

    act(() => result.current.cycle())
    expect(result.current.theme).toBe("system")
  })

  it("persists manual override to localStorage", () => {
    const { result } = renderHook(() => useTheme())

    act(() => result.current.setTheme("dark"))
    expect(localStorage.getItem("launchd-ui-theme")).toBe("dark")

    act(() => result.current.setTheme("system"))
    expect(localStorage.getItem("launchd-ui-theme")).toBeNull()
  })

  it("restores theme from localStorage on mount", () => {
    localStorage.setItem("launchd-ui-theme", "light")
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe("light")
    expect(document.documentElement.classList.contains("dark")).toBe(false)
  })

  it("responds to system preference changes in system mode", () => {
    matchesDark = false
    renderHook(() => useTheme())
    expect(document.documentElement.classList.contains("dark")).toBe(false)

    matchesDark = true
    listeners.forEach((fn) => fn())
    expect(document.documentElement.classList.contains("dark")).toBe(true)
  })
})
