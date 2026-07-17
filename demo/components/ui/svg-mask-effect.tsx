"use client"

import {
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
} from "react"
import {
  animate,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from "motion/react"

import { cn } from "@/lib/utils"

type MaskContainerProps = {
  children: ReactNode
  revealText: ReactNode
  size?: number
  revealSize?: number
  className?: string
}

/**
 * Aceternity's SVG mask interaction, pared back to a reusable two-layer surface.
 * The top layer only exists under the cursor, so it works well for showing an
 * underlying system without making that system a separate card or modal.
 */
export function MaskContainer({
  children,
  revealText,
  size = 18,
  revealSize = 600,
  className,
}: MaskContainerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const revealRef = useRef<HTMLDivElement>(null)
  const positionRef = useRef({ x: 0, y: 0 })
  const frameRef = useRef<number | null>(null)
  const animationRef = useRef<ReturnType<typeof animate> | null>(null)
  const currentSizeRef = useRef(size)
  const shouldReduceMotion = useReducedMotion()
  const animatedSize = useMotionValue(size)

  const applyMask = useCallback((latestSize = currentSizeRef.current) => {
    frameRef.current = null
    const reveal = revealRef.current
    if (!reveal) return

    const { x, y } = positionRef.current
    const position = `${x - latestSize / 2}px ${y - latestSize / 2}px`

    reveal.style.maskSize = `${latestSize}px`
    reveal.style.webkitMaskSize = `${latestSize}px`
    reveal.style.maskPosition = position
    reveal.style.webkitMaskPosition = position
  }, [])

  useMotionValueEvent(animatedSize, "change", (latestSize) => {
    currentSizeRef.current = latestSize
    applyMask(latestSize)
  })

  const updateRevealState = useCallback(
    (nextState: boolean) => {
      const nextSize = nextState ? revealSize : size
      const currentSize = animatedSize.get()
      const fullDistance = Math.max(1, revealSize - size)
      const remainingDistance = Math.abs(nextSize - currentSize) / fullDistance

      wrapperRef.current?.setAttribute("data-revealing", String(nextState))
      animationRef.current?.stop()

      if (shouldReduceMotion) {
        animatedSize.jump(nextSize)
        currentSizeRef.current = nextSize
        applyMask(nextSize)
        return
      }

      animationRef.current = animate(animatedSize, nextSize, {
        duration: Math.max(0.08, (nextState ? 0.28 : 0.18) * remainingDistance),
        ease: [0.23, 1, 0.32, 1],
      })
    },
    [animatedSize, applyMask, revealSize, shouldReduceMotion, size],
  )

  function updatePosition(event: PointerEvent<HTMLDivElement>, immediate = false) {
    const bounds = event.currentTarget.getBoundingClientRect()
    positionRef.current = { x: event.clientX - bounds.left, y: event.clientY - bounds.top }

    if (immediate) {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
      applyMask()
      return
    }

    if (frameRef.current === null) {
      frameRef.current = window.requestAnimationFrame(() => applyMask())
    }
  }

  function centerMask(target: HTMLDivElement) {
    const bounds = target.getBoundingClientRect()
    positionRef.current = { x: bounds.width / 2, y: bounds.height / 2 }
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
    applyMask()
  }

  useEffect(() => () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
    animationRef.current?.stop()
  }, [])

  return (
    <div
      ref={wrapperRef}
      className={cn("mask-container", className)}
      data-revealing="false"
      tabIndex={0}
      onPointerEnter={(event) => {
        updatePosition(event, true)
        updateRevealState(true)
      }}
      onPointerMove={updatePosition}
      onPointerLeave={() => updateRevealState(false)}
      onFocus={(event) => {
        centerMask(event.currentTarget)
        updateRevealState(true)
      }}
      onBlur={() => updateRevealState(false)}
    >
      <div className="mask-container__base">{revealText}</div>
      <div
        ref={revealRef}
        className="mask-container__reveal"
        style={{ maskSize: `${size}px`, WebkitMaskSize: `${size}px` }}
      >
        {children}
      </div>
    </div>
  )
}
