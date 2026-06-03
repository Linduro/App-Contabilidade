"use client"

import { useEffect, useRef, useState } from "react"
import { WELCOME_VIDEO_SESSION_KEY, WELCOME_VIDEO_SRC } from "@/lib/welcome-video"

interface WelcomeVideoTransitionProps {
  onComplete: () => void
}

export function WelcomeVideoTransition({ onComplete }: WelcomeVideoTransitionProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem(WELCOME_VIDEO_SESSION_KEY) === "1") {
      setVisible(true)
    }
  }, [])

  const finish = () => {
    if (exiting) return
    sessionStorage.removeItem(WELCOME_VIDEO_SESSION_KEY)
    setExiting(true)
    window.setTimeout(() => {
      setVisible(false)
      onComplete()
    }, 700)
  }

  useEffect(() => {
    if (!visible || exiting) return
    const video = videoRef.current
    if (!video) return

    const play = () => {
      video.play().catch(() => {
        video.muted = true
        video.play().catch(() => {})
      })
    }

    play()
  }, [visible, exiting])

  if (!visible) return null

  return (
    <div
      className={`fixed inset-0 z-[100] bg-black transition-opacity duration-700 ease-out ${
        exiting ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      aria-hidden={exiting}
    >
      <video
        ref={videoRef}
        src={WELCOME_VIDEO_SRC}
        playsInline
        autoPlay
        onEnded={finish}
        className="absolute inset-0 h-full w-full object-cover"
      />

      <button
        type="button"
        onClick={finish}
        className="absolute bottom-6 right-6 z-10 rounded-full border border-white/30 bg-black/40 px-4 py-2 text-xs font-semibold text-white/80 backdrop-blur-sm transition-colors hover:bg-black/60 hover:text-white"
      >
        Pular
      </button>
    </div>
  )
}
