import { NextResponse } from "next/server"

import { resolveWithGeminiLive } from "@/lib/gemini-live"
import { resolveVoiceCommand } from "@/lib/lexicon"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const body = (await request.json()) as { command?: string }
  const command = body.command?.trim()

  if (!command) {
    return NextResponse.json({ error: "A voice command is required." }, { status: 400 })
  }

  const deterministicAction = resolveVoiceCommand(command)
  const apiKey = process.env.LEXICON_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY

  if (!apiKey) {
    return NextResponse.json({
      action: deterministicAction,
      provider: "lexicon-map",
      note: "Using the local developer-defined action map.",
    })
  }

  try {
    const live = await resolveWithGeminiLive(command)

    return NextResponse.json({
      action: live.action ?? deterministicAction,
      provider: live.action ? "gemini-live-tools" : "lexicon-map",
      note: live.action
        ? "Gemini Live selected a developer-defined action through native tool calling."
        : "Lexicon used its deterministic developer-defined action map.",
      diagnostic: live.diagnostic,
    })
  } catch {
    return NextResponse.json({
      action: deterministicAction,
      provider: "lexicon-map",
      note: "The AI provider was unavailable, so Lexicon used its deterministic action map.",
    })
  }
}
