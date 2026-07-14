import { GoogleGenAI, Modality, type FunctionDeclaration } from "@google/genai"

import { actionById, mappedActions, type MappedAction } from "@/lib/lexicon"

export type GeminiLiveResolution = {
  action?: MappedAction
  status: "selected" | "no-tool-call" | "timeout" | "unavailable"
  diagnostic?: string
}

function lexiconApiKey() {
  return process.env.LEXICON_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY
}

export const selectMappedAction: FunctionDeclaration = {
  name: "select_mapped_action",
  description:
    "Select one mapped Lexicon action. Never browse, infer a CSS selector, or create an action outside this list.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      actionId: { type: "string", enum: mappedActions.map((action) => action.id) },
    },
    required: ["actionId"],
  },
}

/**
 * Server-only Gemini Live connection configuration. A production transport can
 * forward browser audio to this session without exposing GEMINI_API_KEY.
 */
export function createLexiconLiveSession(callbacks: Parameters<GoogleGenAI["live"]["connect"]>[0]["callbacks"]) {
  const apiKey = lexiconApiKey()
  if (!apiKey) throw new Error("LEXICON_GEMINI_API_KEY or GEMINI_API_KEY is required for Gemini Live.")

  const ai = new GoogleGenAI({ apiKey })
  return ai.live.connect({
    model: liveModelName(),
    callbacks,
    config: {
      responseModalities: [Modality.AUDIO],
      systemInstruction:
        "You are Lexicon, a voice agent. Resolve requests only by calling select_mapped_action. Ask for clarification if no mapped action fits.",
      tools: [{ functionDeclarations: [selectMappedAction] }],
    },
  })
}

export function liveModelId() {
  const model = process.env.GEMINI_LIVE_MODEL ?? "gemini-3.1-flash-live-preview"
  return model.replace(/^models\//, "")
}

function liveModelName() {
  return `models/${liveModelId()}`
}

/**
 * Single-turn live resolver used by the HTTP bridge. It waits for Gemini's
 * native tool call, validates its id against the lexicon, then closes the
 * ephemeral session. The action itself is still executed by the mapped runtime.
 */
function safeDiagnostic(value: unknown) {
  const message =
    value instanceof Error
      ? value.message
      : typeof value === "object" && value && "message" in value
        ? String(value.message)
        : typeof value === "string"
          ? value
          : "Gemini Live could not establish a session."

  if (/api key|credential|authentication/i.test(message)) {
    return "Gemini rejected the configured server-side credential."
  }
  if (/model|not found|unsupported/i.test(message)) {
    return "Gemini rejected the configured Live model."
  }
  return "Gemini Live is temporarily unavailable."
}

export async function resolveWithGeminiLive(
  command: string,
  timeoutMs = 6500
): Promise<GeminiLiveResolution> {
  return new Promise((resolve) => {
    let session: Awaited<ReturnType<typeof createLexiconLiveSession>> | undefined
    let settled = false

    const finish = (result: GeminiLiveResolution) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      session?.close()
      resolve(result)
    }

    const timer = setTimeout(
      () => finish({ status: "timeout", diagnostic: "Gemini Live did not return an action before the timeout." }),
      timeoutMs
    )

    createLexiconLiveSession({
      onmessage: (message) => {
        const toolCall = message.toolCall?.functionCalls?.find(
          (call) => call.name === "select_mapped_action"
        )
        const actionId = toolCall?.args?.actionId
        if (typeof actionId === "string") {
          const action = actionById(actionId)
          if (action && toolCall) {
            session?.sendToolResponse({
              functionResponses: [
                {
                  id: toolCall.id,
                  name: toolCall.name,
                  response: { result: `Mapped action ${action.id} selected.` },
                },
              ],
            })
          }
          finish(
            action
              ? { status: "selected", action }
              : { status: "no-tool-call", diagnostic: "Gemini selected an action outside the developer map." }
          )
          return
        }

        if (message.serverContent?.turnComplete) {
          finish({ status: "no-tool-call", diagnostic: "Gemini completed without calling the mapped action tool." })
        }
      },
      onerror: (event) => finish({ status: "unavailable", diagnostic: safeDiagnostic(event) }),
      onclose: (event) => finish({ status: "unavailable", diagnostic: safeDiagnostic(event.reason) }),
    })
      .then((connectedSession) => {
        session = connectedSession
        session.sendRealtimeInput({
          text: `Voice command: ${command}\n\nCall select_mapped_action with the one matching developer-defined action id.`,
        })
      })
      .catch((error) => finish({ status: "unavailable", diagnostic: safeDiagnostic(error) }))
  })
}
