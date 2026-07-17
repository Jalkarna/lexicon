import { GoogleGenAI } from "@google/genai"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

const MAX_AUDIO_BYTES = 8 * 1024 * 1024

function apiKey() {
  return process.env.LEXICON_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY
}

function safeTranscript(value: string | undefined) {
  return value
    ?.replace(/^\s*(?:transcript|command)\s*:\s*/i, "")
    .replace(/^['\"]|['\"]$/g, "")
    .trim()
    .slice(0, 500)
}

function hasVoiceSignal(bytes: Buffer) {
  // Lexicon's browser recorder produces 16-bit, mono PCM WAV. Reject an
  // all-silent clip before asking a generative transcription model to infer
  // words that were never spoken.
  if (bytes.length < 44 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WAVE") return false
  let dataOffset = 12
  let dataEnd = 0
  while (dataOffset + 8 <= bytes.length) {
    const chunkSize = bytes.readUInt32LE(dataOffset + 4)
    if (bytes.toString("ascii", dataOffset, dataOffset + 4) === "data") {
      dataOffset += 8
      dataEnd = Math.min(dataOffset + chunkSize, bytes.length)
      break
    }
    dataOffset += 8 + chunkSize + (chunkSize % 2)
  }
  if (!dataEnd || dataEnd - dataOffset < 3200) return false
  let peak = 0
  for (let offset = dataOffset; offset + 1 < dataEnd; offset += 2) {
    peak = Math.max(peak, Math.abs(bytes.readInt16LE(offset)))
    if (peak >= 500) return true
  }
  return false
}

/**
 * Browser audio stays in the request boundary: the client captures a short
 * WAV clip, this route transcribes it, and the existing mapped-action bridge
 * chooses the only action it may execute. No browser-control or selector
 * inference is involved.
 */
export async function POST(request: Request) {
  const key = apiKey()
  if (!key) {
    return NextResponse.json({ error: "Voice transcription is not configured." }, { status: 503 })
  }

  const form = await request.formData()
  const audio = form.get("audio")
  if (!(audio instanceof File)) {
    return NextResponse.json({ error: "An audio recording is required." }, { status: 400 })
  }
  if (!audio.size) {
    return NextResponse.json({ error: "The recording was empty. Please try again." }, { status: 400 })
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "Keep each voice command under 8 MB." }, { status: 413 })
  }
  if (audio.type && audio.type !== "audio/wav") {
    return NextResponse.json({ error: "Lexicon expects a WAV microphone recording." }, { status: 415 })
  }

  try {
    const bytes = Buffer.from(await audio.arrayBuffer())
    if (!hasVoiceSignal(bytes)) {
      return NextResponse.json({ error: "I could not hear a command. Please try again." }, { status: 422 })
    }
    const ai = new GoogleGenAI({ apiKey: key })
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_TRANSCRIBE_MODEL ?? "gemini-3.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                "Transcribe this short product command. Return only the spoken command, without a label, commentary, or invented details.",
            },
            { inlineData: { mimeType: "audio/wav", data: bytes.toString("base64") } },
          ],
        },
      ],
      config: { temperature: 0, maxOutputTokens: 160 },
    })
    const transcript = safeTranscript(response.text)
    if (!transcript) {
      return NextResponse.json({ error: "I could not hear a command. Please try again." }, { status: 422 })
    }
    return NextResponse.json({ transcript, provider: "gemini-audio" })
  } catch {
    return NextResponse.json(
      { error: "Voice transcription is temporarily unavailable. You can still type a command." },
      { status: 502 }
    )
  }
}
