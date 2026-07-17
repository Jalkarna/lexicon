export type LexiconCapabilityKind =
  | "navigate"
  | "read"
  | "create"
  | "update"
  | "delete"
  | "filter"
  | "export"
  | "approve"
  | "action"

export type LexiconFieldType =
  | "string"
  | "email"
  | "number"
  | "integer"
  | "boolean"
  | "date"
  | "enum"

export type LexiconInput = Record<string, unknown>

export type LexiconField = {
  name: string
  label: string
  description?: string
  type: LexiconFieldType
  required?: boolean
  options?: string[]
  placeholder?: string
}

export type LexiconCapabilityDescriptor = {
  id: string
  label: string
  description: string
  kind: LexiconCapabilityKind
  route?: string
  examples?: string[]
  fields?: LexiconField[]
  confirmation?: "never" | "always"
  confirmationMessage?: string
}

export type LexiconManifest = {
  app: string
  version: string
  capabilities: LexiconCapabilityDescriptor[]
}

export type LexiconPendingContext = {
  capabilityId: string
  status: "needs-input" | "needs-confirmation"
  input: LexiconInput
  missingFields?: string[]
}

export type LexiconToolDeclaration = {
  name: string
  description: string
  parametersJsonSchema: {
    type: "object"
    properties: Record<string, Record<string, unknown>>
    additionalProperties: false
    propertyOrdering: string[]
  }
}

export type LexiconAgentDecision =
  | { call: { name: string; args: LexiconInput }; message?: string }
  | { message: string }

const MAX_CAPABILITIES = 64
const MAX_FIELDS = 16
const MAX_STRING = 600

function cleanString(value: unknown, maxLength = MAX_STRING) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

function cleanId(value: unknown) {
  const id = cleanString(value, 80)
  return /^[a-z][a-z0-9-]*$/.test(id) ? id : ""
}

function cleanField(value: unknown): LexiconField | undefined {
  if (!value || typeof value !== "object") return undefined
  const candidate = value as Record<string, unknown>
  const name = cleanString(candidate.name, 64)
  const label = cleanString(candidate.label, 100)
  const type = cleanString(candidate.type, 20) as LexiconFieldType
  const supportedTypes: LexiconFieldType[] = [
    "string",
    "email",
    "number",
    "integer",
    "boolean",
    "date",
    "enum",
  ]
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name) || !label || !supportedTypes.includes(type)) {
    return undefined
  }
  const options = Array.isArray(candidate.options)
    ? candidate.options
        .map((option) => cleanString(option, 100))
        .filter(Boolean)
        .slice(0, 30)
    : undefined
  return {
    name,
    label,
    type,
    required: candidate.required === true,
    description: cleanString(candidate.description) || undefined,
    placeholder: cleanString(candidate.placeholder, 120) || undefined,
    options: options?.length ? options : undefined,
  }
}

function cleanCapability(value: unknown): LexiconCapabilityDescriptor | undefined {
  if (!value || typeof value !== "object") return undefined
  const candidate = value as Record<string, unknown>
  const id = cleanId(candidate.id)
  const label = cleanString(candidate.label, 120)
  const description = cleanString(candidate.description)
  const kind = cleanString(candidate.kind, 24) as LexiconCapabilityKind
  const supportedKinds: LexiconCapabilityKind[] = [
    "navigate",
    "read",
    "create",
    "update",
    "delete",
    "filter",
    "export",
    "approve",
    "action",
  ]
  if (!id || !label || !description || !supportedKinds.includes(kind)) return undefined

  const fields = Array.isArray(candidate.fields)
    ? candidate.fields
        .slice(0, MAX_FIELDS)
        .map(cleanField)
        .filter((field): field is LexiconField => Boolean(field))
    : undefined
  const examples = Array.isArray(candidate.examples)
    ? candidate.examples
        .map((example) => cleanString(example, 180))
        .filter(Boolean)
        .slice(0, 8)
    : undefined

  return {
    id,
    label,
    description,
    kind,
    route: cleanString(candidate.route, 100) || undefined,
    confirmation: candidate.confirmation === "always" ? "always" : "never",
    confirmationMessage: cleanString(candidate.confirmationMessage, 300) || undefined,
    fields: fields?.length ? fields : undefined,
    examples: examples?.length ? examples : undefined,
  }
}

export function sanitizeLexiconManifest(value: unknown): LexiconManifest | undefined {
  if (!value || typeof value !== "object") return undefined
  const candidate = value as Record<string, unknown>
  const app = cleanString(candidate.app, 120)
  const version = cleanString(candidate.version, 40) || "1.0.0"
  if (!app || !Array.isArray(candidate.capabilities)) return undefined

  const capabilities = candidate.capabilities
    .slice(0, MAX_CAPABILITIES)
    .map(cleanCapability)
    .filter((capability): capability is LexiconCapabilityDescriptor => Boolean(capability))
  const unique = new Map(capabilities.map((capability) => [capability.id, capability]))
  if (!unique.size) return undefined
  return { app, version, capabilities: Array.from(unique.values()) }
}

export function sanitizeLexiconPendingContext(
  value: unknown,
  manifest: LexiconManifest
): LexiconPendingContext | undefined {
  if (!value || typeof value !== "object") return undefined
  const candidate = value as Record<string, unknown>
  const capabilityId = cleanId(candidate.capabilityId)
  if (!manifest.capabilities.some((capability) => capability.id === capabilityId)) return undefined
  const status =
    candidate.status === "needs-confirmation"
      ? "needs-confirmation"
      : candidate.status === "needs-input"
        ? "needs-input"
        : undefined
  if (!status) return undefined
  const rawInput =
    candidate.input && typeof candidate.input === "object"
      ? (candidate.input as Record<string, unknown>)
      : {}
  const input = Object.fromEntries(
    Object.entries(rawInput)
      .slice(0, MAX_FIELDS)
      .filter(([key]) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key))
      .map(([key, item]) => [
        key,
        typeof item === "string" ? item.slice(0, 300) : item,
      ])
  )
  const missingFields = Array.isArray(candidate.missingFields)
    ? candidate.missingFields
        .map((field) => cleanString(field, 64))
        .filter((field) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field))
        .slice(0, MAX_FIELDS)
    : undefined
  return { capabilityId, status, input, missingFields }
}

export function toolNameForCapability(id: string) {
  const normalized = id.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/-/g, "_")
  return `lexicon_${normalized}`.slice(0, 128)
}

export function capabilityForToolName(manifest: LexiconManifest, name: string) {
  return manifest.capabilities.find((capability) => toolNameForCapability(capability.id) === name)
}

function fieldSchema(field: LexiconField) {
  const description = `${field.description ?? field.label}${field.required ? " Required." : " Optional."}`
  if (field.type === "number" || field.type === "integer") {
    return { type: field.type, description }
  }
  if (field.type === "boolean") return { type: "boolean", description }
  if (field.type === "enum") {
    return { type: "string", description, enum: field.options ?? [] }
  }
  return {
    type: "string",
    description,
    ...(field.type === "email" || field.type === "date" ? { format: field.type } : {}),
  }
}

export function buildLexiconToolDeclarations(manifest: LexiconManifest): LexiconToolDeclaration[] {
  return manifest.capabilities.map((capability) => {
    const properties = Object.fromEntries(
      (capability.fields ?? []).map((field) => [field.name, fieldSchema(field)])
    )
    const propertyOrdering = (capability.fields ?? []).map((field) => field.name)
    if (capability.confirmation === "always") {
      properties.confirmed = {
        type: "boolean",
        description:
          "Set true only after the runtime requested confirmation and the user explicitly confirmed in a later turn.",
      }
      propertyOrdering.push("confirmed")
    }
    const requiredFields = (capability.fields ?? [])
      .filter((field) => field.required)
      .map((field) => field.label)
    const description = [
      capability.description,
      capability.route ? `Surface: ${capability.route}.` : "",
      requiredFields.length
        ? `Call this function with whatever values the user already supplied. The runtime will request missing required fields: ${requiredFields.join(", ")}.`
        : "",
      capability.confirmation === "always"
        ? "This is guarded. The runtime will create a preview before execution."
        : "",
    ]
      .filter(Boolean)
      .join(" ")

    return {
      name: toolNameForCapability(capability.id),
      description,
      parametersJsonSchema: {
        type: "object",
        properties,
        additionalProperties: false,
        propertyOrdering,
      },
    }
  })
}

function pendingInstruction(manifest: LexiconManifest, pending?: LexiconPendingContext) {
  if (!pending) return ""
  const capability = manifest.capabilities.find((item) => item.id === pending.capabilityId)
  if (!capability) return ""
  if (pending.status === "needs-confirmation") {
    return `A ${capability.label} preview is awaiting confirmation. If the user explicitly confirms, call ${toolNameForCapability(capability.id)} with confirmed=true. If they decline, acknowledge cancellation and do not call a tool.`
  }
  const missing = (pending.missingFields ?? []).join(", ")
  return `The active workflow is ${capability.label}. Preserve the already collected values and call ${toolNameForCapability(capability.id)} with the user's new information. Missing fields: ${missing}.`
}

export function buildLexiconAgentInstruction(
  manifest: LexiconManifest,
  pending?: LexiconPendingContext
) {
  const catalog = manifest.capabilities
    .map((capability) => {
      const fields = (capability.fields ?? [])
        .map((field) => `${field.name}${field.required ? "*" : ""}`)
        .join(", ")
      return `- ${toolNameForCapability(capability.id)}: ${capability.label} [${capability.kind}]${fields ? ` fields: ${fields}` : ""}`
    })
    .join("\n")

  return `You are Lexicon, the embedded product agent for ${manifest.app}. You operate the application only through the supplied functions.

Rules:
1. For an actionable request, call the best matching function immediately with every value the user already supplied. Do not invent values.
2. The SDK validates fields. If a function response says needs-input, ask one concise question for the missing information and mention that the inline UI can also be used.
3. If a function response says needs-confirmation, summarize the preview and ask for a clear yes or no. Never set confirmed=true in the first call. Set it only after an explicit later confirmation.
4. Never claim an action succeeded until the function response says completed.
5. Use read functions for questions about application data. Report only data returned by a function.
6. Keep spoken responses short and direct.

Available capabilities:
${catalog}

${pendingInstruction(manifest, pending)}`.trim()
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9@.-]+/g, " ").trim()
}

function affirmative(value: string) {
  return /^(yes|yeah|yep|confirm|confirmed|do it|go ahead|proceed|approve|sure)\b/i.test(value.trim())
}

function negative(value: string) {
  return /^(no|nope|cancel|stop|never mind|nevermind|don't|do not)\b/i.test(value.trim())
}

function fieldValueFromText(command: string, field: LexiconField) {
  if (field.type === "email") {
    return command.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0]
  }
  if (field.type === "enum") {
    return field.options?.find((item) =>
      normalize(command).includes(normalize(item))
    )
  }
  if (field.type === "number" || field.type === "integer") {
    const number = command.match(/(?:^|\s|\$)(-?\d[\d,]*(?:\.\d+)?)(?=\s|$|[,.])/)
      ?.[1]
      ?.replaceAll(",", "")
    if (!number) return undefined
    const parsed = Number(number)
    if (!Number.isFinite(parsed)) return undefined
    if (field.type === "integer" && !Number.isInteger(parsed)) return undefined
    return parsed
  }
  if (field.type === "boolean") {
    if (/\b(true|yes|on|enabled?)\b/i.test(command)) return true
    if (/\b(false|no|off|disabled?)\b/i.test(command)) return false
    return undefined
  }
  if (field.type === "date") {
    return command.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0]
  }
  if (/id$/i.test(field.name)) {
    return command.match(/\b[A-Z]{2,}-\d+\b/i)?.[0]?.toUpperCase()
  }
  return undefined
}

function localInput(
  command: string,
  capability: LexiconCapabilityDescriptor,
  requestedFields = capability.fields ?? []
) {
  const input: LexiconInput = {}
  const unresolved: LexiconField[] = []
  for (const field of requestedFields) {
    const value = fieldValueFromText(command, field)
    if (value !== undefined) input[field.name] = value
    else unresolved.push(field)
  }

  const segments = command
    .split(/[,;\n]+/)
    .map((segment) => segment.trim())
    .filter(Boolean)
  const availableSegments = segments.filter(
    (segment) =>
      !Object.values(input).some(
        (value) =>
          typeof value === "string" &&
          normalize(segment).includes(normalize(value))
      )
  )
  const plainTextFields = unresolved.filter(
    (field) => field.type === "string"
  )
  if (plainTextFields.length === 1) {
    const value = availableSegments[0] ?? (
      requestedFields.length === 1 ? command.trim() : undefined
    )
    if (value) input[plainTextFields[0]!.name] = value
  } else if (
    plainTextFields.length > 1 &&
    availableSegments.length >= plainTextFields.length
  ) {
    plainTextFields.forEach((field, index) => {
      input[field.name] = availableSegments[index]
    })
  }
  return input
}

export function resolveLexiconLocally(
  command: string,
  manifest: LexiconManifest,
  pending?: LexiconPendingContext
): LexiconAgentDecision {
  if (pending) {
    const capability = manifest.capabilities.find((item) => item.id === pending.capabilityId)
    if (capability && pending.status === "needs-confirmation") {
      if (negative(command)) return { message: `${capability.label} was cancelled.` }
      if (affirmative(command)) {
        return {
          call: {
            name: toolNameForCapability(capability.id),
            args: { ...pending.input, confirmed: true },
          },
        }
      }
    }
    if (capability && pending.status === "needs-input") {
      const missing = pending.missingFields ?? []
      const missingFields = (capability.fields ?? []).filter((field) =>
        missing.includes(field.name)
      )
      const args = {
        ...pending.input,
        ...localInput(command, capability, missingFields),
      }
      return { call: { name: toolNameForCapability(capability.id), args } }
    }
  }

  const words = new Set(normalize(command).split(" ").filter((word) => word.length > 2))
  let best: { capability: LexiconCapabilityDescriptor; score: number } | undefined
  for (const capability of manifest.capabilities) {
    const haystack = normalize(
      [
        capability.id,
        capability.label,
        capability.description,
        capability.kind,
        capability.route,
        ...(capability.examples ?? []),
      ].join(" ")
    )
    let score = 0
    for (const word of words) if (haystack.includes(word)) score += word.length
    if (normalize(command).includes(normalize(capability.label))) score += 20
    if (!best || score > best.score) best = { capability, score }
  }
  if (!best || best.score < 4) {
    return { message: "I could not match that request to a registered product capability." }
  }
  return {
    call: {
      name: toolNameForCapability(best.capability.id),
      args: localInput(command, best.capability),
    },
  }
}
