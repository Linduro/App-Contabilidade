"use client"

import { createContext, useContext, useEffect, useState } from "react"

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
  const stored =
    localStorage.getItem("advforte-theme") ?? localStorage.getItem("nexus-theme")
  return stored === "dark" ? "dark" : "light"
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light")
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const initial = readStoredTheme()
    setTheme(initial)
    document.documentElement.classList.toggle("dark", initial === "dark")
    setReady(true)
  }, [])

  const applyTheme = (next: Theme) => {
    setTheme(next)
    document.documentElement.classList.toggle("dark", next === "dark")
  }

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light"
      document.documentElement.classList.toggle("dark", next === "dark")
      return next
    })
  }

  if (!ready) return <>{children}</>

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, applyTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
