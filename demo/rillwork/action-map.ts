import {
  RILLWORK_BRAND,
  rillworkCapabilityDescriptors,
  type AppRoute,
} from "@/rillwork/capabilities"
import {
  resolveLexiconLocally,
  type LexiconCapabilityKind,
} from "@lexicon/sdk"

export type { AppRoute } from "@/rillwork/capabilities"

export type MappedAction = {
  id: string
  label: string
  route: AppRoute
  operation: LexiconCapabilityKind
  needsConfirmation: boolean
  selector: string
  description: string
  examples: string[]
}

const selectorOverrides: Record<string, string> = {
  "open-analytics": "[data-lexicon='analytics-nav']",
  "open-settings": "[data-lexicon='settings-nav']",
  "create-customer": "[data-lexicon='create-customer']",
  "show-orders-last-week": "[data-lexicon='orders-table']",
  "export-report": "[data-lexicon='export-report']",
  "create-invoice": "[data-lexicon='create-invoice']",
  "approve-request": "[data-lexicon='approval-request']",
}

export const mappedActions: MappedAction[] = rillworkCapabilityDescriptors.map((capability) => ({
  id: capability.id,
  label: capability.label,
  route: (capability.route ?? "overview") as AppRoute,
  operation: capability.kind,
  needsConfirmation: capability.confirmation === "always",
  selector: selectorOverrides[capability.id] ?? `[data-lexicon='${capability.id}']`,
  description: capability.description,
  examples: capability.examples ?? [capability.label],
}))

export function actionById(id: string) {
  return mappedActions.find((action) => action.id === id)
}

export function resolveVoiceCommand(command: string): MappedAction {
  const decision = resolveLexiconLocally(command, {
    app: RILLWORK_BRAND.appName,
    version: "1.0.0",
    capabilities: rillworkCapabilityDescriptors,
  })
  if ("call" in decision) {
    const normalizedId = decision.call.name.replace(/^lexicon_/, "").replaceAll("_", "-")
    const action = actionById(normalizedId)
    if (action) return action
  }
  return actionById("open-overview")!
}

export const lexiconManifest = {
  app: RILLWORK_BRAND.appName,
  version: "1.0.0",
  capabilities: rillworkCapabilityDescriptors,
}
