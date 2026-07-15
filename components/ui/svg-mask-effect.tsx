"use client"

import {
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

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
  const [isRevealing, setIsRevealing] = useState(false)
  const revealRef = useRef<HTMLDivElement>(null)
  const positionRef = useRef({ x: 0, y: 0 })
  const frameRef = useRef<number | null>(null)
  const maskSize = isRevealing ? revealSize : size

  const updateMaskPosition = useCallback(() => {
    frameRef.current = null
    const reveal = revealRef.current
    if (!reveal) return

    const { x, y } = positionRef.current
    const offset = maskSize / 2
    const position = `${x - offset}px ${y - offset}px`
    reveal.style.maskPosition = position
    reveal.style.webkitMaskPosition = position
  }, [maskSize])

  function updatePosition(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    positionRef.current = { x: event.clientX - bounds.left, y: event.clientY - bounds.top }

    if (frameRef.current === null) {
      frameRef.current = window.requestAnimationFrame(updateMaskPosition)
    }
  }

  useEffect(() => {
    updateMaskPosition()
  }, [updateMaskPosition])

  useEffect(() => () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
  }, [])

  return (
    <div
      className={cn("mask-container", className)}
      tabIndex={0}
      onPointerEnter={(event) => {
        updatePosition(event)
        setIsRevealing(true)
      }}
      onPointerMove={updatePosition}
      onPointerLeave={() => setIsRevealing(false)}
      onFocus={() => setIsRevealing(true)}
      onBlur={() => setIsRevealing(false)}
    >
      <div className="mask-container__base">{revealText}</div>
      <div
        ref={revealRef}
        className="mask-container__reveal"
        style={
          {
            maskSize: `${maskSize}px`,
            WebkitMaskSize: `${maskSize}px`,
          } as CSSProperties
        }
      >
        {children}
      </div>
    </div>
  )
}
