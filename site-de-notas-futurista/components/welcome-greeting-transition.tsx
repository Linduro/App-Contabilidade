"use client"

import { useEffect, useRef, useState } from "react"
import {
  getWelcomeGreeting,
  WELCOME_GREETING_SESSION_KEY,
} from "@/lib/welcome-greeting"

interface WelcomeGreetingTransitionProps {
  onComplete: () => void
}

export function WelcomeGreetingTransition({ onComplete }: WelcomeGreetingTransitionProps) {
  const onCompleteRef = useRef(onComplete)
  const [active, setActive] = useState(false)
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    if (sessionStorage.getItem(WELCOME_GREETING_SESSION_KEY) !== "1") {
      onCompleteRef.current()
      return
    }

    setMessage(getWelcomeGreeting())
    setActive(true)

    const enterFrame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true))
    })

    const fadeOutTimer = window.setTimeout(() => setVisible(false), 2400)
    const finishTimer = window.setTimeout(() => {
      sessionStorage.removeItem(WELCOME_GREETING_SESSION_KEY)
      setActive(false)
      onCompleteRef.current()
    }, 3200)

    return () => {
      cancelAnimationFrame(enterFrame)
      window.clearTimeout(fadeOutTimer)
      window.clearTimeout(finishTimer)
    }
  }, [])

  if (!active) return null

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-background/92 backdrop-blur-md transition-opacity duration-700 ease-in-out ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      aria-live="polite"
    >
      <p className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold gradient-text text-center px-6 tracking-tight">
        {message}
      </p>
    </div>
  )
}
