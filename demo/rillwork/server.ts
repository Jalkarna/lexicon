export function geminiApiKey() {
  return (
    process.env.LEXICON_GEMINI_API_KEY ??
    process.env.GOOGLE_API_KEY ??
    process.env.GEMINI_API_KEY
  )
}

export function liveModelId() {
  return (process.env.GEMINI_LIVE_MODEL ?? "gemini-3.1-flash-live-preview").replace(
    /^models\//,
    ""
  )
}

export function agentModelId() {
  return (process.env.GEMINI_AGENT_MODEL ?? "gemini-3.5-flash").replace(
    /^models\//,
    ""
  )
}
