"use client"

import { useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { useTheme } from "@/components/theme-provider"

const GLOBAL_THEME_KEY = "advforte-theme"
const LAST_USER_THEME_KEY = "advforte-theme-last-uid"

function themeStorageKey(userId: string) {
  return `advforte-theme-${userId}`
}

export function ThemeSync() {
  const { user } = useAuth()
  const { theme, applyTheme } = useTheme()

  useEffect(() => {
    if (!user) return

    localStorage.setItem(LAST_USER_THEME_KEY, user.uid)

    const stored =
      localStorage.getItem(themeStorageKey(user.uid)) ??
      localStorage.getItem(GLOBAL_THEME_KEY) ??
      localStorage.getItem("nexus-theme")

    if (stored === "dark" || stored === "light") {
      applyTheme(stored)
    }
  }, [user, applyTheme])

  useEffect(() => {
    localStorage.setItem(GLOBAL_THEME_KEY, theme)
    if (user) {
      localStorage.setItem(themeStorageKey(user.uid), theme)
    }
  }, [theme, user])

  return null
}
