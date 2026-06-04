"use client"

import { motion } from "framer-motion"

export function ProfileCompleteness({ percent }: { percent: number }) {
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percent / 100) * circumference

  return (
    <div className="relative flex flex-col items-center gap-2">
      <svg width="100" height="100" className="-rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="10"
        />
        <motion.circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#4f46e5"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-xl font-bold text-indigo-700">{percent}%</span>
        <span className="text-[10px] text-slate-500">completo</span>
      </div>
      <p className="text-sm text-slate-600 text-center">Completude do perfil</p>
    </div>
  )
}
