import {
  capabilityForToolName,
  type LexiconCapabilityDescriptor,
  type LexiconField,
  type LexiconInput,
  type LexiconManifest,
  type LexiconPendingContext,
} from "./core.js"

export type LexiconHandlerResult = {
  message?: string
  data?: unknown
}

export type LexiconCapabilityContext = {
  capability: LexiconCapabilityDescriptor
  input: LexiconInput
  source: "manual" | "typed" | "live" | "ui"
}

export type LexiconCapabilityRegistration = LexiconCapabilityDescriptor & {
  handler: (
    context: LexiconCapabilityContext
  ) => LexiconHandlerResult | void | Promise<LexiconHandlerResult | void>
  preview?: (input: LexiconInput) => string
  validate?: (
    input: LexiconInput
  ) => { fields: string[]; message: string } | undefined
}

export type LexiconPendingExecution = LexiconPendingContext & {
  capability: LexiconCapabilityDescriptor
  preview?: string
}

export type LexiconExecutionResult = {
  status: "completed" | "needs-input" | "needs-confirmation" | "cancelled" | "failed"
  capability?: LexiconCapabilityDescriptor
  input?: LexiconInput
  missingFields?: LexiconField[]
  preview?: string
  message: string
  data?: unknown
}

export type LexiconRuntime = {
  manifest: () => LexiconManifest
  register: (capability: LexiconCapabilityRegistration) => void
  invoke: (
    capabilityId: string,
    input?: LexiconInput,
    options?: { source?: LexiconCapabilityContext["source"]; confirmed?: boolean }
  ) => Promise<LexiconExecutionResult>
  invokeToolCall: (
    name: string,
    args?: LexiconInput,
    options?: { source?: LexiconCapabilityContext["source"] }
  ) => Promise<LexiconExecutionResult>
  continuePending: (input: LexiconInput) => Promise<LexiconExecutionResult>
  confirmPending: (input?: LexiconInput) => Promise<LexiconExecutionResult>
  cancelPending: () => LexiconExecutionResult
  pending: () => LexiconPendingExecution | null
  pendingContext: () => LexiconPendingContext | undefined
  functionResponse: (result: LexiconExecutionResult) => Record<string, unknown>
}

function isEmpty(value: unknown) {
  return value === undefined || value === null || (typeof value === "string" && !value.trim())
}

function coerceField(field: LexiconField, value: unknown) {
  if (isEmpty(value)) return undefined
  if (
    typeof value === "object" ||
    typeof value === "function" ||
    typeof value === "symbol"
  ) {
    return undefined
  }
  if (field.type === "number" || field.type === "integer") {
    const number = typeof value === "number" ? value : Number(String(value).replace(/[$,]/g, ""))
    if (!Number.isFinite(number)) return undefined
    if (field.type === "integer" && !Number.isInteger(number)) return undefined
    return number
  }
  if (field.type === "boolean") {
    if (typeof value === "boolean") return value
    if (/^(true|yes|on|1)$/i.test(String(value))) return true
    if (/^(false|no|off|0)$/i.test(String(value))) return false
    return undefined
  }
  const string = String(value).trim()
  if (field.type === "enum") {
    return field.options?.find((option) => option.toLowerCase() === string.toLowerCase())
  }
  if (
    field.type === "email" &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(string)
  ) {
    return undefined
  }
  if (field.type === "date" && Number.isNaN(Date.parse(string))) {
    return undefined
  }
  return string
}

function descriptor(capability: LexiconCapabilityRegistration): LexiconCapabilityDescriptor {
  const {
    id,
    label,
    description,
    kind,
    route,
    examples,
    fields,
    confirmation,
    confirmationMessage,
  } = capability
  return {
    id,
    label,
    description,
    kind,
    route,
    examples,
    fields,
    confirmation: confirmation ?? "never",
    confirmationMessage,
  }
}

function defaultPreview(capability: LexiconCapabilityDescriptor, input: LexiconInput) {
  const values = (capability.fields ?? [])
    .filter((field) => !isEmpty(input[field.name]))
    .map((field) => `${field.label}: ${String(input[field.name])}`)
  return values.length
    ? `${capability.label}\n${values.join("\n")}`
    : capability.confirmationMessage ?? capability.description
}

export function createLexiconRuntime(options: {
  app: string
  version?: string
  capabilities?: LexiconCapabilityRegistration[]
}): LexiconRuntime {
  const capabilities = new Map<string, LexiconCapabilityRegistration>()
  let pendingExecution: LexiconPendingExecution | null = null
  for (const capability of options.capabilities ?? []) capabilities.set(capability.id, capability)

  function manifest(): LexiconManifest {
    return {
      app: options.app,
      version: options.version ?? "1.0.0",
      capabilities: Array.from(capabilities.values()).map(descriptor),
    }
  }

  function register(capability: LexiconCapabilityRegistration) {
    capabilities.set(capability.id, capability)
  }

  async function invoke(
    capabilityId: string,
    input: LexiconInput = {},
    invokeOptions: {
      source?: LexiconCapabilityContext["source"]
      confirmed?: boolean
    } = {}
  ): Promise<LexiconExecutionResult> {
    const registration = capabilities.get(capabilityId)
    if (!registration) {
      return { status: "failed", message: `Unknown Lexicon capability: ${capabilityId}` }
    }
    const capability = descriptor(registration)
    const merged =
      pendingExecution?.capabilityId === capabilityId
        ? { ...pendingExecution.input, ...input }
        : { ...input }
    delete merged.confirmed

    const normalized: LexiconInput = {}
    for (const field of capability.fields ?? []) {
      const value = coerceField(field, merged[field.name])
      if (value !== undefined) normalized[field.name] = value
    }
    const missingFields = (capability.fields ?? []).filter(
      (field) => field.required && isEmpty(normalized[field.name])
    )
    if (missingFields.length) {
      pendingExecution = {
        capabilityId,
        capability,
        status: "needs-input",
        input: normalized,
        missingFields: missingFields.map((field) => field.name),
      }
      return {
        status: "needs-input",
        capability,
        input: normalized,
        missingFields,
        message: `I need ${missingFields.map((field) => field.label).join(", ")} before I can ${capability.label.toLowerCase()}.`,
      }
    }
    const validation = registration.validate?.(normalized)
    if (validation) {
      const requestedFields = (capability.fields ?? []).filter((field) =>
        validation.fields.includes(field.name)
      )
      pendingExecution = {
        capabilityId,
        capability,
        status: "needs-input",
        input: normalized,
        missingFields: requestedFields.map((field) => field.name),
      }
      return {
        status: "needs-input",
        capability,
        input: normalized,
        missingFields: requestedFields,
        message: validation.message,
      }
    }

    if (capability.confirmation === "always") {
      const hasPendingPreview =
        pendingExecution?.capabilityId === capabilityId &&
        pendingExecution.status === "needs-confirmation"
      if (!invokeOptions.confirmed || !hasPendingPreview) {
        const preview = registration.preview?.(normalized) ?? defaultPreview(capability, normalized)
        pendingExecution = {
          capabilityId,
          capability,
          status: "needs-confirmation",
          input: normalized,
          preview,
        }
        return {
          status: "needs-confirmation",
          capability,
          input: normalized,
          preview,
          message:
            capability.confirmationMessage ??
            `${capability.label} is ready. Confirm verbally or use the button to continue.`,
        }
      }
    }

    try {
      const output = await registration.handler({
        capability,
        input: normalized,
        source: invokeOptions.source ?? "typed",
      })
      pendingExecution = null
      return {
        status: "completed",
        capability,
        input: normalized,
        message: output?.message ?? `${capability.label} completed.`,
        data: output?.data,
      }
    } catch (error) {
      return {
        status: "failed",
        capability,
        input: normalized,
        message: error instanceof Error ? error.message : `${capability.label} failed.`,
      }
    }
  }

  async function invokeToolCall(
    name: string,
    args: LexiconInput = {},
    invokeOptions: { source?: LexiconCapabilityContext["source"] } = {}
  ) {
    const capability = capabilityForToolName(manifest(), name)
    if (!capability) {
      return { status: "failed", message: `Unknown Lexicon tool: ${name}` } satisfies LexiconExecutionResult
    }
    const confirmed = args.confirmed === true
    return invoke(capability.id, args, {
      source: invokeOptions.source ?? "live",
      confirmed,
    })
  }

  function continuePending(input: LexiconInput) {
    if (!pendingExecution) {
      return Promise.resolve({
        status: "failed",
        message: "There is no pending Lexicon action.",
      } satisfies LexiconExecutionResult)
    }
    return invoke(pendingExecution.capabilityId, input, { source: "ui" })
  }

  function confirmPending(input: LexiconInput = {}) {
    if (!pendingExecution || pendingExecution.status !== "needs-confirmation") {
      return Promise.resolve({
        status: "failed",
        message: "There is no action awaiting confirmation.",
      } satisfies LexiconExecutionResult)
    }
    return invoke(pendingExecution.capabilityId, { ...pendingExecution.input, ...input }, {
      source: "ui",
      confirmed: true,
    })
  }

  function cancelPending(): LexiconExecutionResult {
    const capability = pendingExecution?.capability
    pendingExecution = null
    return {
      status: "cancelled",
      capability,
      message: capability ? `${capability.label} was cancelled.` : "Pending action cancelled.",
    }
  }

  function pending() {
    return pendingExecution
      ? {
          ...pendingExecution,
          input: { ...pendingExecution.input },
          missingFields: pendingExecution.missingFields
            ? [...pendingExecution.missingFields]
            : undefined,
        }
      : null
  }

  function pendingContext(): LexiconPendingContext | undefined {
    if (!pendingExecution) return undefined
    return {
      capabilityId: pendingExecution.capabilityId,
      status: pendingExecution.status,
      input: { ...pendingExecution.input },
      missingFields: pendingExecution.missingFields
        ? [...pendingExecution.missingFields]
        : undefined,
    }
  }

  function functionResponse(result: LexiconExecutionResult) {
    return {
      status: result.status,
      message: result.message,
      missingFields: result.missingFields?.map((field) => ({
        name: field.name,
        label: field.label,
        description: field.description,
      })),
      preview: result.preview,
      data: result.data,
    }
  }

  return {
    manifest,
    register,
    invoke,
    invokeToolCall,
    continuePending,
    confirmPending,
    cancelPending,
    pending,
    pendingContext,
    functionResponse,
  }
}

export const mountLexicon = createLexiconRuntime
