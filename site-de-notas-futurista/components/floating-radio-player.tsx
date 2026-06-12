"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronUp, Pause, Play, Radio, Volume2 } from "lucide-react"
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
    <div
      className="fixed z-[350] flex flex-col items-center gap-2
        top-1/2 -translate-y-1/2 translate-x-[2.5cm]
        right-[max(0.75rem,calc((100vw-min(72rem,100vw-2rem))/2-0.25rem))]
        max-md:top-auto max-md:bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] max-md:translate-y-0 max-md:translate-x-[1.25cm]
        max-md:right-3"
    >
      {open && (
        <div className="glass-card neon-border rounded-xl p-3.5 w-[7.25rem] min-h-[11rem] shadow-2xl border border-primary/25 flex flex-col items-center gap-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-primary text-center leading-tight">
            Estações
          </p>

          <div className="flex flex-col gap-2 w-full flex-1">
            {RADIO_STATIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectStation(item.id)}
                className={`text-xs font-bold px-2 py-2.5 rounded-lg border transition-all w-full leading-tight min-h-[2.25rem] ${
                  stationId === item.id
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-secondary/50 border-border/80 text-foreground hover:border-primary/40 hover:bg-primary/10"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {needsInteraction && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium px-2 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-center leading-snug">
              Toque na página para iniciar
            </p>
          )}
        </div>
      )}

      <div
        className={`glass-card rounded-xl shadow-xl flex flex-col items-center gap-2.5 p-3 border transition-colors w-[7.25rem] min-h-[13.5rem] ${
          playing ? "neon-border border-primary/40 bg-primary/5" : "neon-border border-border/60"
        }`}
      >
        <button
          type="button"
          onClick={() => setPlaying((value) => !value)}
          className={`h-11 w-11 shrink-0 rounded-full flex items-center justify-center shadow-md transition-all ${
            playing
              ? "bg-primary text-primary-foreground ring-2 ring-primary/30 hover:bg-primary/90"
              : "bg-secondary border-2 border-primary/40 text-primary hover:bg-primary/15"
          }`}
          aria-label={playing ? "Pausar rádio" : "Tocar rádio"}
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        <div className="flex flex-col items-center min-w-0 w-full px-1">
          <span className="text-xs font-bold text-foreground text-center leading-tight truncate w-full">
            {station.label}
          </span>
          <span
            className={`text-[10px] font-semibold ${playing ? "text-primary" : "text-muted-foreground"}`}
          >
            {playing ? "▶ Tocando" : "Pausado"}
          </span>
        </div>

        <div className="flex flex-col items-center gap-1.5 w-full px-1 flex-1 justify-center">
          <Volume2 className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden />
          <input
            type="range"
            min={0}
            max={100}
            value={volumePercent}
            onChange={(e) => setVolume(Number(e.target.value) / 100)}
            className="radio-volume-vertical accent-primary cursor-pointer"
            aria-label="Volume da rádio"
          />
          <span className="text-[10px] font-bold text-primary tabular-nums">{volumePercent}%</span>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="h-9 w-full rounded-lg bg-primary/15 border border-primary/40 text-primary font-semibold text-[10px] flex flex-col items-center justify-center gap-0.5 hover:bg-primary/25 transition-colors shrink-0"
          aria-expanded={open}
          aria-label={open ? "Recolher estações" : "Escolher estação"}
        >
          <Radio className="w-3.5 h-3.5" />
          <ChevronUp className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} preload="none" />
    </div>
  )
}
