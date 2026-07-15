"use client"

import { cn } from "@/lib/utils"

type AgentAudioVisualizerBarProps = {
  size?: "sm" | "md" | "lg" | "xl"
  color?: string
  state?: "idle" | "listening" | "speaking"
  className?: string
}

const sizeMap = { sm: 76, md: 104, lg: 136, xl: 168 }
const barHeights = [0.28, 0.46, 0.72, 0.98, 0.62, 0.36, 0.54, 0.86, 0.66, 0.4, 0.76, 0.5]

export function AgentAudioVisualizerBar({
  size = "md",
  color = "#d5ff5f",
  state = "idle",
  className,
}: AgentAudioVisualizerBarProps) {
  const intensity = state === "speaking" ? 1 : state === "listening" ? 0.55 : 0.22
  const height = sizeMap[size]

  return (
    <svg
      aria-hidden
      className={cn("agent-audio-visualizer-bar", className)}
      fill="none"
      height={height}
      viewBox="0 0 180 180"
      width={height}
    >
      {barHeights.map((baseHeight, index) => {
        const x = 29 + index * 11.1
        const barHeight = 18 + baseHeight * 74 * intensity
        const top = 90 - barHeight / 2
        const bottom = 90 + barHeight / 2

        return (
          <line
            key={index}
            stroke={color}
            strokeLinecap="round"
            strokeOpacity={0.34 + baseHeight * 0.62}
            strokeWidth={3}
            x1={x.toFixed(2)}
            x2={x.toFixed(2)}
            y1={top.toFixed(2)}
            y2={bottom.toFixed(2)}
          >
            {state === "speaking" && (
              <animate
                attributeName="y1"
                dur={`${0.86 + (index % 4) * 0.14}s`}
                repeatCount="indefinite"
                values={`${top.toFixed(2)};${(top - baseHeight * 16).toFixed(2)};${top.toFixed(2)}`}
              />
            )}
          </line>
        )
      })}
    </svg>
  )
}
