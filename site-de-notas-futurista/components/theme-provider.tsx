"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"

type Theme = "light" | "dark"

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  applyTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  toggleTheme: () => {},
  applyTheme: () => {},
})

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "light"
  const uid = localStorage.getItem("advforte-theme-last-uid")
  const perUser = uid ? localStorage.getItem(`advforte-theme-${uid}`) : null
  const stored =
    perUser ??
    localStorage.getItem("advforte-theme") ??
    localStorage.getItem("nexus-theme")
  return stored === "dark" ? "dark" : "light"
}

function syncDocumentTheme(next: Theme) {
  if (next === "dark") {
    document.documentElement.classList.add("dark")
  } else {
    document.documentElement.classList.remove("dark")
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light")

  useEffect(() => {
    const initial = readStoredTheme()
    setTheme(initial)
    syncDocumentTheme(initial)
  }, [])

  const applyTheme = useCallback((next: Theme) => {
    setTheme(next)
    syncDocumentTheme(next)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light"
      syncDocumentTheme(next)
      return next
    })
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, applyTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
