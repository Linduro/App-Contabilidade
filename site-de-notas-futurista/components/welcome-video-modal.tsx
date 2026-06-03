"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WELCOME_VIDEO_SESSION_KEY, WELCOME_VIDEO_SRC } from "@/lib/welcome-video"

export function WelcomeVideoModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem(WELCOME_VIDEO_SESSION_KEY) === "1") {
      setOpen(true)
    }
  }, [])

  const close = () => {
    sessionStorage.removeItem(WELCOME_VIDEO_SESSION_KEY)
    setOpen(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div
        className="absolute inset-0"
        onClick={close}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-3xl glass-card neon-border rounded-2xl p-4 sm:p-6 shadow-xl">
        <button
          type="button"
          onClick={close}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Fechar vídeo"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-4 pr-8">
          <h2 className="text-xl sm:text-2xl font-bold gradient-text">Bem-vindo ao portal</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Assista ao vídeo de apresentação antes de continuar.
          </p>
        </div>

        <video
          src={WELCOME_VIDEO_SRC}
          controls
          playsInline
          autoPlay
          className="w-full aspect-video rounded-xl border border-border bg-black"
        />

        <div className="mt-4 flex justify-end">
          <Button onClick={close} className="neon-border">
            Continuar para o painel
          </Button>
        </div>
      </div>
    </div>
  )
}
