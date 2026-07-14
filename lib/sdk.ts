"use client"

export type LexiconAction = {
  id: string
  label: string
  /** A developer-owned target; optional when an explicit handler is supplied. */
  selector?: string
  description?: string
  needsConfirmation?: boolean
  /** Lets framework adapters execute application state without synthesizing a DOM click. */
  handler?: (context: LexiconActionContext) => void
}

export type LexiconActionContext = {
  action: LexiconAction
  confirmed: boolean
}

export type LexiconMountOptions = {
  actions?: LexiconAction[]
  /** Limit discovery to an app mount point when a page hosts multiple products. */
  root?: ParentNode
}

export type LexiconWorkflowStep =
  | { kind: "navigate"; path: string }
  | { kind: "click"; actionId: string }
  | { kind: "fill"; selector: string; value: string }
  | { kind: "extract"; selector: string; key: string }

export type LexiconExecutionResult = {
  ok: boolean
  action?: LexiconAction
  confirmationRequired?: boolean
  values?: Record<string, string>
  reason?: string
}

export type LexiconManifest = {
  app: string
  routes: string[]
  actions: LexiconAction[]
}

export type LexiconRuntime = {
  scan: () => LexiconManifest
  register: (action: LexiconAction) => void
  execute: (actionId: string, options?: { confirmed?: boolean }) => LexiconExecutionResult
  executeWorkflow: (steps: LexiconWorkflowStep[], options?: { confirmed?: boolean }) => LexiconExecutionResult
}

function selectorFor(id: string) {
  return `[data-lexicon="${id.replaceAll('"', "\\\"")}"]`
}

/**
 * The browser-side SDK intentionally only acts on elements that the developer
 * has mapped. It never infers an arbitrary selector or performs visual scraping.
 */
export function mountLexicon(app: string, initialActions?: LexiconAction[]): LexiconRuntime
export function mountLexicon(app: string, options?: LexiconMountOptions): LexiconRuntime
export function mountLexicon(
  app: string,
  input: LexiconAction[] | LexiconMountOptions = []
): LexiconRuntime {
  const options = Array.isArray(input) ? { actions: input } : input
  const actions = new Map((options.actions ?? []).map((action) => [action.id, action]))

  function scan() {
    const scanned = Array.from((options.root ?? document).querySelectorAll<HTMLElement>("[data-lexicon]"))
      .map<LexiconAction | undefined>((element) => {
        const id = element.dataset.lexicon
        if (!id) return undefined
        const action = {
          id,
          label: element.getAttribute("aria-label") || element.textContent?.trim() || id,
          selector: selectorFor(id),
        }
        actions.set(id, action)
        return action
      })
      .filter((action): action is LexiconAction => Boolean(action))

    return {
      app,
      routes: [window.location.pathname],
      actions: scanned,
    }
  }

  function register(action: LexiconAction) {
    actions.set(action.id, action)
  }

  function execute(actionId: string, options: { confirmed?: boolean } = {}): LexiconExecutionResult {
    const action = actions.get(actionId)
    if (!action) return { ok: false, reason: `Unknown Lexicon action: ${actionId}` }
    if (action.needsConfirmation && !options.confirmed) {
      return { ok: false, action, confirmationRequired: true }
    }

    try {
      if (action.handler) {
        action.handler({ action, confirmed: Boolean(options.confirmed) })
      } else if (action.selector) {
        const target = document.querySelector<HTMLElement>(action.selector)
        if (!target) return { ok: false, action, reason: `Mapped target not found: ${action.selector}` }
        target.click()
      } else {
        return { ok: false, action, reason: `Mapped action has no handler or target: ${action.id}` }
      }
    } catch {
      return { ok: false, action, reason: `Mapped action failed: ${action.id}` }
    }

    window.dispatchEvent(new CustomEvent("lexicon:executed", { detail: action }))
    return { ok: true, action }
  }

  function executeWorkflow(
    steps: LexiconWorkflowStep[],
    options: { confirmed?: boolean } = {}
  ): LexiconExecutionResult {
    const values: Record<string, string> = {}

    for (const step of steps) {
      if (step.kind === "navigate") {
        window.history.pushState({}, "", step.path)
        window.dispatchEvent(new PopStateEvent("popstate"))
        continue
      }

      if (step.kind === "click") {
        const result = execute(step.actionId, options)
        if (!result.ok) return { ...result, values }
        continue
      }

      const target = document.querySelector<HTMLElement>(step.selector)
      if (!target) return { ok: false, values, reason: `Mapped target not found: ${step.selector}` }

      if (step.kind === "fill") {
        if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
          return { ok: false, values, reason: `Mapped fill target is not an input: ${step.selector}` }
        }
        target.value = step.value
        target.dispatchEvent(new Event("input", { bubbles: true }))
        target.dispatchEvent(new Event("change", { bubbles: true }))
        continue
      }

      values[step.key] = target.textContent?.trim() ?? ""
    }

    return { ok: true, values }
  }

  return { scan, register, execute, executeWorkflow }
}
