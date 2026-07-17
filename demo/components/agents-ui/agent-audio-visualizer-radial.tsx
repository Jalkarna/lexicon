"use client"

import { cn } from "@/lib/utils"

type AgentAudioVisualizerRadialProps = {
  size?: "sm" | "md" | "lg" | "xl"
  color?: string
  barCount?: number
  radius?: number
  state?: "idle" | "listening" | "speaking"
  className?: string
}

const sizeMap = { sm: 88, md: 120, lg: 152, xl: 184 }

export function AgentAudioVisualizerRadial({
  size = "md",
  color = "#d5ff5f",
  barCount = 24,
  radius = 60,
  state = "idle",
  className,
}: AgentAudioVisualizerRadialProps) {
  const center = 100
  const intensity = state === "speaking" ? 1 : state === "listening" ? 0.62 : 0.25

  return (
    <svg
      aria-hidden
      className={cn("agent-audio-visualizer-radial", className)}
      fill="none"
      height={sizeMap[size]}
      viewBox="0 0 200 200"
      width={sizeMap[size]}
    >
      {Array.from({ length: barCount }, (_, index) => {
        const rotation = (index / barCount) * 360
        const variation = 0.45 + ((Math.sin(index * 1.73) + 1) / 2) * 0.55
        const length = 13 + variation * 22 * intensity
        const innerY = center - radius
        const outerY = innerY - length
        const animatedOuterY = (outerY - 10 * variation).toFixed(2)
        const stableOuterY = outerY.toFixed(2)

        return (
          <line
            key={index}
            stroke={color}
            strokeLinecap="round"
            strokeOpacity={0.34 + variation * 0.56}
            strokeWidth={2}
            transform={`rotate(${rotation} ${center} ${center})`}
            x1={center}
            x2={center}
            y1={innerY.toFixed(2)}
            y2={stableOuterY}
          >
            {state === "speaking" && (
              <animate
                attributeName="y2"
                dur={`${1.15 + (index % 5) * 0.13}s`}
                repeatCount="indefinite"
                values={`${stableOuterY};${animatedOuterY};${stableOuterY}`}
              />
            )}
          </line>
        )
      })}
      <circle cx={center} cy={center} r={radius - 11} stroke={color} strokeOpacity="0.22" />
      <circle cx={center} cy={center} r="3" fill={color} />
    </svg>
  )
}
