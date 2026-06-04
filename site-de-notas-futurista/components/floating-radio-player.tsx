"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronDown, Pause, Play, Radio } from "lucide-react"
import {
  DEFAULT_RADIO_STATION_ID,
  DEFAULT_RADIO_VOLUME,
  RADIO_STATIONS,
} from "@/lib/radio-stations"

const STATION_STORAGE_KEY = "advforte-radio-station"
const VOLUME_STORAGE_KEY = "advforte-radio-volume"

function readStoredVolume() {
  try {
    const saved = localStorage.getItem(VOLUME_STORAGE_KEY)
    if (saved === null) return DEFAULT_RADIO_VOLUME
    const parsed = Number(saved)
    if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 1) return parsed
  } catch {
    // ignore
  }
  return DEFAULT_RADIO_VOLUME
}

function readStoredStationId() {
  try {
    const saved = localStorage.getItem(STATION_STORAGE_KEY)
    if (saved && RADIO_STATIONS.some((item) => item.id === saved)) return saved
  } catch {
    // ignore
  }
  return DEFAULT_RADIO_STATION_ID
}

export function FloatingRadioPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [open, setOpen] = useState(false)
  const [playing, setPlaying] = useState(true)
  const [volume, setVolume] = useState(DEFAULT_RADIO_VOLUME)
  const [stationId, setStationId] = useState(DEFAULT_RADIO_STATION_ID)
  const [ready, setReady] = useState(false)
  const [needsInteraction, setNeedsInteraction] = useState(false)

  const station = RADIO_STATIONS.find((item) => item.id === stationId) ?? RADIO_STATIONS[0]

  const tryPlay = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) return false

    try {
      await audio.play()
      setNeedsInteraction(false)
      return true
    } catch {
      setNeedsInteraction(true)
      return false
    }
  }, [])

  useEffect(() => {
    setStationId(readStoredStationId())
    setVolume(readStoredVolume())
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return

    const audio = audioRef.current
    if (!audio) return

    audio.volume = volume
    try {
      localStorage.setItem(VOLUME_STORAGE_KEY, String(volume))
    } catch {
      // ignore
    }
  }, [volume, ready])

  useEffect(() => {
    if (!ready) return

    const audio = audioRef.current
    if (!audio) return

    audio.src = station.url
    audio.volume = volume
    audio.load()

    if (playing) {
      void tryPlay()
    } else {
      audio.pause()
      setNeedsInteraction(false)
    }
  }, [ready, station.url, playing, tryPlay])

  useEffect(() => {
    if (!needsInteraction || !playing) return

    const unlock = () => {
      void tryPlay()
    }

    window.addEventListener("pointerdown", unlock, { once: true })
    return () => window.removeEventListener("pointerdown", unlock)
  }, [needsInteraction, playing, tryPlay])

  const selectStation = (id: string) => {
    setStationId(id)
    try {
      localStorage.setItem(STATION_STORAGE_KEY, id)
    } catch {
      // ignore
    }
    setPlaying(true)
  }

  const volumePercent = Math.round(volume * 100)

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

          <p className="text-xs text-muted-foreground mb-2 truncate">
            {station.label}
            {stationId === "lofi" && playing && (
              <span className="text-primary/80"> · automático</span>
            )}
          </p>

          {needsInteraction && (
            <p className="text-[10px] text-muted-foreground mb-2">
              Clique em qualquer lugar da página para iniciar o áudio.
            </p>
          )}

          <div className="flex items-center gap-2 mb-1">
            <button
              type="button"
              onClick={() => setPlaying((value) => !value)}
              className="h-9 w-9 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90"
              aria-label={playing ? "Pausar rádio" : "Tocar rádio"}
            >
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            <div className="flex-1 min-w-0">
              <label className="text-[10px] text-muted-foreground flex justify-between mb-1">
                <span>Volume</span>
                <span>{volumePercent}%</span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={volumePercent}
                onChange={(e) => setVolume(Number(e.target.value) / 100)}
                className="w-full h-1.5 accent-primary cursor-pointer"
                aria-label="Volume da rádio"
              />
            </div>
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
        <span className="text-xs font-semibold text-foreground hidden sm:inline">
          {stationId === "lofi" && playing ? "Lofi" : "Rádio"}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} preload="none" />
    </div>
  )
}
