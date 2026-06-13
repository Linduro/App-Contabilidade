"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Radio } from "lucide-react";

type Props = {
  url: string;
  label?: string | null;
  autoplay?: boolean;
};

export function JurisdicaoRadio({ url, label, autoplay = true }: Props) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const a = ref.current;
    if (!a || !autoplay) return;
    a.play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false));
  }, [autoplay, url]);

  function toggle() {
    const a = ref.current;
    if (!a) return;
    if (a.paused) {
      a.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    } else {
      a.pause();
      setPlaying(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-black/80 px-3 py-2 text-white shadow-lg backdrop-blur">
      {/* preload none: o stream só inicia ao tocar */}
      <audio ref={ref} src={url} preload="none" />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pausar rádio" : "Tocar rádio"}
        className="grid size-7 place-items-center rounded-full bg-white/15 hover:bg-white/25"
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </button>
      <Radio className={`size-4 ${playing ? "animate-pulse" : ""}`} />
      <span className="max-w-[140px] truncate text-xs font-medium">
        {label?.trim() || "Rádio"}
      </span>
    </div>
  );
}
