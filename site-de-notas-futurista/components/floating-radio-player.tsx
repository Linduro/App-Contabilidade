"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronDown, Pause, Play, Radio, Volume2 } from "lucide-react"
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
    <div className="fixed bottom-5 right-5 z-[350] flex flex-col items-end gap-2 max-md:bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] max-md:right-4">
      {open && (
        <div className="glass-card neon-border rounded-2xl p-4 w-[min(100vw-2.5rem,20rem)] shadow-2xl border-2 border-primary/25">
          <p className="text-sm font-bold text-primary mb-3 flex items-center gap-2">
            <Radio className="w-4 h-4" />
            Escolher estação
          </p>

          <div className="grid grid-cols-3 gap-2 mb-4">
            {RADIO_STATIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectStation(item.id)}
                className={`text-xs font-bold px-2 py-2.5 rounded-xl border-2 transition-all max-md:min-h-11 ${
                  stationId === item.id
                    ? "bg-primary text-primary-foreground border-primary shadow-md scale-[1.02]"
                    : "bg-secondary/50 border-border/80 text-foreground hover:border-primary/40 hover:bg-primary/10"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {needsInteraction && (
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-3 px-2 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
              Toque em qualquer lugar da página para iniciar o áudio.
            </p>
          )}

          <div className="rounded-xl bg-primary/10 border-2 border-primary/30 p-3 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5" />
              Controles
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPlaying((value) => !value)}
                className={`h-12 w-12 shrink-0 rounded-full flex items-center justify-center shadow-lg transition-all max-md:h-14 max-md:w-14 ${
                  playing
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/25 hover:bg-primary/90"
                    : "bg-secondary border-2 border-primary/50 text-primary hover:bg-primary/15"
                }`}
                aria-label={playing ? "Pausar rádio" : "Tocar rádio"}
              >
                {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate mb-0.5">{station.label}</p>
                <p className="text-[11px] text-muted-foreground mb-2">
                  {playing ? "Tocando agora" : "Pausado"}
                  {stationId === "lofi" && playing && " · Lofi automático"}
                </p>
                <label className="text-xs font-semibold text-foreground flex justify-between mb-1.5">
                  <span className="flex items-center gap-1">
                    <Volume2 className="w-3.5 h-3.5 text-primary" />
                    Volume
                  </span>
                  <span className="text-primary tabular-nums">{volumePercent}%</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={volumePercent}
                  onChange={(e) => setVolume(Number(e.target.value) / 100)}
                  className="w-full h-2.5 accent-primary cursor-pointer rounded-full max-md:h-3"
                  aria-label="Volume da rádio"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        className={`glass-card rounded-2xl shadow-xl flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 border-2 transition-colors w-[min(100vw-2.5rem,20rem)] sm:w-auto ${
          playing
            ? "neon-border border-primary/40 bg-primary/5"
            : "neon-border border-border/60"
        }`}
      >
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setPlaying((value) => !value)}
            className={`h-11 w-11 shrink-0 rounded-full flex items-center justify-center shadow-md transition-all max-md:h-12 max-md:w-12 ${
              playing
                ? "bg-primary text-primary-foreground ring-2 ring-primary/30 hover:bg-primary/90"
                : "bg-secondary border-2 border-primary/40 text-primary hover:bg-primary/15"
            }`}
            aria-label={playing ? "Pausar rádio" : "Tocar rádio"}
          >
            {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>

          <div className="flex flex-col min-w-0 flex-1 sm:max-w-[6rem]">
            <span className="text-sm font-bold text-foreground truncate">{station.label}</span>
            <span className={`text-[11px] font-semibold ${playing ? "text-primary" : "text-muted-foreground"}`}>
              {playing ? "▶ Tocando" : "Pausado"}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="h-10 px-3 rounded-xl bg-primary/15 border border-primary/40 text-primary font-semibold text-xs flex items-center gap-1.5 hover:bg-primary/25 transition-colors shrink-0 max-md:min-h-11 sm:ml-auto"
            aria-expanded={open}
            aria-label={open ? "Recolher opções da rádio" : "Mais opções da rádio"}
          >
            <Radio className="w-4 h-4" />
            <span className="hidden sm:inline">{open ? "Menos" : "Estações"}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </div>

        <div className="flex items-center gap-2 w-full px-0.5 sm:min-w-[8rem] sm:max-w-[10rem]">
          <Volume2 className="w-4 h-4 text-primary shrink-0" aria-hidden />
          <input
            type="range"
            min={0}
            max={100}
            value={volumePercent}
            onChange={(e) => setVolume(Number(e.target.value) / 100)}
            className="w-full h-2.5 accent-primary cursor-pointer max-md:h-3"
            aria-label="Volume da rádio"
          />
          <span className="text-xs font-bold text-primary tabular-nums w-9 text-right shrink-0">
            {volumePercent}%
          </span>
        </div>
      </div>

      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} preload="none" />
    </div>
  )
}
