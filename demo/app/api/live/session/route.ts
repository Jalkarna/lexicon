import { NextResponse } from "next/server"

import {
  createGeminiLiveToken,
  safeGeminiDiagnostic,
} from "@lexicon/sdk/gemini"
import {
  sanitizeLexiconManifest,
} from "@lexicon/sdk"
import {
  geminiApiKey,
  liveModelId,
} from "@/rillwork/server"

export const runtime = "nodejs"

/**
 * Creates a single-use Live token constrained to the capability manifest
 * supplied by the mounted SDK. Handlers and application data stay in the app.
 */
export async function POST(request: Request) {
  const key = geminiApiKey()
  if (!key) {
    return NextResponse.json({ error: "Live voice is not configured." }, { status: 503 })
  }

  const body = await request.json().catch(() => undefined)
  const manifest = sanitizeLexiconManifest(
    body && typeof body === "object" && "manifest" in body
      ? (body as { manifest?: unknown }).manifest
      : undefined
  )
  if (!manifest) {
    return NextResponse.json(
      { error: "A valid Lexicon capability manifest is required." },
      { status: 400 }
    )
  }

  try {
    const session = await createGeminiLiveToken({
      apiKey: key,
      manifest,
      model: liveModelId(),
    })
    return NextResponse.json(session)
  } catch (error) {
    const diagnostic = safeGeminiDiagnostic(error)
    console.error("[lexicon/live-session]", diagnostic)
    return NextResponse.json(
      { error: "Live voice could not start. You can still use a typed command.", diagnostic },
      { status: 502 }
    )
  }
}
