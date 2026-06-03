"use client"

import { useEffect, useRef, useState } from "react"
import {
  DISCIPLINE_PRESETS,
  DISCIPLINE_TYPE_ORDER,
  type DisciplineType,
} from "@/lib/progression-data"
import { DisciplineEmoji } from "@/components/discipline-emoji"

interface DisciplineTypePickerProps {
  type: DisciplineType
  onChange: (type: DisciplineType) => void
}

export function DisciplineTypePicker({ type, onChange }: DisciplineTypePickerProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const preset = DISCIPLINE_PRESETS[type]

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("click", close)
    return () => document.removeEventListener("click", close)
  }, [open])

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`h-10 flex items-center justify-center bg-secondary/40 border border-dashed border-border rounded-lg hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all ${
          type === "essential" ? "w-14 px-1" : "w-12"
        }`}
        aria-label={`Categoria: ${preset.label}`}
        title={`Categoria: ${preset.label}`}
      >
        <DisciplineEmoji type={type} className="text-base" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 glass-card rounded-xl neon-border py-1 min-w-[180px] shadow-lg">
          {DISCIPLINE_TYPE_ORDER.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                onChange(option)
                setOpen(false)
              }}
              className={`w-full px-4 py-2.5 text-left text-sm font-medium hover:bg-primary/10 hover:text-primary flex items-center gap-2 ${
                option === type ? "bg-primary/5 text-primary" : ""
              }`}
            >
              <DisciplineEmoji type={option} className="text-base" />
              {DISCIPLINE_PRESETS[option].label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
