import { useState, useEffect, useCallback } from "react"

type Theme = "system" | "light" | "dark"

const STORAGE_KEY = "launchd-ui-theme"
const query = "(prefers-color-scheme: dark)"

function getSystemDark(): boolean {
  return window.matchMedia(query).matches
}

function applyDark(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark)
}

function resolveTheme(theme: Theme): boolean {
  if (theme === "system") return getSystemDark()
  return theme === "dark"
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === "light" || stored === "dark" ? stored : "system"
  })

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    if (t === "system") {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, t)
    }
    applyDark(resolveTheme(t))
  }, [])

  const cycle = useCallback(() => {
    setTheme(theme === "system" ? "dark" : theme === "dark" ? "light" : "system")
  }, [theme, setTheme])

  useEffect(() => {
    applyDark(resolveTheme(theme))
    if (theme !== "system") return
    const mql = window.matchMedia(query)
    const handler = () => applyDark(getSystemDark())
    mql.addEventListener("change", handler)
    return () => mql.removeEventListener("change", handler)
  }, [theme])

  return { theme, setTheme, cycle }
}
