import {
  FunctionCallingConfigMode,
  GoogleGenAI,
  Modality,
  type FunctionDeclaration,
} from "@google/genai"

import {
  buildLexiconAgentInstruction,
  buildLexiconToolDeclarations,
  resolveLexiconLocally,
  toolNameForCapability,
  type LexiconAgentDecision,
  type LexiconManifest,
  type LexiconPendingContext,
} from "./core.js"

export type GeminiAgentResolution = LexiconAgentDecision & {
  provider: "gemini-tools" | "lexicon-local"
  diagnostic?: string
}

export type ResolveWithGeminiOptions = {
  apiKey?: string
  command: string
  manifest: LexiconManifest
  pending?: LexiconPendingContext
  model?: string
}

export type CreateGeminiLiveTokenOptions = {
  apiKey: string
  manifest: LexiconManifest
  model?: string
  tokenTtlMs?: number
  connectionWindowMs?: number
}

function normalizedModel(model: string) {
  return model.replace(/^models\//, "")
}

export function safeGeminiDiagnostic(value: unknown) {
  const message =
    value instanceof Error
      ? value.message
      : typeof value === "object" && value && "message" in value
        ? String(value.message)
        : typeof value === "string"
          ? value
          : "Gemini could not resolve the request."

  if (/api key|credential|authentication|permission/i.test(message)) {
    return "Gemini rejected the configured server-side credential."
  }
  if (/model|not found|unsupported/i.test(message)) {
    return "Gemini rejected the configured model."
  }
  if (/quota|rate limit|resource exhausted/i.test(message)) {
    return "Gemini is currently rate limited."
  }
  return "Gemini is temporarily unavailable."
}

export async function resolveWithGemini({
  apiKey,
  command,
  manifest,
  pending,
  model = "gemini-3.5-flash",
}: ResolveWithGeminiOptions): Promise<GeminiAgentResolution> {
  if (!apiKey) {
    return {
      ...resolveLexiconLocally(command, manifest, pending),
      provider: "lexicon-local",
      diagnostic: "Using the local capability resolver.",
    }
  }

  try {
    const declarations = buildLexiconToolDeclarations(
      manifest
    ) as FunctionDeclaration[]
    const pendingTool = pending
      ? toolNameForCapability(pending.capabilityId)
      : undefined
    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({
      model: normalizedModel(model),
      contents: command,
      config: {
        systemInstruction: buildLexiconAgentInstruction(manifest, pending),
        temperature: 0,
        tools: [{ functionDeclarations: declarations }],
        toolConfig: {
          functionCallingConfig: {
            mode:
              pending?.status === "needs-confirmation"
                ? FunctionCallingConfigMode.VALIDATED
                : FunctionCallingConfigMode.ANY,
            ...(pendingTool ? { allowedFunctionNames: [pendingTool] } : {}),
          },
        },
      },
    })
    const call = response.functionCalls?.[0]
    if (call?.name) {
      return {
        call: { name: call.name, args: call.args ?? {} },
        provider: "gemini-tools",
      }
    }
    return {
      message: response.text?.trim() || "I need a little more detail to choose a product capability.",
      provider: "gemini-tools",
    }
  } catch (error) {
    return {
      ...resolveLexiconLocally(command, manifest, pending),
      provider: "lexicon-local",
      diagnostic: safeGeminiDiagnostic(error),
    }
  }
}

export async function createGeminiLiveToken({
  apiKey,
  manifest,
  model = "gemini-3.1-flash-live-preview",
  tokenTtlMs = 15 * 60 * 1000,
  connectionWindowMs = 60 * 1000,
}: CreateGeminiLiveTokenOptions) {
  const liveModel = normalizedModel(model)
  const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: "v1alpha" } })
  const expiresAt = new Date(Date.now() + tokenTtlMs).toISOString()
  const newSessionExpiresAt = new Date(Date.now() + connectionWindowMs).toISOString()
  const token = await ai.authTokens.create({
    config: {
      uses: 1,
      expireTime: expiresAt,
      newSessionExpireTime: newSessionExpiresAt,
      liveConnectConstraints: {
        model: liveModel,
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: buildLexiconAgentInstruction(manifest),
          tools: [
            {
              functionDeclarations: buildLexiconToolDeclarations(manifest),
            },
          ],
        },
      },
    },
  })

  if (!token.name) throw new Error("Gemini did not issue a Live token.")
  return {
    token: token.name,
    model: liveModel,
    expiresAt,
    capabilityCount: manifest.capabilities.length,
  }
}
