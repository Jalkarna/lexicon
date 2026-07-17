import { NextResponse } from "next/server"

import { resolveWithGemini } from "@lexicon/sdk/gemini"
import {
  sanitizeLexiconManifest,
  sanitizeLexiconPendingContext,
} from "@lexicon/sdk"
import {
  agentModelId,
  geminiApiKey,
} from "@/rillwork/server"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => undefined)) as
    | { command?: unknown; manifest?: unknown; pending?: unknown }
    | undefined
  const command = typeof body?.command === "string" ? body.command.trim().slice(0, 1000) : ""
  if (!command) {
    return NextResponse.json({ error: "A command is required." }, { status: 400 })
  }

  const manifest = sanitizeLexiconManifest(body?.manifest)
  if (!manifest) {
    return NextResponse.json(
      { error: "A valid Lexicon capability manifest is required." },
      { status: 400 }
    )
  }
  const pending = sanitizeLexiconPendingContext(body?.pending, manifest)
  const resolution = await resolveWithGemini({
    apiKey: geminiApiKey(),
    command,
    manifest,
    pending,
    model: agentModelId(),
  })
  return NextResponse.json(resolution)
}
