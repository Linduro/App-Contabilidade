"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronDown, X } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import {
  clearOnboardingDone,
  FOOTER_TOUR_STEP_IDS,
  HEADER_TOUR_STEP_IDS,
  isOnboardingDone,
  markOnboardingDone,
  ONBOARDING_STEPS,
  scrollToTourStep,
} from "@/lib/dashboard-onboarding"

interface DashboardOnboardingTourProps {
  autoStart: boolean
  restartKey?: number
}

export function DashboardOnboardingTour({ autoStart, restartKey = 0 }: DashboardOnboardingTourProps) {
  const { user } = useAuth()
  const [active, setActive] = useState(false)
  const [explained, setExplained] = useState<Set<string>>(new Set())
  const [visible, setVisible] = useState<Set<string>>(new Set())
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)

  const pendingSteps = useMemo(
    () => ONBOARDING_STEPS.filter((step) => !explained.has(step.id)),
    [explained]
  )

  const currentStep = useMemo(() => {
    const visiblePending = pendingSteps.find((step) => visible.has(step.id))
    return visiblePending ?? pendingSteps[0] ?? null
  }, [pendingSteps, visible])

  const isHeaderStep = currentStep ? HEADER_TOUR_STEP_IDS.has(currentStep.id) : false
  const isFooterStep = currentStep ? FOOTER_TOUR_STEP_IDS.has(currentStep.id) : false
  const isPinnedStep = isHeaderStep || isFooterStep
  const showSpotlight = Boolean(
    currentStep && targetRect && (isPinnedStep || visible.has(currentStep.id))
  )
  const canAdvance = Boolean(currentStep && (showSpotlight || isPinnedStep))
  const progress = explained.size
  const total = ONBOARDING_STEPS.length

  const startTour = useCallback(() => {
    setExplained(new Set())
    setVisible(new Set())
    setActive(true)
    scrollToTourStep(ONBOARDING_STEPS[0].id)
  }, [])

  useEffect(() => {
    if (!user) return

    if (restartKey > 0) {
      clearOnboardingDone(user.uid)
      startTour()
      return
    }

    if (!autoStart || isOnboardingDone(user.uid)) return

    const timer = window.setTimeout(startTour, 800)
    return () => window.clearTimeout(timer)
  }, [user, restartKey, autoStart, startTour])

  useEffect(() => {
    if (!active) return

    const observers: IntersectionObserver[] = []

    ONBOARDING_STEPS.forEach((step) => {
      const element = document.querySelector(`[data-tour="${step.id}"]`)
      if (!element) return

      const isHeader = HEADER_TOUR_STEP_IDS.has(step.id)
      const isFooter = FOOTER_TOUR_STEP_IDS.has(step.id)
      const observer = new IntersectionObserver(
        ([entry]) => {
          setVisible((previous) => {
            const next = new Set(previous)
            if (entry.isIntersecting) next.add(step.id)
            else if (!isHeader && !isFooter) next.delete(step.id)
            return next
          })
        },
        isHeader
          ? { threshold: 0.05, rootMargin: "0px" }
          : isFooter
            ? { threshold: 0.15, rootMargin: "0px 0px 0px 0px" }
            : { threshold: 0.25, rootMargin: "-4% 0px -6% 0px" }
      )

      observer.observe(element)
      observers.push(observer)
    })

    return () => observers.forEach((observer) => observer.disconnect())
  }, [active])

  const updateTargetRect = useCallback(() => {
    if (!currentStep) {
      setTargetRect(null)
      return
    }
    const element = document.querySelector(`[data-tour="${currentStep.id}"]`)
    setTargetRect(element ? element.getBoundingClientRect() : null)
  }, [currentStep])

  useEffect(() => {
    if (!active) return

    const markPinnedStepsVisible = () => {
      setVisible((previous) => {
        const next = new Set(previous)
        ;[...HEADER_TOUR_STEP_IDS, ...FOOTER_TOUR_STEP_IDS].forEach((stepId) => {
          if (document.querySelector(`[data-tour="${stepId}"]`)) {
            next.add(stepId)
          }
        })
        return next
      })
    }

    markPinnedStepsVisible()
    window.addEventListener("resize", markPinnedStepsVisible)
    return () => window.removeEventListener("resize", markPinnedStepsVisible)
  }, [active])

  useEffect(() => {
    if (!active || !currentStep) return
    updateTargetRect()
    window.addEventListener("scroll", updateTargetRect, true)
    window.addEventListener("resize", updateTargetRect)
    return () => {
      window.removeEventListener("scroll", updateTargetRect, true)
      window.removeEventListener("resize", updateTargetRect)
    }
  }, [active, currentStep, updateTargetRect])

  const finishTour = useCallback(() => {
    if (user) markOnboardingDone(user.uid)
    setActive(false)
  }, [user])

  const handleNext = () => {
    if (!currentStep || !user || !canAdvance) return

    const nextExplained = new Set(explained).add(currentStep.id)
    setExplained(nextExplained)

    if (nextExplained.size >= ONBOARDING_STEPS.length) {
      finishTour()
      return
    }

    const nextStep = ONBOARDING_STEPS.find((step) => !nextExplained.has(step.id))
    if (nextStep) {
      window.setTimeout(() => scrollToTourStep(nextStep.id), 200)
    }
  }

  if (!active || !user || !currentStep) return null

  const balloonStyle = targetRect
    ? getBalloonStyle(targetRect, showSpotlight)
    : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }

  return (
    <>
      {showSpotlight && targetRect && (
        <div
          className="fixed z-[280] pointer-events-none rounded-xl transition-all duration-300"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
            boxShadow: "0 0 0 9999px rgba(15, 20, 25, 0.62)",
          }}
        />
      )}

      {!canAdvance && pendingSteps.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[290] glass-card neon-border rounded-full px-4 py-2 text-xs text-muted-foreground flex items-center gap-2 shadow-lg">
          <ChevronDown className="w-4 h-4 text-primary animate-bounce" />
          Desça a página para ver o próximo item do tour
        </div>
      )}

      <div
        className="fixed z-[290] w-[min(92vw,340px)] glass-card neon-border rounded-2xl p-4 shadow-2xl transition-all duration-300"
        style={balloonStyle}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
            Tour guiado · {Math.min(progress + 1, total)}/{total}
          </span>
          <button
            type="button"
            onClick={finishTour}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Fechar tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <h3 className="text-base font-bold text-foreground mb-2">{currentStep.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          {currentStep.description}
        </p>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={finishTour}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Pular tour
          </button>
          <Button
            type="button"
            size="sm"
            onClick={handleNext}
            disabled={!canAdvance}
            className="rounded-lg neon-border"
          >
            {progress + 1 >= total ? "Concluir" : "Entendi"}
          </Button>
        </div>
      </div>
    </>
  )
}

function getBalloonStyle(rect: DOMRect, spotlight: boolean) {
  const margin = 16
  const balloonWidth = 340
  const balloonHeight = 220
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  let top = rect.bottom + margin
  let left = rect.left + rect.width / 2 - balloonWidth / 2

  if (top + balloonHeight > viewportHeight - margin) {
    top = rect.top - balloonHeight - margin
  }

  if (left < margin) left = margin
  if (left + balloonWidth > viewportWidth - margin) {
    left = viewportWidth - balloonWidth - margin
  }

  if (!spotlight || top < margin) {
    top = Math.min(viewportHeight - balloonHeight - margin, rect.bottom + margin)
  }

  return { top, left }
}
