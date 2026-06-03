"use client"

import { useEffect, useRef } from "react"
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
  const loadedForUser = useRef<string | null>(null)

  useEffect(() => {
    if (!user?.uid) {
      loadedForUser.current = null
      return
    }

    if (loadedForUser.current === user.uid) return

    loadedForUser.current = user.uid
    localStorage.setItem(LAST_USER_THEME_KEY, user.uid)

    const stored =
      localStorage.getItem(themeStorageKey(user.uid)) ??
      localStorage.getItem(GLOBAL_THEME_KEY) ??
      localStorage.getItem("nexus-theme")

    if (stored === "dark" || stored === "light") {
      applyTheme(stored)
    }
  }, [user?.uid, applyTheme])

  useEffect(() => {
    localStorage.setItem(GLOBAL_THEME_KEY, theme)
    if (user?.uid) {
      localStorage.setItem(themeStorageKey(user.uid), theme)
    }
  }, [theme, user?.uid])

  return null
}
