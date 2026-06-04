"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown, Pause, Play, Radio, Volume2, VolumeX } from "lucide-react"
import { RADIO_STATIONS } from "@/lib/radio-stations"

const STORAGE_KEY = "advforte-radio-station"

export function FloatingRadioPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [open, setOpen] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [stationId, setStationId] = useState(RADIO_STATIONS[0].id)
  const [error, setError] = useState("")

  const station = RADIO_STATIONS.find((item) => item.id === stationId) ?? RADIO_STATIONS[0]

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved && RADIO_STATIONS.some((item) => item.id === saved)) {
        setStationId(saved)
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    setError("")
    audio.src = station.url
    audio.load()

    if (playing) {
      audio.play().catch(() => {
        setPlaying(false)
        setError("Não foi possível reproduzir esta rádio.")
      })
    }
  }, [station.url])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (playing) {
      audio.play().catch(() => {
        setPlaying(false)
        setError("Toque em play para iniciar o áudio.")
      })
    } else {
      audio.pause()
    }
  }, [playing])

  useEffect(() => {
    const audio = audioRef.current
    if (audio) audio.muted = muted
  }, [muted])

  const selectStation = (id: string) => {
    setStationId(id)
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // ignore
    }
    if (!playing) setPlaying(true)
  }

  return (
    <div className="fixed bottom-5 right-5 z-[350] flex flex-col items-end gap-2">
      {open && (
        <div className="glass-card neon-border rounded-2xl p-4 w-[min(100vw-2.5rem,18rem)] shadow-xl">
          <p className="text-xs font-bold text-primary mb-3 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5" />
            Rádios
          </p>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {RADIO_STATIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectStation(item.id)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                  stationId === item.id
                    ? "bg-primary/15 border-primary/50 text-primary"
                    : "border-border/60 text-muted-foreground hover:border-primary/30"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <p className="text-xs text-muted-foreground mb-3 truncate">{station.label}</p>

          {error && <p className="text-[10px] text-destructive mb-2">{error}</p>}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPlaying((value) => !value)}
              className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90"
              aria-label={playing ? "Pausar rádio" : "Tocar rádio"}
            >
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            <button
              type="button"
              onClick={() => setMuted((value) => !value)}
              className="h-9 w-9 rounded-full border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label={muted ? "Ativar som" : "Silenciar"}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="glass-card neon-border rounded-full h-12 px-4 flex items-center gap-2 shadow-lg hover:bg-secondary/40 transition-colors"
        aria-expanded={open}
        aria-label="Player de rádio"
      >
        <Radio className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold text-foreground hidden sm:inline">Rádio</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} preload="none" />
    </div>
  )
}
