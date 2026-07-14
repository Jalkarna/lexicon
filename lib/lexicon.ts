export type AppRoute =
  | "overview"
  | "analytics"
  | "customers"
  | "orders"
  | "invoices"
  | "settings"
  | "notifications"
  | "profile"
  | "console"

export type MappedAction = {
  id: string
  label: string
  route: AppRoute
  operation: "navigate" | "create" | "filter" | "export" | "approve"
  needsConfirmation: boolean
  selector: string
  description: string
  examples: string[]
}

export const mappedActions: MappedAction[] = [
  {
    id: "open-analytics",
    label: "View analytics",
    route: "analytics",
    operation: "navigate",
    needsConfirmation: false,
    selector: "[data-lexicon='analytics-nav']",
    description: "Open the revenue and customer analytics workspace.",
    examples: ["Take me to analytics", "Open analytics"],
  },
  {
    id: "open-settings",
    label: "Open settings",
    route: "settings",
    operation: "navigate",
    needsConfirmation: false,
    selector: "[data-lexicon='settings-nav']",
    description: "Navigate to workspace and notification settings.",
    examples: ["Open user settings", "Go to settings"],
  },
  {
    id: "create-customer",
    label: "Create customer",
    route: "customers",
    operation: "create",
    needsConfirmation: true,
    selector: "[data-lexicon='create-customer']",
    description: "Open a customer creation flow with the account form ready.",
    examples: ["Create a new customer", "Add a customer"],
  },
  {
    id: "show-orders-last-week",
    label: "Show last week's orders",
    route: "orders",
    operation: "filter",
    needsConfirmation: false,
    selector: "[data-lexicon='orders-table']",
    description: "Filter the orders table to the last seven days.",
    examples: ["Show orders from last week", "Last week's orders"],
  },
  {
    id: "export-report",
    label: "Export report",
    route: "analytics",
    operation: "export",
    needsConfirmation: true,
    selector: "[data-lexicon='export-report']",
    description: "Prepare the current analytics report for CSV export.",
    examples: ["Export this report", "Download the report"],
  },
  {
    id: "create-invoice",
    label: "Create invoice",
    route: "invoices",
    operation: "create",
    needsConfirmation: true,
    selector: "[data-lexicon='create-invoice']",
    description: "Start a new invoice from the mapped invoicing workflow.",
    examples: ["Create an invoice", "Make a new invoice"],
  },
  {
    id: "approve-request",
    label: "Approve request",
    route: "overview",
    operation: "approve",
    needsConfirmation: true,
    selector: "[data-lexicon='approval-request']",
    description: "Approve the selected request after confirmation.",
    examples: ["Approve this request", "Approve the request"],
  },
]

const commandMatchers: Array<[RegExp, string]> = [
  [/(analytics|revenue|metrics)/i, "open-analytics"],
  [/(settings|preferences|profile settings)/i, "open-settings"],
  [/(new|create|add).*customer|(customer).*(new|create|add)/i, "create-customer"],
  [/(orders?.*(last week|seven days))|((last week|seven days).*orders?)/i, "show-orders-last-week"],
  [/(export|download).*report|(report).*(export|download)/i, "export-report"],
  [/(new|create|make).*invoice|(invoice).*(new|create|make)/i, "create-invoice"],
  [/(approve|accept).*request|(request).*(approve|accept)/i, "approve-request"],
]

export function actionById(id: string) {
  return mappedActions.find((action) => action.id === id)
}

export function resolveVoiceCommand(command: string): MappedAction {
  const match = commandMatchers.find(([pattern]) => pattern.test(command))
  return (
    actionById(match?.[1] ?? "") ??
    mappedActions.find((action) => action.id === "open-analytics")!
  )
}

export const lexiconManifest = {
  app: "Northstar commerce demo",
  version: "0.1.0",
  routes: ["/", "/analytics", "/customers", "/orders", "/invoices", "/settings"],
  actions: mappedActions.map(({ id, label, selector, needsConfirmation }) => ({
    id,
    label,
    selector,
    needsConfirmation,
  })),
}
