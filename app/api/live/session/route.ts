import { GoogleGenAI, Modality } from "@google/genai"
import { NextResponse } from "next/server"

import { liveModelId, selectMappedAction } from "@/lib/gemini-live"

export const runtime = "nodejs"

function apiKey() {
  return process.env.LEXICON_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY
}

/**
 * Creates a single-use, constrained Live token. The browser receives no
 * long-lived Gemini key and cannot expand the model's action surface.
 */
export async function POST() {
  const key = apiKey()
  if (!key) {
    return NextResponse.json({ error: "Live voice is not configured." }, { status: 503 })
  }

  try {
    const ai = new GoogleGenAI({ apiKey: key, httpOptions: { apiVersion: "v1alpha" } })
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    const newSessionExpiresAt = new Date(Date.now() + 60 * 1000).toISOString()
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: expiresAt,
        newSessionExpireTime: newSessionExpiresAt,
        liveConnectConstraints: {
          model: liveModelId(),
          config: {
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction:
              "You are Lexicon, a real-time voice agent. Resolve product requests only by calling select_mapped_action. Never invent a route, selector, workflow, or action outside the developer-defined map. For actions requiring confirmation, explain the change and wait for the app to confirm it.",
            tools: [{ functionDeclarations: [selectMappedAction] }],
          },
        },
      },
    })

    if (!token.name) throw new Error("Gemini did not issue a Live token.")
    return NextResponse.json({ token: token.name, model: liveModelId(), expiresAt })
  } catch {
    return NextResponse.json(
      { error: "Live voice could not start. You can still use a typed command." },
      { status: 502 }
    )
  }
}
