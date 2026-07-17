"use client"

import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Code2,
  Copy,
  CreditCard,
  Download,
  FileText,
  GripVertical,
  LayoutDashboard,
  LineChart,
  ListFilter,
  LockKeyhole,
  Maximize2,
  MessageCircle,
  Mic,
  Minimize2,
  MoreHorizontal,
  Package,
  PanelRightOpen,
  Play,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Volume2,
  X,
  Zap,
} from "lucide-react"
import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai"
import { Dithering } from "@paper-design/shaders-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { motion, useReducedMotion } from "motion/react"

import { AgentAudioVisualizerBar } from "@/components/agents-ui/agent-audio-visualizer-bar"
import { HeroDitheringRoot } from "@/components/ui/hero-dithering"
import { MaskContainer } from "@/components/ui/svg-mask-effect"
import { TextureOverlay } from "@/components/ui/texture-overlay"
import {
  TerminalAnimationCommandBar,
  TerminalAnimationContent,
  TerminalAnimationOutput,
  TerminalAnimationRoot,
  TerminalAnimationTabList,
  TerminalAnimationTabTrigger,
  TerminalAnimationWindow,
  type TabContent,
} from "@/components/ui/terminal-animation"
import {
  actionById,
  mappedActions,
  resolveVoiceCommand,
  type AppRoute,
  type MappedAction,
} from "@/rillwork/action-map"
import {
  createRillworkCapabilities,
  initialCustomers,
  initialInvoices,
  initialOrders,
  initialProfile,
  initialSettings,
  RILLWORK_BRAND,
  RILLWORK_METRICS,
  type RillworkCustomer,
  type RillworkInvoice,
  type RillworkOrder,
  type RillworkProfile,
  type RillworkSettings,
} from "@/rillwork/capabilities"
import { GeminiPcmPlayer, MicrophonePcmStream } from "@lexicon/sdk/live"
import {
  createLexiconRuntime,
  type LexiconExecutionResult,
  type LexiconPendingExecution,
  toolNameForCapability,
  type LexiconField,
  type LexiconInput,
} from "@lexicon/sdk"

type HistoryItem = {
  id: number
  text: string
  action: string
  status: "completed" | "awaiting"
  time: string
}

type Toast = {
  id: number
  message: string
}

type AgentPhase = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error"
type ActionSource = "manual" | "typed" | "live" | "ui"
type PendingSurface = "manual" | "agent"
type ManualActionHandler = (action: MappedAction, text: string, input?: LexiconInput) => void
type AgentChatMessage = {
  id: number
  role: "user" | "assistant"
  text: string
  execution?: LexiconExecutionResult
}

const terminalTabs: TabContent[] = [
  {
    label: "install",
    command: "npm install @lexicon/sdk",
    lines: [
      { text: "added 1 package in 1.42s", color: "text-[#d5ff5f]", delay: 240 },
    ],
  },
  {
    label: "map",
    command: "npx lexicon scan",
    lines: [
      { text: "found 9 routes", color: "text-[#d5ff5f]", delay: 180 },
      { text: "mapped 52 interactive elements", color: "text-neutral-400", delay: 180 },
      { text: "4 workflows ready for review", color: "text-neutral-400", delay: 180 },
    ],
  },
  {
    label: "test",
    command: "lexicon test \"export this report\"",
    lines: [
      { text: "intent: export-report", color: "text-[#d5ff5f]", delay: 180 },
      { text: "confirmation: required", color: "text-neutral-400", delay: 180 },
      { text: "result: deterministic pass", color: "text-[#d5ff5f]", delay: 180 },
    ],
  },
]

const navItems = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "analytics", label: "Analytics", icon: LineChart },
  { id: "customers", label: "Customers", icon: Users },
  { id: "orders", label: "Orders", icon: Package },
  { id: "invoices", label: "Invoices", icon: FileText },
] as const

const commandExamples = [
  "Take me to analytics.",
  "Open user settings.",
  "Create a new customer.",
  "Show orders from last week.",
  "Export this report.",
]

const importantToastPattern = /\b(created|updated|deleted|saved|approved|rejected|failed|ready to download)\b/i

const pageLabels: Record<AppRoute, string> = {
  overview: "Overview",
  analytics: "Analytics",
  customers: "Customers",
  orders: "Orders",
  invoices: "Invoices",
  settings: "Settings",
  notifications: "Notifications",
  profile: "Profile",
  console: "Lexicon console",
}

const workspaceNotifications = [
  {
    id: "payment",
    kind: "payment",
    title: "Payment received from Oriel House",
    detail: "$7,680.00 was added to the operating balance.",
    time: "18 minutes ago",
  },
  {
    id: "plan",
    kind: "account",
    title: "Kanso Workshop requested a plan change",
    detail: "Niko wants to move the workspace from Workshop to Foundry.",
    time: "1 hour ago",
  },
  {
    id: "invoice",
    kind: "invoice",
    title: "Invoice INV-1438 was viewed",
    detail: "Kanso Workshop opened the annual renewal invoice.",
    time: "3 hours ago",
  },
  {
    id: "export",
    kind: "download",
    title: "July account export is ready",
    detail: "The 9-row customer export can be downloaded from Orders.",
    time: "6 hours ago",
  },
  {
    id: "member",
    kind: "account",
    title: "Mina Okafor joined the workspace",
    detail: "Rhea added Mina with analyst access.",
    time: "Yesterday",
  },
  {
    id: "mapping",
    kind: "security",
    title: "Lexicon mapping check completed",
    detail: "All mapped capabilities and guarded actions passed.",
    time: "Yesterday",
  },
] as const

function WorkspaceNotificationIcon({ kind }: { kind: string }) {
  if (kind === "payment") return <CreditCard size={17} />
  if (kind === "invoice") return <FileText size={17} />
  if (kind === "download") return <Download size={17} />
  if (kind === "security") return <ShieldCheck size={17} />
  return <Users size={17} />
}

export const rillworkRouteHref: Record<AppRoute, string> = {
  overview: "/console/overview",
  analytics: "/console/analytics",
  customers: "/console/customers",
  orders: "/console/orders",
  invoices: "/console/invoices",
  settings: "/console/settings",
  notifications: "/console/notifications",
  profile: "/console/profile",
  console: "/console",
}

function routeFromPathname(pathname: string): AppRoute {
  const match = (Object.entries(rillworkRouteHref) as Array<[AppRoute, string]>)
    .find(([, href]) => href === pathname)
  return match?.[0] ?? "overview"
}

function createRillworkDemoStore() {
  let current = {
    customers: initialCustomers,
    orders: initialOrders,
    invoices: initialInvoices,
    settings: initialSettings,
    profile: initialProfile,
    approvalStatus: "pending" as "pending" | "approved" | "rejected",
  }
  return {
    getCustomers: () => current.customers,
    setCustomers: (customers: RillworkCustomer[]) => { current = { ...current, customers } },
    getOrders: () => current.orders,
    setOrders: (orders: RillworkOrder[]) => { current = { ...current, orders } },
    getInvoices: () => current.invoices,
    setInvoices: (invoices: RillworkInvoice[]) => { current = { ...current, invoices } },
    getSettings: () => current.settings,
    setSettings: (settings: RillworkSettings) => { current = { ...current, settings } },
    getProfile: () => current.profile,
    setProfile: (profile: RillworkProfile) => { current = { ...current, profile } },
    getApprovalStatus: () => current.approvalStatus,
    setApprovalStatus: (approvalStatus: "pending" | "approved" | "rejected") => {
      current = { ...current, approvalStatus }
    },
  }
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" aria-label="Lexicon">
      <span className="brand-mark"><span /></span>
      {!compact && <span>lexicon</span>}
    </div>
  )
}

function RillworkMark({ className = "" }: { className?: string }) {
  return (
    <span className={`rillwork-mark ${className}`.trim()} aria-hidden>
      <i />
      <i />
      <i />
    </span>
  )
}

function StatusPip({ tone = "lime" }: { tone?: "lime" | "amber" | "gray" }) {
  return <span className={`status-pip status-pip--${tone}`} aria-hidden />
}

function VoiceOrb({ listening = false }: { listening?: boolean }) {
  return (
    <span className={`voice-orb ${listening ? "voice-orb--listening" : ""}`} aria-hidden>
      <span className="voice-orb__core"><Volume2 size={18} strokeWidth={2.2} /></span>
      <i /><i /><i />
    </span>
  )
}

function ScrollReveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, transform: "translateY(22px)", clipPath: "inset(0 0 12% 0)" }}
      whileInView={{ opacity: 1, transform: "translateY(0px)", clipPath: "inset(0 0 0% 0)" }}
      viewport={{ once: true, amount: 0.16, margin: "0px 0px -72px" }}
      transition={{ duration: reduceMotion ? 0.16 : 0.58, delay: reduceMotion ? 0 : delay, ease: [0.23, 1, 0.32, 1] }}
    >
      {children}
    </motion.div>
  )
}

function ModelSurfaceNode({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode
  className: string
  delay?: number
}) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.section
      className={className}
      initial={reduceMotion ? false : { opacity: 0, transform: "translateY(10px)" }}
      whileInView={{ opacity: 1, transform: "translateY(0px)" }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: reduceMotion ? 0.01 : 0.34, delay: reduceMotion ? 0 : delay, ease: [0.23, 1, 0.32, 1] }}
    >
      {children}
    </motion.section>
  )
}

function ProductModelSurface({
  onRun,
}: {
  onRun: (action: MappedAction, text: string) => void
}) {
  const selected = actionById("export-report")!
  const registry = [
    "export-report",
    "create-invoice",
    "update-customer",
    "approve-request",
  ]
    .map(actionById)
    .filter((action): action is MappedAction => Boolean(action))

  return (
    <div className="model-surface" aria-label="Rillwork product model">
      <div className="model-surface__diagram">
        <ModelSurfaceNode className="model-surface__node model-surface__request">
          <div className="model-surface__request-group">
            <strong>“Export the last 30 days <em>revenue report</em>”</strong>
            <div className="model-surface__signal">
              <div className="model-surface__voice-bars">
                <i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
              </div>
            </div>
          </div>
        </ModelSurfaceNode>

        <ModelSurfaceNode className="model-surface__node model-surface__capability" delay={0.04}>
          <div className="model-surface__capability-body">
            <code><span>lexicon_</span><strong>{toolNameForCapability(selected.id).replace("lexicon_", "")}</strong></code>
            <p>{selected.description}</p>
          </div>
          <div className="model-surface__capability-orbit" aria-hidden>
            <Zap size={44} strokeWidth={1.55} />
          </div>
        </ModelSurfaceNode>

        <ModelSurfaceNode className="model-surface__node model-surface__detail model-surface__route" delay={0.08}>
          <PanelRightOpen className="model-surface__route-glyph" size={72} strokeWidth={1.2} aria-hidden />
          <strong>/{selected.route}</strong>
          <code>{selected.selector}</code>
        </ModelSurfaceNode>

        <ModelSurfaceNode className={`model-surface__node model-surface__detail model-surface__authority ${selected.needsConfirmation ? "needs-review" : ""}`} delay={0.11}>
          <div className="model-surface__policy-layout">
            <ShieldCheck size={46} strokeWidth={1.4} aria-hidden />
            <code><span>confirmation:</span><strong>&quot;{selected.needsConfirmation ? "always" : "auto"}&quot;</strong></code>
          </div>
        </ModelSurfaceNode>

        <ModelSurfaceNode className="model-surface__node model-surface__registry" delay={0.14}>
          <div className="model-surface__registry-head">
            <code>capabilities</code>
            <strong>{mappedActions.length}</strong>
          </div>
          <div className="model-surface__registry-list">
            {registry.map((action) => (
              <div key={action.id} className={action.id === selected.id ? "is-current" : ""}>
                <Activity size={15} strokeWidth={1.7} aria-hidden />
                <code>{toolNameForCapability(action.id).replace("lexicon_", "")}</code>
                {action.needsConfirmation
                  ? <LockKeyhole size={13} strokeWidth={1.7} aria-label="Confirmation required" />
                  : <Check size={13} strokeWidth={1.9} aria-label="No confirmation required" />}
              </div>
            ))}
          </div>
        </ModelSurfaceNode>

        <ModelSurfaceNode className="model-surface__node model-surface__outcome" delay={0.17}>
          <div className="model-surface__outcome-head">
            <code>handler</code>
            <span>{selected.operation}</span>
          </div>
          <div className="model-surface__outcome-body">
            <code className="model-surface__handler">
              <span><i>01</i><span><b>adapter</b>.analytics.setRange(<em>&quot;30_days&quot;</em>)</span></span>
              <span><i>02</i><span><b>adapter</b>.download(<em>&quot;rillwork-report.csv&quot;</em>)</span></span>
            </code>
          </div>
        </ModelSurfaceNode>

        <ModelSurfaceNode className="model-surface__node model-surface__execution" delay={0.2}>
          <div className="model-surface__execution-state">
            <CheckCircle2 size={33} strokeWidth={1.55} aria-hidden />
            <div>
              <code>{selected.operation}</code>
              <strong>{selected.needsConfirmation ? "review required" : "ready to run"}</strong>
            </div>
          </div>
          <div className="model-surface__execution-action">
            <button className="model-surface__run" onClick={() => onRun(selected, selected.examples[0])}>
              {selected.needsConfirmation ? "Review action" : "Run action"} <ArrowUpRight size={14} />
            </button>
          </div>
        </ModelSurfaceNode>
      </div>
    </div>
  )
}

function MappedProductFlow({
  onRun,
  onConsole,
}: {
  onRun: (action: MappedAction, text: string) => void
  onConsole: () => void
}) {
  const action = actionById("show-orders-last-week")!

  return (
    <div className="product-xray">
      <div className="product-xray__intro">
        <div>
          <h2>Look beneath<br />what was said.</h2>
        </div>
        <div>
          <p>The language your user speaks is only the surface. Underneath, Lexicon resolves one named route, one target, and one permissioned action.</p>
          <button className="section-link" onClick={onConsole}>Inspect the action map <ChevronRight size={15} /></button>
        </div>
      </div>
      <div className="product-xray__field-wrap">
        <MaskContainer
          className="product-xray__field"
          size={38}
          revealSize={356}
          revealText={
            <div className="product-xray__voice-layer">
              <span className="product-xray__field-label-spacer" aria-hidden />
              <div className="product-xray__utterance">
                <VoiceOrb listening />
                <strong>“Show orders<br />from last week.”</strong>
              </div>
              <div className="product-xray__waveform" aria-hidden><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
              <p>Unmapped language never becomes improvised clicks.</p>
            </div>
          }
        >
          <div className="product-xray__action-layer">
            <span className="product-xray__field-label-spacer" aria-hidden />
            <div className="product-xray__action-name"><span>action</span><code>{action.id}</code></div>
            <div className="product-xray__facts">
              <span><small>route</small><code>{action.route}</code></span>
              <span><small>target</small><code>{action.selector}</code></span>
              <span><small>authority</small><strong>ready to execute</strong></span>
            </div>
            <button onClick={() => onRun(action, action.examples[0])}>Run the mapped action <ArrowUpRight size={15} /></button>
          </div>
        </MaskContainer>
      </div>
    </div>
  )
}

function fieldInputType(field: LexiconField) {
  if (field.type === "email") return "email"
  if (field.type === "number" || field.type === "integer") return "number"
  if (field.type === "date") return "date"
  return "text"
}

function PendingCapabilityCard({
  pending,
  draft,
  onChange,
  onContinue,
  onConfirm,
  onCancel,
}: {
  pending: LexiconPendingExecution
  draft: LexiconInput
  onChange: (name: string, value: unknown) => void
  onContinue: () => void
  onConfirm: () => void
  onCancel: () => void
}) {
  const fields = pending.capability.fields ?? []
  const confirming = pending.status === "needs-confirmation"
  const missingFields = new Set(pending.missingFields ?? [])
  return (
    <form className={`confirmation-box capability-card capability-card--${pending.status}`} onSubmit={(event) => { event.preventDefault(); if (confirming) onConfirm(); else onContinue() }}>
      <div className="capability-card__header">
        <span className="capability-card__icon"><LockKeyhole size={16} /></span>
        <div>
          <small>{confirming ? "Review before running" : "Complete the action"}</small>
          <strong>{pending.capability.label}</strong>
          <p>{pending.preview ?? pending.capability.description}</p>
        </div>
      </div>
      {fields.length > 0 && (
        <div className="capability-fields">
          {fields.map((field) => (
            <label
              key={field.name}
              className={`${missingFields.has(field.name) ? "is-missing" : "is-complete"} ${field.type === "boolean" ? "is-checkbox" : ""}`}
            >
              <span>
                {field.label}
                {field.required ? " *" : ""}
                {!missingFields.has(field.name) && pending.input[field.name] !== undefined && <Check size={12} />}
              </span>
              {field.description && <small>{field.description}</small>}
              {field.type === "enum" ? (
                <select
                  value={String(draft[field.name] ?? "")}
                  onChange={(event) => onChange(field.name, event.target.value)}
                >
                  <option value="">Select…</option>
                  {field.options?.map((option) => <option key={option}>{option}</option>)}
                </select>
              ) : field.type === "boolean" ? (
                <input
                  type="checkbox"
                  checked={draft[field.name] === true}
                  onChange={(event) => onChange(field.name, event.target.checked)}
                />
              ) : (
                <input
                  type={fieldInputType(field)}
                  value={String(draft[field.name] ?? "")}
                  placeholder={field.placeholder}
                  onChange={(event) => onChange(field.name, event.target.value)}
                />
              )}
            </label>
          ))}
        </div>
      )}
      <div className="confirmation-actions">
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="submit" className="confirm">
          {confirming ? "Confirm and run" : "Review action"}
          <ChevronRight size={14} />
        </button>
      </div>
    </form>
  )
}

function ManualActionDialog({
  pending,
  draft,
  onChange,
  onContinue,
  onConfirm,
  onCancel,
}: {
  pending: LexiconPendingExecution
  draft: LexiconInput
  onChange: (name: string, value: unknown) => void
  onContinue: () => void
  onConfirm: () => void
  onCancel: () => void
}) {
  const fields = pending.capability.fields ?? []
  const confirming = pending.status === "needs-confirmation"
  const destructive = pending.capability.kind === "delete"
  const previewLines = (pending.preview ?? pending.capability.description).split("\n").filter(Boolean)

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel()
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [onCancel])

  return (
    <div className="app-dialog-backdrop manual-action-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className={`app-dialog manual-action-dialog ${destructive ? "manual-action-dialog--destructive" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-action-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="app-dialog__header">
          <div>
            <span className="manual-action-dialog__eyebrow">{confirming ? "Review action" : "Manual action"}</span>
            <h2 id="manual-action-title">{pending.capability.label}</h2>
            <p>{confirming ? "Check the details before this change is applied." : pending.capability.description}</p>
          </div>
          <button type="button" className="icon-button" onClick={onCancel} aria-label="Close action dialog"><X size={17} /></button>
        </header>

        <form className="manual-action-form" onSubmit={(event) => { event.preventDefault(); if (confirming) onConfirm(); else onContinue() }}>
          {confirming ? (
            <div className="manual-action-review">
              <span className="manual-action-review__icon"><LockKeyhole size={17} /></span>
              <div>
                {previewLines.map((line, index) => index === 0
                  ? <strong key={line}>{line}</strong>
                  : <span key={`${line}-${index}`}>{line}</span>)}
              </div>
            </div>
          ) : (
            <div className="manual-action-fields">
              {fields.map((field, index) => (
                <label key={field.name} className={field.type === "boolean" ? "manual-checkbox" : undefined}>
                  <span>{field.label}{field.required ? " *" : ""}</span>
                  {field.description && <small>{field.description}</small>}
                  {field.type === "enum" ? (
                    <select
                      autoFocus={index === 0}
                      value={String(draft[field.name] ?? "")}
                      onChange={(event) => onChange(field.name, event.target.value)}
                    >
                      <option value="">Select…</option>
                      {field.options?.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  ) : field.type === "boolean" ? (
                    <input
                      autoFocus={index === 0}
                      type="checkbox"
                      checked={draft[field.name] === true}
                      onChange={(event) => onChange(field.name, event.target.checked)}
                    />
                  ) : (
                    <input
                      autoFocus={index === 0}
                      type={fieldInputType(field)}
                      value={String(draft[field.name] ?? "")}
                      placeholder={field.placeholder}
                      onChange={(event) => onChange(field.name, event.target.value)}
                    />
                  )}
                </label>
              ))}
            </div>
          )}

          <footer className="app-dialog__footer">
            <button type="button" className="button-secondary" onClick={onCancel}>Cancel</button>
            <button type="submit" className={destructive ? "button-danger" : "button-primary"}>
              {confirming ? destructive ? "Delete permanently" : "Confirm action" : "Continue"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}

function isResultRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function resultLabel(key: string) {
  const labels: Record<string, string> = {
    activeCustomers: "Customers",
    netRevenue: "Revenue",
    revenuePerCustomer: "Per customer",
    requestedPlan: "Requested plan",
  }
  return labels[key] ?? key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase())
}

function resultValue(value: unknown) {
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (value === null || value === undefined) return "-"
  return String(value)
}

function AgentResult({ result }: { result: LexiconExecutionResult }) {
  if (result.status !== "completed") return null
  const capabilityId = result.capability?.id
  const data = result.data

  if (capabilityId === "read-workspace-summary" && isResultRecord(data)) {
    const approval = resultValue(data.approval)
    return (
      <section className="agent-result" aria-live="polite">
        <div className="agent-result__answer">
          <CheckCircle2 size={16} />
          <div><strong>{result.message}</strong><span>Updated just now.</span></div>
        </div>
        <div className="agent-result__metrics">
          <div><span>Revenue</span><strong>{resultValue(data.revenue)}</strong></div>
          <div><span>Customers</span><strong>{resultValue(data.activeCustomers)}</strong></div>
          <div><span>Orders</span><strong>{resultValue(data.orders)}</strong></div>
          <div><span>Invoices</span><strong>{resultValue(data.invoices)}</strong></div>
        </div>
        <div className={`agent-result__status ${approval === "pending" ? "is-pending" : ""}`}>
          {approval === "pending" ? <Clock3 size={14} /> : <CheckCircle2 size={14} />}
          <span>{approval === "pending" ? "One approval is waiting for your review." : `The latest approval is ${approval}.`}</span>
        </div>
      </section>
    )
  }

  if (capabilityId === "read-analytics" && isResultRecord(data)) {
    return (
      <section className="agent-result" aria-live="polite">
        <div className="agent-result__answer">
          <LineChart size={16} />
          <div><strong>{result.message}</strong><span>{resultValue(data.period)}</span></div>
        </div>
        <div className="agent-result__metrics">
          <div><span>Revenue</span><strong>{resultValue(data.netRevenue)}</strong></div>
          <div><span>Customers</span><strong>{resultValue(data.activeCustomers)}</strong></div>
          <div><span>Per customer</span><strong>{resultValue(data.revenuePerCustomer)}</strong></div>
          <div><span>Change</span><strong>{resultValue(data.growth)}</strong></div>
        </div>
      </section>
    )
  }

  if (Array.isArray(data)) {
    const records = data.filter(isResultRecord).slice(0, 3)
    return (
      <section className="agent-result" aria-live="polite">
        <div className="agent-result__answer">
          <CheckCircle2 size={16} />
          <div><strong>{result.message}</strong>{data.length > records.length && <span>Showing the first {records.length} here.</span>}</div>
        </div>
        {records.length > 0 && (
          <div className="agent-result__list">
            {records.map((record, index) => {
              const primary = resultValue(record.name ?? record.id ?? record.customer)
              const secondary = resultValue(record.customer ?? record.owner ?? record.email ?? record.product)
              const meta = resultValue(record.amount ?? record.spend ?? record.plan ?? record.status)
              return (
                <div key={`${primary}-${index}`}>
                  <span><strong>{primary}</strong>{secondary !== primary && <small>{secondary}</small>}</span>
                  <em>{meta}</em>
                </div>
              )
            })}
          </div>
        )}
      </section>
    )
  }

  if (result.capability?.kind === "read" && isResultRecord(data)) {
    const entries = Object.entries(data).slice(0, 4)
    return (
      <section className="agent-result" aria-live="polite">
        <div className="agent-result__answer">
          <CheckCircle2 size={16} />
          <div><strong>{result.message}</strong></div>
        </div>
        <dl className="agent-result__details">
          {entries.map(([key, value]) => <div key={key}><dt>{resultLabel(key)}</dt><dd>{resultValue(value)}</dd></div>)}
        </dl>
      </section>
    )
  }

  return (
    <section className="agent-result agent-result--compact" aria-live="polite">
      <div className="agent-result__answer">
        <CheckCircle2 size={16} />
        <div><strong>{result.message}</strong></div>
      </div>
    </section>
  )
}

function AgentConversation({
  messages,
  userDraft,
  assistantDraft,
  phase,
  inputLevel,
  compact = false,
  scrollRef,
  children,
}: {
  messages: AgentChatMessage[]
  userDraft: string
  assistantDraft: string
  phase: AgentPhase
  inputLevel: number
  compact?: boolean
  scrollRef?: React.RefObject<HTMLDivElement | null>
  children?: React.ReactNode
}) {
  if (compact) {
    const latest = messages.at(-1)
    const phaseMessage = phase === "connecting"
      ? { role: "assistant" as const, text: "Connecting to live voice…", label: "Lexicon" }
      : phase === "thinking"
        ? { role: "assistant" as const, text: "Working on that…", label: "Lexicon" }
        : phase === "speaking" && !assistantDraft
          ? { role: "assistant" as const, text: "Responding…", label: "Lexicon" }
          : null
    const current = assistantDraft
      ? { role: "assistant" as const, text: assistantDraft, label: "Lexicon · responding" }
      : userDraft
        ? { role: "user" as const, text: userDraft, label: "You · speaking" }
        : phaseMessage ?? (latest
            ? { role: latest.role, text: latest.text, label: latest.role === "user" ? "You" : "Lexicon" }
            : null)
    return (
      <div ref={scrollRef} className="agent-chat agent-chat--compact" aria-live="polite">
        {current ? (
          <div className={`chat-message chat-message--${current.role} ${assistantDraft || userDraft ? "is-streaming" : ""}`}>
            <span>{current.label}</span>
            <p>{current.text}</p>
          </div>
        ) : (
          <div className={`chat-live-state chat-live-state--${phase}`}>
            <span>{phase === "connecting" ? "Connecting" : phase === "thinking" ? "Working" : phase === "speaking" ? "Responding" : phase === "error" ? "Connection issue" : "Listening"}</span>
          </div>
        )}
      </div>
    )
  }

  const visibleMessages = messages
  return (
    <div ref={scrollRef} className={`agent-chat ${compact ? "agent-chat--compact" : ""}`} aria-live="polite">
      {visibleMessages.map((message) => (
        <div key={message.id} className={`chat-message chat-message--${message.role}`}>
          <span>{message.role === "user" ? "You" : "Lexicon"}</span>
          {message.execution?.status === "completed" && !compact
            ? <AgentResult result={message.execution} />
            : <p>{message.text}</p>}
        </div>
      ))}
      {userDraft && (
        <div className="chat-message chat-message--user is-streaming">
          <span>You · speaking</span>
          <p>{userDraft}</p>
        </div>
      )}
      {assistantDraft && (
        <div className="chat-message chat-message--assistant is-streaming">
          <span>Lexicon · responding</span>
          <p>{assistantDraft}</p>
        </div>
      )}
      {!assistantDraft && phase !== "idle" && (
        <div className={`chat-live-state chat-live-state--${phase}`}>
          <span>{phase === "connecting" ? "Connecting" : phase === "listening" ? "Listening" : phase === "thinking" ? "Working" : phase === "speaking" ? "Responding" : "Connection issue"}</span>
          <div aria-hidden>
            <i style={{ transform: `scaleY(${0.35 + inputLevel * 0.85})` }} />
            <i /><i /><i /><i />
          </div>
        </div>
      )}
      {children}
    </div>
  )
}

function SearchDialog({ onClose, onSelect }: { onClose: () => void; onSelect: (route: AppRoute) => void }) {
  const [query, setQuery] = useState("")
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [onClose])
  const entries: Array<{ route: AppRoute; label: string; detail: string }> = [
    { route: "overview", label: "Overview", detail: "Workspace home" },
    { route: "analytics", label: "Analytics", detail: "Revenue and customer metrics" },
    { route: "customers", label: "Customers", detail: "Manage accounts" },
    { route: "orders", label: "Orders", detail: "Review payments and orders" },
    { route: "invoices", label: "Invoices", detail: "Create and send invoices" },
    { route: "settings", label: "Settings", detail: "Workspace preferences" },
    { route: "console", label: "Lexicon console", detail: "Map actions and test voice" },
  ]
  const results = entries.filter((entry) => `${entry.label} ${entry.detail}`.toLowerCase().includes(query.toLowerCase()))
  return <div className="app-dialog-backdrop search-backdrop" role="presentation" onMouseDown={onClose}><section className="search-dialog" onMouseDown={(event) => event.stopPropagation()}><div className="search-dialog__input"><Search size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${RILLWORK_BRAND.name}`} /><kbd>Esc</kbd></div><div className="search-dialog__results">{results.map((entry) => <button key={entry.route} onClick={() => onSelect(entry.route)}><span><strong>{entry.label}</strong><small>{entry.detail}</small></span><ChevronRight size={16} /></button>)}{results.length === 0 && <p>No matching workspace surface.</p>}</div></section></div>
}

export function LexiconAuthPage({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter()
  const isSignup = mode === "signup"

  return (
    <main className="auth-shell">
      <section className="auth-intro">
        <Link className="auth-logo" href="/"><Logo /></Link>
        <div>
          <h1>The product knows<br />what to do next.</h1>
          <p>Map the actions people need. Let Lexicon carry out the conversation.</p>
        </div>
        <div className="auth-quote"><VoiceOrb /><p>“Show orders from last week.”<span>Orders filtered in 0.4 seconds</span></p></div>
      </section>
      <section className="auth-form-area">
        <Link className="auth-back" href="/">← Back to Lexicon</Link>
        <div className="auth-form-wrap">
          <div className="auth-heading"><h2>{isSignup ? "Create your workspace" : "Welcome back"}</h2><p>{isSignup ? "Start mapping voice actions for your product." : "Sign in to your Lexicon workspace."}</p></div>
          <button className="sso-button" onClick={() => router.push("/console/overview")}><span className="google-mark">G</span> Continue with Google</button>
          <div className="auth-divider"><span>or continue with email</span></div>
          {isSignup && <label>Full name<input placeholder="Rhea Calder" /></label>}
          <label>Work email<input type="email" placeholder="you@company.com" /></label>
          <label>Password<input type="password" placeholder="••••••••••" /></label>
          <button className="auth-submit" onClick={() => router.push("/console/overview")}>{isSignup ? "Create workspace" : "Sign in"}<ArrowUpRight size={16} /></button>
          <p className="auth-switch">{isSignup ? "Already have a workspace?" : "New to Lexicon?"} <Link href={isSignup ? "/login" : "/signup"}>{isSignup ? "Sign in" : "Create an account"}</Link></p>
        </div>
      </section>
    </main>
  )
}

type RillworkDemoContextValue = {
  route: AppRoute
  activeLabel: string
  voiceOpen: boolean
  setVoiceOpen: (open: boolean) => void
  listening: boolean
  lastExecution: LexiconExecutionResult | null
  pendingExecution: LexiconPendingExecution | null
  pendingDraft: LexiconInput
  setPendingDraft: React.Dispatch<React.SetStateAction<LexiconInput>>
  command: string
  setCommand: (command: string) => void
  filterActive: boolean
  setFilterActive: (active: boolean) => void
  copied: boolean
  agentNotice: string | null
  toast: Toast | null
  dismissToast: () => void
  searchOpen: boolean
  setSearchOpen: (open: boolean) => void
  agentPhase: AgentPhase
  inputLevel: number
  customers: RillworkCustomer[]
  orders: RillworkOrder[]
  invoices: RillworkInvoice[]
  settings: RillworkSettings
  profile: RillworkProfile
  approvalStatus: "pending" | "approved" | "rejected"
  unreadNotifications: Set<string>
  notificationsOpen: boolean
  setNotificationsOpen: (open: boolean) => void
  history: HistoryItem[]
  voiceInput: React.RefObject<HTMLInputElement | null>
  navigate: (route: AppRoute) => void
  notify: (message: string) => void
  runManualAction: ManualActionHandler
  runAgentCommand: (command: string) => void
  continuePending: () => Promise<void>
  confirmPending: () => Promise<void>
  cancelPending: () => void
  toggleListening: () => void
  submitCommand: (value: string) => Promise<void>
  copySnippet: () => void
  updateSettings: (settings: RillworkSettings) => void
  updateProfile: (profile: RillworkProfile) => void
  setUnreadNotifications: (notifications: Set<string>) => void
}

const RillworkDemoContext = createContext<RillworkDemoContextValue | null>(null)

function useRillworkDemo() {
  const context = useContext(RillworkDemoContext)
  if (!context) {
    throw new Error("Rillwork route pages must be rendered inside RillworkConsoleLayout.")
  }
  return context
}

function LexiconExperience({
  surface,
  children,
}: {
  surface: "marketing" | "workspace"
  children?: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const route = routeFromPathname(pathname)
  const reduceMotion = useReducedMotion()
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [voiceCompact, setVoiceCompact] = useState(false)
  const [voiceMenuOpen, setVoiceMenuOpen] = useState(false)
  const [listening, setListening] = useState(false)
  const [lastExecution, setLastExecution] = useState<LexiconExecutionResult | null>(null)
  const [pendingExecution, setPendingExecution] = useState<LexiconPendingExecution | null>(null)
  const [pendingSurface, setPendingSurface] = useState<PendingSurface | null>(null)
  const [pendingDraft, setPendingDraft] = useState<LexiconInput>({})
  const [command, setCommand] = useState("")
  const [filterActive, setFilterActive] = useState(false)
  const [copied, setCopied] = useState(false)
  const [agentNotice, setAgentNotice] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<AgentChatMessage[]>([
    { id: 1, role: "assistant", text: `What would you like to do in ${RILLWORK_BRAND.name}?` },
  ])
  const [liveUserDraft, setLiveUserDraft] = useState("")
  const [liveAssistantDraft, setLiveAssistantDraft] = useState("")
  const [toast, setToast] = useState<Toast | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [agentPhase, setAgentPhase] = useState<AgentPhase>("idle")
  const [inputLevel, setInputLevel] = useState(0)
  const [customers, setCustomers] = useState(initialCustomers)
  const [orders, setOrders] = useState(initialOrders)
  const [invoices, setInvoices] = useState(initialInvoices)
  const [settings, setSettings] = useState(initialSettings)
  const [profile, setProfile] = useState(initialProfile)
  const [approvalStatus, setApprovalStatus] = useState<"pending" | "approved" | "rejected">("pending")
  const [unreadNotifications, setUnreadNotifications] = useState(new Set(["payment", "plan", "invoice"]))
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const liveSession = useRef<Session | null>(null)
  const liveMicrophone = useRef<MicrophonePcmStream | null>(null)
  const livePlayer = useRef<GeminiPcmPlayer | null>(null)
  const liveClosing = useRef(false)
  const liveUserTranscript = useRef("")
  const liveAssistantTranscript = useRef("")
  const lastLiveUserMessage = useRef("")
  const lastLaunch = useRef("")
  const runCapabilityRef = useRef<typeof runCapability | null>(null)
  const voiceInput = useRef<HTMLInputElement | null>(null)
  const voiceConversation = useRef<HTMLDivElement | null>(null)
  const assistantFloat = useRef<HTMLDivElement | null>(null)
  const assistantOffset = useRef({ x: 0, y: 0 })
  const assistantDrag = useRef({
    pointerId: -1,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    moved: false,
  })
  const toastTimer = useRef<number | null>(null)
  const toastId = useRef(0)
  const chatId = useRef(1)
  const [demoStore] = useState(createRillworkDemoStore)
  const [lexicon] = useState(() =>
    createLexiconRuntime({
      app: RILLWORK_BRAND.appName,
      version: "1.0.0",
      capabilities: createRillworkCapabilities({
        navigate,
        getCustomers: demoStore.getCustomers,
        setCustomers: (next) => {
          demoStore.setCustomers(next)
          setCustomers(next)
        },
        getOrders: demoStore.getOrders,
        setOrders: (next) => {
          demoStore.setOrders(next)
          setOrders(next)
        },
        getInvoices: demoStore.getInvoices,
        setInvoices: (next) => {
          demoStore.setInvoices(next)
          setInvoices(next)
        },
        getSettings: demoStore.getSettings,
        setSettings: (next) => {
          demoStore.setSettings(next)
          setSettings(next)
        },
        getProfile: demoStore.getProfile,
        setProfile: (next) => {
          demoStore.setProfile(next)
          setProfile(next)
        },
        setLastSevenDays: setFilterActive,
        getApprovalStatus: demoStore.getApprovalStatus,
        setApprovalStatus: (next) => {
          demoStore.setApprovalStatus(next)
          setApprovalStatus(next)
        },
        markAllNotificationsRead: () => setUnreadNotifications(new Set()),
      }),
    })
  )
  const [history, setHistory] = useState<HistoryItem[]>([
    { id: 1, text: "Take me to analytics", action: "View analytics", status: "completed", time: "Just now" },
    { id: 2, text: "Show orders from last week", action: "Filter orders", status: "completed", time: "09:42" },
    { id: 3, text: "Create an invoice", action: "Create invoice", status: "completed", time: "Yesterday" },
    { id: 4, text: "Find Kanso Workshop", action: "Find customers", status: "completed", time: "Mon" },
    { id: 5, text: "Read the approval request", action: "Read approval", status: "completed", time: "Fri" },
  ])

  const activeLabel = useMemo(() => pageLabels[route], [route])
  const assistantMode = !voiceOpen ? "launcher" : voiceMenuOpen ? "menu" : voiceCompact ? "live" : "chat"

  function appendChatMessage(
    role: AgentChatMessage["role"],
    text: string,
    execution?: LexiconExecutionResult
  ) {
    const normalized = text.trim()
    if (!normalized && !execution) return
    const message: AgentChatMessage = {
      id: ++chatId.current,
      role,
      text: normalized || execution?.message || "",
      execution,
    }
    setChatMessages((current) => {
      const last = current.at(-1)
      if (!execution && last?.role === role && last.text === message.text) return current
      return [...current, message].slice(-40)
    })
  }

  function commitLiveTranscript(role?: AgentChatMessage["role"]) {
    const additions: AgentChatMessage[] = []
    if ((!role || role === "user") && liveUserTranscript.current.trim()) {
      const text = liveUserTranscript.current.trim()
      lastLiveUserMessage.current = text
      additions.push({ id: ++chatId.current, role: "user", text })
      liveUserTranscript.current = ""
      setLiveUserDraft("")
    }
    if ((!role || role === "assistant") && liveAssistantTranscript.current.trim()) {
      additions.push({
        id: ++chatId.current,
        role: "assistant",
        text: liveAssistantTranscript.current.trim(),
      })
      liveAssistantTranscript.current = ""
      setLiveAssistantDraft("")
    }
    if (additions.length) {
      setChatMessages((current) => [...current, ...additions].slice(-40))
    }
  }

  function clampAssistantPosition() {
    const element = assistantFloat.current
    if (!element) return
    const rect = element.getBoundingClientRect()
    const padding = 12
    let { x, y } = assistantOffset.current
    if (rect.left < padding) x += padding - rect.left
    if (rect.right > window.innerWidth - padding) x -= rect.right - (window.innerWidth - padding)
    if (rect.top < padding) y += padding - rect.top
    if (rect.bottom > window.innerHeight - padding) y -= rect.bottom - (window.innerHeight - padding)
    assistantOffset.current = { x, y }
    element.style.transform = `translate3d(${x}px, ${y}px, 0)`
  }

  function startAssistantDrag(event: React.PointerEvent<HTMLElement>) {
    if (event.button !== 0) return
    const drag = assistantDrag.current
    drag.pointerId = event.pointerId
    drag.startX = event.clientX
    drag.startY = event.clientY
    drag.originX = assistantOffset.current.x
    drag.originY = assistantOffset.current.y
    drag.moved = false
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveAssistant(event: React.PointerEvent<HTMLElement>) {
    const drag = assistantDrag.current
    if (drag.pointerId !== event.pointerId || !assistantFloat.current) return
    const deltaX = event.clientX - drag.startX
    const deltaY = event.clientY - drag.startY
    if (Math.abs(deltaX) + Math.abs(deltaY) > 4) drag.moved = true
    const x = drag.originX + deltaX
    const y = drag.originY + deltaY
    assistantOffset.current = { x, y }
    assistantFloat.current.style.transform = `translate3d(${x}px, ${y}px, 0)`
  }

  function endAssistantDrag(event: React.PointerEvent<HTMLElement>) {
    if (assistantDrag.current.pointerId !== event.pointerId) return
    assistantDrag.current.pointerId = -1
    event.currentTarget.releasePointerCapture(event.pointerId)
    clampAssistantPosition()
  }

  function openAssistant() {
    setVoiceMenuOpen(true)
    setVoiceCompact(false)
    setVoiceOpen(true)
  }

  function activateAssistantLauncher() {
    if (assistantDrag.current.moved) {
      assistantDrag.current.moved = false
      return
    }
    openAssistant()
  }

  function openExpandedChat() {
    setVoiceMenuOpen(false)
    setVoiceCompact(false)
    setVoiceOpen(true)
    window.setTimeout(() => voiceInput.current?.focus(), 0)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)
      if (surface !== "workspace" || event.code !== "Space" || event.repeat || isTyping || event.metaKey || event.ctrlKey || event.altKey) return
      event.preventDefault()
      setVoiceMenuOpen(false)
      setVoiceCompact(false)
      setVoiceOpen(true)
      window.setTimeout(() => voiceInput.current?.focus(), 0)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [surface])

  useEffect(() => {
    if (surface !== "workspace") return
    const frame = window.requestAnimationFrame(clampAssistantPosition)
    return () => window.cancelAnimationFrame(frame)
  }, [assistantMode, surface])

  useEffect(() => {
    const element = voiceConversation.current
    if (!element) return
    element.scrollTo({
      top: element.scrollHeight,
      behavior: reduceMotion || pendingExecution ? "auto" : "smooth",
    })
  }, [chatMessages, liveAssistantDraft, liveUserDraft, pendingExecution, assistantMode, reduceMotion])

  useEffect(() => () => {
    liveClosing.current = true
    try { liveSession.current?.close() } catch {}
    void liveMicrophone.current?.stop()
    void livePlayer.current?.close()
  }, [])

  useEffect(() => {
    if (surface !== "workspace") return
    const params = new URLSearchParams(window.location.search)
    if (params.get("showNotifications") === "true") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotificationsOpen(true)
      const cleanParams = new URLSearchParams(window.location.search)
      cleanParams.delete("showNotifications")
      const searchStr = cleanParams.toString()
      router.replace(`${pathname}${searchStr ? `?${searchStr}` : ""}`, { scroll: false })
      return
    }
    const capabilityId = params.get("lexiconAction")
    const launchKey = `${pathname}:${capabilityId ?? ""}:${params.get("command") ?? ""}`
    if (!capabilityId || lastLaunch.current === launchKey) return
    lastLaunch.current = launchKey
    const text = params.get("command") ?? actionById(capabilityId)?.label ?? "Run demo action"
    void runCapabilityRef.current?.(capabilityId, {}, text, "manual")
    router.replace(pathname, { scroll: false })
  }, [pathname, router, surface])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNotificationsOpen(false)
  }, [pathname])

  function openWorkspace(target: AppRoute = "overview") {
    router.push(rillworkRouteHref[target])
  }

  function navigate(target: AppRoute) {
    if (target === "notifications") {
      setNotificationsOpen(true)
    } else {
      setNotificationsOpen(false)
      router.push(rillworkRouteHref[target])
    }
  }

  function launchMappedAction(action: MappedAction, text: string) {
    const params = new URLSearchParams({
      lexiconAction: action.id,
      command: text,
    })
    router.push(`${rillworkRouteHref[action.route]}?${params.toString()}`)
  }

  function notify(message: string) {
    if (!importantToastPattern.test(message)) return
    setToast({ id: ++toastId.current, message })
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3600)
  }

  function record(action: { label: string }, text: string, status: HistoryItem["status"] = "completed") {
    setHistory((current) => [
      { id: Date.now(), text, action: action.label, status, time: "Now" },
      ...current,
    ].slice(0, 5))
  }

  function applyExecutionResult(
    result: LexiconExecutionResult,
    text: string,
    source: ActionSource,
    surfaceOverride?: PendingSurface | null
  ) {
    const interactionSurface = surfaceOverride ?? (source === "manual" ? "manual" : pendingSurface ?? "agent")
    setLastExecution(result)
    const pending = lexicon.pending()
    setPendingExecution(pending)
    setPendingDraft(pending?.input ?? {})
    setPendingSurface(pending ? interactionSurface : null)
    if (interactionSurface === "agent") {
      setAgentNotice(result.status === "failed" ? result.message : null)
    }

    if (result.status === "completed") {
      if (result.capability) record(result.capability, text)
      if (interactionSurface === "manual") notify(result.message)
      else setAgentPhase(source === "live" && liveSession.current ? "listening" : "idle")
      return
    }
    if (result.status === "needs-input" || result.status === "needs-confirmation") {
      if (result.capability) record(result.capability, text, "awaiting")
      if (interactionSurface === "manual") setVoiceOpen(false)
      else {
        setVoiceMenuOpen(false)
        setVoiceOpen(true)
        setAgentPhase(source === "live" ? "listening" : "idle")
      }
      return
    }
    if (result.status === "cancelled") {
      if (interactionSurface === "manual") notify(result.message)
      else setAgentPhase(source === "live" && liveSession.current ? "listening" : "idle")
      return
    }
    if (result.status === "failed") {
      if (interactionSurface === "manual") notify(result.message)
      else setAgentPhase("error")
    }
  }

  async function runCapability(
    capabilityId: string,
    input: LexiconInput,
    text: string,
    source: ActionSource
  ) {
    const result = await lexicon.invoke(capabilityId, input, { source })
    applyExecutionResult(result, text, source)
    return result
  }
  runCapabilityRef.current = runCapability

  function runManualAction(action: MappedAction, text: string, input: LexiconInput = {}) {
    void runCapability(action.id, input, text, "manual")
  }

  async function continuePending() {
    const surface = pendingSurface
    const result = await lexicon.continuePending(pendingDraft)
    applyExecutionResult(result, pendingExecution?.capability.label ?? "Continue action", "ui", surface)
    if (surface === "agent") appendChatMessage("assistant", result.message, result.status === "completed" ? result : undefined)
  }

  async function confirmPending() {
    const capability = pendingExecution?.capability
    const surface = pendingSurface
    if (!capability) return
    if (surface === "agent") appendChatMessage("user", "Confirm")
    const result = await lexicon.confirmPending(pendingDraft)
    applyExecutionResult(result, capability.label, "ui", surface)
    if (surface === "agent") appendChatMessage("assistant", result.message, result.status === "completed" ? result : undefined)
    if (result.status === "completed" && liveSession.current) {
      liveSession.current.sendRealtimeInput({
        text: `The user confirmed ${capability.label} in the product UI. It completed successfully: ${result.message}`,
      })
    }
  }

  function cancelPending() {
    const surface = pendingSurface
    if (surface === "agent") appendChatMessage("user", "Cancel")
    const result = lexicon.cancelPending()
    applyExecutionResult(result, result.capability?.label ?? "Cancel action", "ui", surface)
    if (surface === "agent") appendChatMessage("assistant", result.message)
    if (surface === "agent" && liveSession.current) {
      liveSession.current.sendRealtimeInput({
        text: `The user cancelled ${result.capability?.label ?? "the pending action"} in the product UI.`,
      })
    }
  }

  function appendTranscript(current: string, next: string) {
    if (!next) return current
    if (!current || next.startsWith(current)) return next
    if (current.endsWith(next)) return current
    return `${current}${/\s$/.test(current) || /^\s|^[,.;:!?]/.test(next) ? "" : " "}${next}`
  }

  async function stopLiveVoice() {
    liveClosing.current = true
    const wasCompact = voiceCompact
    commitLiveTranscript()
    const session = liveSession.current
    liveSession.current = null
    if (session) {
      try { session.sendRealtimeInput({ audioStreamEnd: true }) } catch {}
      try { session.close() } catch {}
    }
    const microphone = liveMicrophone.current
    liveMicrophone.current = null
    if (microphone) await microphone.stop().catch(() => {})
    const player = livePlayer.current
    livePlayer.current = null
    if (player) await player.close().catch(() => {})
    liveUserTranscript.current = ""
    liveAssistantTranscript.current = ""
    setLiveUserDraft("")
    setLiveAssistantDraft("")
    setInputLevel(0)
    setListening(false)
    setAgentPhase("idle")
    setAgentNotice(null)
    setVoiceCompact(false)
    if (wasCompact) setVoiceMenuOpen(true)
  }

  async function resolveLiveToolCalls(session: Session, message: LiveServerMessage) {
    const calls = message.toolCall?.functionCalls ?? []
    if (!calls.length) return
    setAgentPhase("thinking")
    const functionResponses = await Promise.all(calls.map(async (call) => {
      const result = await lexicon.invokeToolCall(call.name ?? "", call.args ?? {}, { source: "live" })
      const text = liveUserTranscript.current.trim() || lastLiveUserMessage.current || result.capability?.label || "Voice action"
      applyExecutionResult(result, text, "live")
      appendChatMessage("assistant", result.message, result.status === "completed" ? result : undefined)
      return {
        id: call.id,
        name: call.name,
        response: lexicon.functionResponse(result),
      }
    }))
    if (liveSession.current === session) session.sendToolResponse({ functionResponses })
  }

  async function startLiveVoice(compact = true) {
    if (liveSession.current || agentPhase === "connecting") return
    liveClosing.current = false
    liveUserTranscript.current = ""
    liveAssistantTranscript.current = ""
    setLiveUserDraft("")
    setLiveAssistantDraft("")
    setVoiceOpen(true)
    setVoiceMenuOpen(false)
    setVoiceCompact(compact)
    setAgentPhase("connecting")
    setAgentNotice(null)

    const player = new GeminiPcmPlayer(24000)
    livePlayer.current = player
    try {
      await player.prepare()
      const response = await fetch("/api/live/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manifest: lexicon.manifest() }),
      })
      const payload = (await response.json()) as { token?: string; model?: string; error?: string }
      if (!response.ok || !payload.token || !payload.model) throw new Error(payload.error ?? "Live voice could not start.")

      const ai = new GoogleGenAI({ apiKey: payload.token, httpOptions: { apiVersion: "v1alpha" } })
      const session = await ai.live.connect({
        model: payload.model,
        config: { responseModalities: [Modality.AUDIO] },
        callbacks: {
          onmessage: (message) => {
            const content = message.serverContent
            if (content?.interrupted) {
              livePlayer.current?.interrupt()
              commitLiveTranscript("assistant")
              setAgentPhase("listening")
            }
            const finalInput = content?.inputTranscription
            const interimInput = content?.interimInputTranscription
            const incoming = finalInput?.text ?? interimInput?.text
            if (incoming) {
              liveUserTranscript.current = appendTranscript(liveUserTranscript.current, incoming)
              lastLiveUserMessage.current = liveUserTranscript.current.trim()
              setLiveUserDraft(liveUserTranscript.current)
            }
            if (finalInput?.finished) commitLiveTranscript("user")

            const outputTranscription = content?.outputTranscription
            if (outputTranscription?.text) {
              liveAssistantTranscript.current = appendTranscript(liveAssistantTranscript.current, outputTranscription.text)
              setLiveAssistantDraft(liveAssistantTranscript.current)
            }
            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data && part.inlineData.mimeType?.startsWith("audio/")) {
                setAgentPhase("speaking")
                void livePlayer.current?.enqueue(part.inlineData.data)
              }
              if (part.text && !outputTranscription?.text) {
                liveAssistantTranscript.current = appendTranscript(liveAssistantTranscript.current, part.text)
                setLiveAssistantDraft(liveAssistantTranscript.current)
              }
            }
            if (outputTranscription?.finished) commitLiveTranscript("assistant")
            if (message.toolCall?.functionCalls?.length) void resolveLiveToolCalls(session, message)
            if (content?.turnComplete) {
              commitLiveTranscript()
              setAgentNotice(null)
              if (!lexicon.pending()) setAgentPhase("listening")
            }
          },
          onerror: () => {
            commitLiveTranscript()
            liveSession.current = null
            setListening(false)
            setVoiceMenuOpen(false)
            setVoiceCompact(compact)
            setAgentPhase("error")
            const message = "The Live connection had an error. You can reconnect or type a message."
            setAgentNotice(message)
            appendChatMessage("assistant", message)
          },
          onclose: () => {
            commitLiveTranscript()
            liveSession.current = null
            if (!liveClosing.current) {
              setListening(false)
              setVoiceMenuOpen(false)
              setVoiceCompact(compact)
              setAgentPhase("error")
              const message = "Live voice disconnected. Reconnect when you are ready."
              setAgentNotice(message)
              appendChatMessage("assistant", message)
            }
          },
        },
      })
      liveSession.current = session
      const microphone = new MicrophonePcmStream(
        (audio) => {
          if (liveSession.current === session) session.sendRealtimeInput({ audio })
        },
        setInputLevel
      )
      liveMicrophone.current = microphone
      await microphone.start()
      setListening(true)
      setAgentPhase("listening")
      setAgentNotice(null)
    } catch (error) {
      try { liveSession.current?.close() } catch {}
      liveSession.current = null
      await liveMicrophone.current?.stop().catch(() => {})
      liveMicrophone.current = null
      await livePlayer.current?.close().catch(() => {})
      livePlayer.current = null
      setListening(false)
      setVoiceMenuOpen(false)
      setVoiceCompact(compact)
      setAgentPhase("error")
      const message = error instanceof Error ? error.message : "Live voice could not start. Type a message instead."
      setAgentNotice(message)
      appendChatMessage("assistant", message)
    }
  }

  function toggleListening() {
    if (liveSession.current || agentPhase === "connecting") void stopLiveVoice()
    else void startLiveVoice(assistantMode !== "chat")
  }

  async function submitCommand(value: string) {
    const message = value.trim()
    if (!message) return
    setCommand("")
    appendChatMessage("user", message)
    setAgentNotice(null)
    if (liveSession.current) {
      lastLiveUserMessage.current = message
      liveSession.current.sendRealtimeInput({ text: message })
      setAgentPhase("thinking")
      return
    }
    setAgentPhase("thinking")

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: message,
          manifest: lexicon.manifest(),
          pending: lexicon.pendingContext(),
        }),
      })
      const result = (await response.json()) as {
        call?: { name: string; args?: LexiconInput }
        message?: string
        provider?: string
        diagnostic?: string
        error?: string
      }
      if (!response.ok) throw new Error(result.error ?? "The agent request failed.")
      if (result.call) {
        const execution = await lexicon.invokeToolCall(result.call.name, result.call.args ?? {}, {
          source: "typed",
        })
        applyExecutionResult(execution, message, "typed")
        const assistantMessage = result.diagnostic && execution.status !== "completed"
          ? `${execution.message} ${result.diagnostic}`
          : execution.message
        appendChatMessage("assistant", assistantMessage, execution.status === "completed" ? execution : undefined)
        if (result.diagnostic && execution.status !== "completed") {
          setAgentNotice(assistantMessage)
        }
        return
      }
      if (lexicon.pending() && /cancel/i.test(result.message ?? "")) {
        const execution = lexicon.cancelPending()
        applyExecutionResult(execution, message, "typed")
        appendChatMessage("assistant", execution.message)
        return
      }
      const assistantMessage = result.message ?? result.diagnostic ?? "I need a little more detail."
      appendChatMessage("assistant", assistantMessage)
      setAgentNotice(null)
      setAgentPhase("idle")
    } catch (error) {
      const message = error instanceof Error ? error.message : "The voice agent is temporarily unavailable."
      setAgentNotice(message)
      appendChatMessage("assistant", message)
      setAgentPhase("error")
    }
  }

  function runAgentCommand(value: string) {
    setVoiceMenuOpen(false)
    setVoiceCompact(false)
    setVoiceOpen(true)
    void submitCommand(value)
  }

  function copySnippet() {
    navigator.clipboard?.writeText(
      `const lexicon = createLexiconRuntime({
  app: "rillwork",
  capabilities: [
    {
      id: "create-customer",
      label: "Create customer",
      kind: "create",
      fields: [{ name: "name", label: "Name", type: "string", required: true }],
      confirmation: "always",
      handler: async ({ input }) => customers.create(input),
    },
  ],
})`
    )
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  function updateSettings(next: RillworkSettings) {
    demoStore.setSettings(next)
    setSettings(next)
  }

  function updateProfile(next: RillworkProfile) {
    demoStore.setProfile(next)
    setProfile(next)
  }

  const contextValue: RillworkDemoContextValue = {
    route,
    activeLabel,
    voiceOpen,
    setVoiceOpen: (open) => {
      if (open) {
        setVoiceMenuOpen(true)
        setVoiceCompact(false)
      }
      setVoiceOpen(open)
    },
    listening,
    lastExecution,
    pendingExecution,
    pendingDraft,
    setPendingDraft,
    command,
    setCommand,
    filterActive,
    setFilterActive,
    copied,
    agentNotice,
    toast,
    dismissToast: () => setToast(null),
    searchOpen,
    setSearchOpen,
    agentPhase,
    inputLevel,
    customers,
    orders,
    invoices,
    settings,
    profile,
    approvalStatus,
    unreadNotifications,
    notificationsOpen,
    setNotificationsOpen,
    history,
    voiceInput,
    navigate,
    notify,
    runManualAction,
    runAgentCommand,
    continuePending,
    confirmPending,
    cancelPending,
    toggleListening,
    submitCommand,
    copySnippet,
    updateSettings,
    updateProfile,
    setUnreadNotifications,
  }

  if (surface === "workspace") {
    return (
      <RillworkDemoContext.Provider value={contextValue}>
      <main className="workspace-shell">
        <aside className="app-sidebar">
          <Link className="sidebar-brand" href="/" aria-label="Back to Lexicon home">
            <Logo />
          </Link>
          <div className="workspace-switcher">
            <RillworkMark className="workspace-avatar" />
            <span><strong>{RILLWORK_BRAND.name}</strong><small>{RILLWORK_BRAND.descriptor}</small></span>
          </div>
          <nav className="app-nav" aria-label="Application">
            <p>Workspace</p>
            {navItems.map((item) => {
              const Icon = item.icon
              const selected = route === item.id
              return (
                <button
                  key={item.id}
                  data-lexicon={`${item.id}-nav`}
                  className={selected ? "is-active" : ""}
                  onClick={() => navigate(item.id)}
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                </button>
              )
            })}
            <p>Account</p>
            <button data-lexicon="settings-nav" className={route === "settings" ? "is-active" : ""} onClick={() => navigate("settings")}><Settings size={17} /><span>Settings</span></button>
            <button className={route === "console" ? "is-active" : ""} onClick={() => navigate("console")}><Code2 size={17} /><span>Lexicon console</span></button>
          </nav>
          <button className="sidebar-agent" onClick={openAssistant}>
            <span className="sidebar-agent__icon"><MessageCircle size={16} /></span>
            <span><strong>Lexicon is ready</strong><small>Chat or use voice</small></span>
            <ChevronRight size={16} />
          </button>
          <button className={route === "profile" ? "account-row is-active" : "account-row"} onClick={() => navigate("profile")}>
            <span className="avatar avatar--green">RC</span>
            <span><strong>Rhea Calder</strong><small>Operations lead</small></span>
            <MoreHorizontal size={17} />
          </button>
        </aside>

        <section className="app-stage">
          <header className="app-topbar">
            <div className="workspace-path" aria-label={`${RILLWORK_BRAND.name}, ${activeLabel}`}>
              <RillworkMark className="workspace-path__mark" />
              <span className="workspace-path__copy">
                <small>{RILLWORK_BRAND.name} workspace</small>
                <strong>{activeLabel}</strong>
              </span>
            </div>
            <div className="topbar-actions">
              <button className={searchOpen ? "icon-button is-active" : "icon-button"} onClick={() => setSearchOpen(true)} aria-label="Search"><Search size={18} /></button>
              <div>
                <button
                  className={notificationsOpen ? "icon-button notification-button is-active" : "icon-button notification-button"}
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  aria-label="Notifications"
                >
                  <Bell size={18} />
                  {unreadNotifications.size > 0 && <StatusPip tone="amber" />}
                </button>
              </div>
              <button className={voiceOpen ? "topbar-voice is-active" : "topbar-voice"} aria-pressed={voiceOpen} onClick={openAssistant}><MessageCircle size={16} /> Assistant <kbd>Space</kbd></button>
            </div>
            {notificationsOpen && (
              <NotificationsOverlay
                unread={unreadNotifications}
                onUnreadChange={setUnreadNotifications}
                onNotify={notify}
                onClose={() => setNotificationsOpen(false)}
              />
            )}
          </header>
          <motion.section
            key={pathname}
            className="app-content"
            initial={reduceMotion ? false : { opacity: 0.82 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.18, ease: [0.23, 1, 0.32, 1] }}
          >
            {children}
          </motion.section>
        </section>

        <div
          ref={assistantFloat}
          className={`assistant-float assistant-float--${assistantMode}`}
          data-mode={assistantMode}
        >
          {assistantMode === "launcher" && (
            <button
              className="assistant-launcher"
              onPointerDown={startAssistantDrag}
              onPointerMove={moveAssistant}
              onPointerUp={endAssistantDrag}
              onPointerCancel={endAssistantDrag}
              onClick={activateAssistantLauncher}
              aria-label="Open Lexicon assistant"
            >
              <VoiceOrb listening={listening} />
              <span><strong>Lexicon</strong><small>{listening ? "Live" : "Ask or speak"}</small></span>
            </button>
          )}

          {assistantMode === "menu" && (
            <aside className="assistant-panel assistant-panel--menu" aria-label="Open Lexicon">
              <header
                className="assistant-panel__header assistant-drag-handle"
                onPointerDown={startAssistantDrag}
                onPointerMove={moveAssistant}
                onPointerUp={endAssistantDrag}
                onPointerCancel={endAssistantDrag}
              >
                <div className="assistant-panel__identity">
                  <GripVertical size={14} />
                  <Logo compact />
                  <span><strong>Lexicon</strong><small>How do you want to talk?</small></span>
                </div>
                <div className="assistant-panel__controls" onPointerDown={(event) => event.stopPropagation()}>
                  <button className="assistant-icon-button" onClick={() => setVoiceOpen(false)} aria-label="Close assistant"><X size={17} /></button>
                </div>
              </header>
              <div className="assistant-menu-actions">
                <button onClick={openExpandedChat}>
                  <span><MessageCircle size={17} /></span>
                  <span><strong>Open chat</strong><small>Type, review actions, and keep the full conversation.</small></span>
                  <ChevronRight size={16} />
                </button>
                <button onClick={() => void startLiveVoice(true)}>
                  <span><Mic size={17} /></span>
                  <span><strong>Start voice</strong><small>Stay compact and show only the current turn.</small></span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </aside>
          )}

          {assistantMode === "chat" && (
            <aside className="assistant-panel assistant-panel--chat" aria-label="Lexicon assistant">
              <header
                className="assistant-panel__header assistant-drag-handle"
                onPointerDown={startAssistantDrag}
                onPointerMove={moveAssistant}
                onPointerUp={endAssistantDrag}
                onPointerCancel={endAssistantDrag}
              >
                <div className="assistant-panel__identity">
                  <GripVertical size={14} />
                  <Logo compact />
                  <span><strong>Lexicon</strong><small>{agentPhase === "error" ? "Needs attention" : listening ? "Voice is live" : RILLWORK_BRAND.name}</small></span>
                </div>
                <div className="assistant-panel__controls" onPointerDown={(event) => event.stopPropagation()}>
                  <span className={`assistant-context-badge ${listening ? "is-live" : ""}`}>
                    <StatusPip /> {pendingExecution ? "Action pending" : listening ? "Voice live" : "Chat"}
                  </span>
                  <button
                    className="assistant-icon-button"
                    onClick={() => listening ? setVoiceCompact(true) : setVoiceOpen(false)}
                    aria-label={listening ? "Minimize live voice" : "Close assistant"}
                  >
                    {listening ? <Minimize2 size={16} /> : <X size={17} />}
                  </button>
                </div>
              </header>

              <AgentConversation
                messages={chatMessages}
                userDraft={liveUserDraft}
                assistantDraft={liveAssistantDraft}
                phase={agentPhase}
                inputLevel={inputLevel}
                scrollRef={voiceConversation}
              >
                {pendingExecution && pendingSurface === "agent" && (
                  <PendingCapabilityCard
                    pending={pendingExecution}
                    draft={pendingDraft}
                    onChange={(name, value) => setPendingDraft((current) => ({ ...current, [name]: value }))}
                    onContinue={() => void continuePending()}
                    onConfirm={() => void confirmPending()}
                    onCancel={cancelPending}
                  />
                )}
                {chatMessages.length === 1 && !liveUserDraft && !liveAssistantDraft && (
                  <div className="assistant-starters">
                    {commandExamples.slice(0, 3).map((example) => (
                      <button key={example} onClick={() => void submitCommand(example)}>{example}</button>
                    ))}
                  </div>
                )}
              </AgentConversation>

              <form className="assistant-composer" onSubmit={(event) => { event.preventDefault(); void submitCommand(command) }}>
                <input
                  ref={voiceInput}
                  value={command}
                  onChange={(event) => setCommand(event.target.value)}
                  placeholder="Message Lexicon"
                  aria-label="Message Lexicon"
                />
                <button
                  type="button"
                  className={listening ? "assistant-mic is-active" : "assistant-mic"}
                  onClick={toggleListening}
                  aria-label={listening ? "End live voice session" : "Start live voice session"}
                >
                  <Mic size={16} />
                </button>
                <button type="submit" className="assistant-send" aria-label="Send message" disabled={!command.trim()}>
                  <Send size={15} />
                </button>
              </form>
            </aside>
          )}

          {assistantMode === "live" && (
            <aside className="assistant-panel assistant-panel--live" aria-label="Lexicon live conversation">
              <header
                className="assistant-panel__header assistant-drag-handle"
                onPointerDown={startAssistantDrag}
                onPointerMove={moveAssistant}
                onPointerUp={endAssistantDrag}
                onPointerCancel={endAssistantDrag}
              >
                <div className="assistant-panel__identity">
                  <GripVertical size={14} />
                  <VoiceOrb listening />
                  <span><strong>{agentPhase === "speaking" ? "Lexicon is speaking" : agentPhase === "thinking" ? "Lexicon is working" : agentPhase === "connecting" ? "Connecting" : "Listening"}</strong><small>Live voice</small></span>
                </div>
                <div className="assistant-panel__controls" onPointerDown={(event) => event.stopPropagation()}>
                  <button className="assistant-icon-button" onClick={() => setVoiceCompact(false)} aria-label="Expand conversation"><Maximize2 size={16} /></button>
                  <button
                    className="assistant-icon-button"
                    onClick={() => { void stopLiveVoice().then(() => setVoiceOpen(false)) }}
                    aria-label="End and close live voice"
                  >
                    <X size={17} />
                  </button>
                </div>
              </header>
              <AgentConversation
                messages={chatMessages}
                userDraft={liveUserDraft}
                assistantDraft={liveAssistantDraft}
                phase={agentPhase}
                inputLevel={inputLevel}
                compact
                scrollRef={voiceConversation}
              />
              {pendingExecution && pendingSurface === "agent" && (
                <button className="assistant-pending-peek" onClick={() => setVoiceCompact(false)}>
                  <span className="assistant-pending-peek__icon"><LockKeyhole size={15} /></span>
                  <span>
                    <small>{pendingExecution.status === "needs-confirmation" ? "Ready for review" : "Details needed"}</small>
                    <strong>{pendingExecution.capability.label}</strong>
                  </span>
                  <Maximize2 size={15} />
                </button>
              )}
              <footer className="assistant-live-footer">
                <div className="assistant-live-meter" aria-hidden>
                  <i style={{ transform: `scaleY(${0.3 + inputLevel})` }} /><i /><i /><i /><i /><i /><i />
                </div>
                <button onClick={() => void stopLiveVoice()}><span /> End voice</button>
              </footer>
            </aside>
          )}
        </div>
        {pendingExecution && pendingSurface === "manual" && (
          <ManualActionDialog
            pending={pendingExecution}
            draft={pendingDraft}
            onChange={(name, value) => setPendingDraft((current) => ({ ...current, [name]: value }))}
            onContinue={() => void continuePending()}
            onConfirm={() => void confirmPending()}
            onCancel={cancelPending}
          />
        )}
        {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} onSelect={(selectedRoute) => { navigate(selectedRoute); setSearchOpen(false) }} />}
        {toast && <div className="app-toast" role="status"><CheckCircle2 size={16} /><span>{toast.message}</span><button onClick={() => setToast(null)} aria-label="Dismiss notification"><X size={14} /></button></div>}
      </main>
      </RillworkDemoContext.Provider>
    )
  }

  return (
    <main className="marketing-shell">
      <header className="marketing-nav">
        <button className="marketing-nav__brand" aria-label="Return to top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <Logo />
        </button>
        <nav aria-label="Primary navigation">
          <a href="#how-it-works">How it maps</a>
          <a href="#platform">Action graph</a>
          <a href="#developers">SDK</a>
        </nav>
        <div><Link className="text-link" href="/login">Sign in</Link><Link className="text-link" href="/console">Console</Link><Link className="nav-cta" href="/console/overview">Launch demo <ArrowUpRight size={15} /></Link></div>
      </header>

      <HeroDitheringRoot className="marketing-hero" srTitle="">
        <TextureOverlay texture="noise" opacity={0.1} className="marketing-hero__texture" />
        <div className="hero-copy">
          <h1>Software that answers back.</h1>
          <p>Your product already knows what to do. Lexicon gives it a voice grounded in the actions, schemas, and rules you trust.</p>
          <div className="hero-actions"><Link className="primary-cta" href="/console/overview"><Mic size={17} /> Try the live demo</Link><a href="#developers">See the SDK <ArrowDownRight size={16} /></a></div>
        </div>
        <div className="hero-swirl-container" aria-label="Live action demonstration">
          <Dithering
            className="hero-spiral"
            colorBack="#11120f00"
            colorFront="#d5ff5f"
            fit="contain"
            scale={0.6}
            shape="swirl"
            size={2}
            speed={0.48}
            type="4x4"
          />
          <div className="hero-voice-visualizer" aria-hidden>
            <AgentAudioVisualizerBar
              color="#d5ff5f"
              size="lg"
              state="speaking"
            />
          </div>
        </div>
      </HeroDitheringRoot>

      <section className="proof-strip"><span>Mapped into real product surfaces</span><div><strong>Rillwork</strong><strong>Oriel</strong><strong>Stillroom</strong><strong>Northmill</strong><strong>Saltbox</strong></div></section>

      <section id="how-it-works" className="workflow-section">
        <ScrollReveal delay={0.04}>
          <MappedProductFlow onRun={launchMappedAction} onConsole={() => openWorkspace("console")} />
        </ScrollReveal>
      </section>

      <section id="platform" className="platform-section">
        <ScrollReveal className="platform-copy"><h2>Not another agent<br />that hopes for the best.</h2><p>Browser agents guess from pixels. Lexicon executes capabilities your app defines, with typed inputs, mapped destinations, and confirmation rules.</p><button className="section-link" onClick={() => openWorkspace("console")}>Explore the action map <ChevronRight size={16} /></button></ScrollReveal>
        <ScrollReveal className="architecture-graphic" delay={0.08}>
          <ProductModelSurface onRun={launchMappedAction} />
        </ScrollReveal>
      </section>

      <section id="developers" className="developer-section">
        <ScrollReveal className="developer-copy">
          <h2>One dependency.<br />One product model.</h2>
          <p>Bring Lexicon to an existing app in minutes. Start with automatic scanning, then make important paths explicit in a dashboard your whole team can understand.</p>
          <div className="developer-path" aria-label="Integration path">
            <span><b>01</b> Install</span><ChevronRight size={14} />
            <span><b>02</b> Scan</span><ChevronRight size={14} />
            <span><b>03</b> Review</span>
          </div>
        </ScrollReveal>
        <ScrollReveal className="terminal-shell" delay={0.1}>
          <div className="terminal-chrome">
            <span className="terminal-package"><Package size={14} /><strong>@lexicon/sdk</strong></span>
          </div>
          <TerminalAnimationRoot tabs={terminalTabs} alwaysDark className="lexicon-terminal">
            <TerminalAnimationWindow backgroundColor="#11120f" minHeight="19rem" animateOnVisible>
              <TerminalAnimationContent className="terminal-content">
                <TerminalAnimationTabList className="terminal-tabs">
                  {terminalTabs.map((tab, index) => <TerminalAnimationTabTrigger className="terminal-tab" index={index} key={tab.label}>{tab.label}</TerminalAnimationTabTrigger>)}
                </TerminalAnimationTabList>
                <div className="terminal-command"><span>➜</span><TerminalAnimationCommandBar /></div>
                <TerminalAnimationOutput className="terminal-output" renderLine={(line, _index, visible) => visible ? <p className={line.color}>{line.text}</p> : null} />
              </TerminalAnimationContent>
            </TerminalAnimationWindow>
          </TerminalAnimationRoot>
        </ScrollReveal>
      </section>

      <section className="voice-examples-section">
        <ScrollReveal className="section-intro"><h2>A conversation on the surface.<br />A defined action underneath.</h2></ScrollReveal>
        <ScrollReveal className="voice-examples" delay={0.08}>
          {commandExamples.map((example) => {
            const action = resolveVoiceCommand(example)
            return <button key={example} onClick={() => launchMappedAction(action, example)}><span><Mic size={15} /> {example}</span><span className="command-result">{action.label}<ChevronRight size={15} /></span></button>
          })}
        </ScrollReveal>
      </section>

      <ScrollReveal className="final-cta"><div><h2>Make your product<br />speak for itself.</h2></div><Link className="primary-cta" href="/console/overview"><Mic size={17} /> Launch the demo</Link></ScrollReveal>
      <footer className="marketing-footer"><Logo /><span>© 2026 Lexicon, Inc.</span><div><a href="#platform">Platform</a><a href="#developers">Developers</a><Link href="/console">Console</Link></div></footer>
    </main>
  )
}

export function LexiconLandingPage() {
  return <LexiconExperience surface="marketing" />
}

export function RillworkConsoleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <LexiconExperience surface="workspace">{children}</LexiconExperience>
}

export function RillworkRoutePage({ route }: { route: AppRoute }) {
  const demo = useRillworkDemo()
  return (
    <View
      route={route}
      filterActive={demo.filterActive}
      customers={demo.customers}
      orders={demo.orders}
      invoices={demo.invoices}
      settings={demo.settings}
      profile={demo.profile}
      approvalStatus={demo.approvalStatus}
      unreadNotifications={demo.unreadNotifications}
      onNavigate={demo.navigate}
      onAction={demo.runManualAction}
      onAgentCommand={demo.runAgentCommand}
      onCopy={demo.copySnippet}
      copied={demo.copied}
      onNotify={demo.notify}
      onFilterChange={demo.setFilterActive}
      onSettingsChange={demo.updateSettings}
      onProfileChange={demo.updateProfile}
      onUnreadNotificationsChange={demo.setUnreadNotifications}
    />
  )
}

function View({
  route,
  filterActive,
  customers,
  orders,
  invoices,
  settings,
  profile,
  approvalStatus,
  unreadNotifications,
  onNavigate,
  onAction,
  onAgentCommand,
  onCopy,
  copied,
  onNotify,
  onFilterChange,
  onSettingsChange,
  onProfileChange,
  onUnreadNotificationsChange,
}: {
  route: AppRoute
  filterActive: boolean
  customers: RillworkCustomer[]
  orders: RillworkOrder[]
  invoices: RillworkInvoice[]
  settings: RillworkSettings
  profile: RillworkProfile
  approvalStatus: "pending" | "approved" | "rejected"
  unreadNotifications: Set<string>
  onNavigate: (route: AppRoute) => void
  onAction: ManualActionHandler
  onAgentCommand: (command: string) => void
  onCopy: () => void
  copied: boolean
  onNotify: (message: string) => void
  onFilterChange: (active: boolean) => void
  onSettingsChange: (settings: RillworkSettings) => void
  onProfileChange: (profile: RillworkProfile) => void
  onUnreadNotificationsChange: (notifications: Set<string>) => void
}) {
  if (route === "analytics") return <AnalyticsView onAction={onAction} onNavigate={onNavigate} onNotify={onNotify} />
  if (route === "customers") return <CustomersView customers={customers} onAction={onAction} onNotify={onNotify} />
  if (route === "orders") return <OrdersView orders={orders} filterActive={filterActive} onFilterChange={onFilterChange} onAction={onAction} onNotify={onNotify} />
  if (route === "invoices") return <InvoicesView invoices={invoices} onAction={onAction} />
  if (route === "settings") return <SettingsView settings={settings} onChange={onSettingsChange} onNotify={onNotify} />
  if (route === "notifications") return <NotificationsView unread={unreadNotifications} onUnreadChange={onUnreadNotificationsChange} onNotify={onNotify} />
  if (route === "profile") return <ProfileView profile={profile} onChange={onProfileChange} onNotify={onNotify} />
  if (route === "console") return <ConsoleView onAction={onAction} onAgentCommand={onAgentCommand} onCopy={onCopy} copied={copied} />
  return <OverviewView approvalStatus={approvalStatus} onNavigate={onNavigate} onAction={onAction} />
}

function PageHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-header"><div><h1>{title}</h1><p>{description}</p></div>{action}</div>
}

function OverviewView({ approvalStatus, onNavigate, onAction }: { approvalStatus: "pending" | "approved" | "rejected"; onNavigate: (route: AppRoute) => void; onAction: ManualActionHandler }) {
  return <>
    <PageHeader title="Good morning, Rhea." description="Renewals, approvals, and account activity across Rillwork." />
    <div className="overview-grid">
      <section className="revenue-panel"><div className="panel-heading"><div><span>Recognized revenue</span><strong>{RILLWORK_METRICS.revenue} <em><ArrowUpRight size={14} /> {RILLWORK_METRICS.growth}</em></strong></div><button onClick={() => onNavigate("analytics")}>View analytics <ChevronRight size={15} /></button></div><RevenueChart /><div className="chart-axis"><span>Jul 1</span><span>Jul 8</span><span>Jul 16</span></div></section>
      <section className="quick-actions">
        <div className="panel-heading">
          <div>
            <span>Quick actions</span>
            <strong>Run account work</strong>
          </div>
          <Bot size={20} />
        </div>
        <button data-lexicon="create-customer" onClick={() => onAction(actionById("create-customer")!, "Create a new customer")}>
          <span className="action-icon"><Users size={18} /></span>
          <span><strong>Create customer</strong><small>Open a trade account</small></span>
          <ChevronRight size={17} />
        </button>
        <button data-lexicon="create-invoice" onClick={() => onAction(actionById("create-invoice")!, "Create an invoice")}>
          <span className="action-icon"><FileText size={18} /></span>
          <span><strong>Create invoice</strong><small>Prepare a renewal draft</small></span>
          <ChevronRight size={17} />
        </button>
        <button data-lexicon="create-order" onClick={() => onAction(actionById("create-order")!, "Create an order")}>
          <span className="action-icon"><Package size={18} /></span>
          <span><strong>Create order</strong><small>Record a subscription</small></span>
          <ChevronRight size={17} />
        </button>
        <button data-lexicon="export-orders" onClick={() => onAction(actionById("export-orders")!, "Export all orders")}>
          <span className="action-icon"><Download size={18} /></span>
          <span><strong>Export orders</strong><small>Download CSV</small></span>
          <ChevronRight size={17} />
        </button>
      </section>
      <section className="activity-panel"><div className="panel-heading"><div><span>Approval queue</span><strong>{approvalStatus === "pending" ? "One decision is waiting" : `Request ${approvalStatus}`}</strong></div><button className="text-button" onClick={() => onNavigate("notifications")}>See activity</button></div><div className="approval-item" data-lexicon="approval-request"><span className="avatar avatar--peach">NA</span><div><strong>Niko at Kanso Workshop</strong><p>{approvalStatus === "pending" ? "Requested a move from Workshop to Foundry." : `Plan request ${approvalStatus}.`}</p></div>{approvalStatus === "pending" ? <button onClick={() => onAction(actionById("approve-request")!, "Approve the request")}>Review</button> : <CheckCircle2 size={18} />}</div><div className="activity-list"><span><Clock3 size={15} /> Kanso opened invoice INV-1438 <small>3h ago</small></span><span><CheckCircle2 size={15} /> Oriel House paid $7,680.00 <small>18m ago</small></span><span><Users size={15} /> Mina Okafor joined as analyst <small>Yesterday</small></span></div></section>
      <section className="signal-panel"><div><span className="eyeline"><Activity size={13} /> Renewal signal</span><h3>Seven of nine accounts renewed without a support handoff.</h3><button onClick={() => onNavigate("analytics")}>Review account health <ChevronRight size={15} /></button></div><div className="signal-bars"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div></section>
    </div>
  </>
}

function RevenueChart() {
  const bars = [28, 34, 31, 41, 38, 46, 43, 52, 48, 57, 54, 63, 59, 68, 64, 73, 70, 79, 76, 84, 88, 93]
  return (
    <div className="revenue-chart">
      {bars.map((height, index) => (
        <span
          key={index}
          style={{ height: `${height}%`, animationDelay: `${index * 18}ms` }}
          className={index >= bars.length - 4 ? "is-current" : ""}
        />
      ))}
    </div>
  )
}

function AnalyticsView({ onAction, onNavigate, onNotify }: { onAction: ManualActionHandler; onNavigate: (route: AppRoute) => void; onNotify: (message: string) => void }) {
  const [period, setPeriod] = useState<"Last 30 days" | "Last 7 days">("Last 30 days")
  return <>
    <PageHeader title="Analytics" description="Revenue, renewals, and account health for the current book." action={<div className="header-controls"><button className="button-secondary" onClick={() => { const next = period === "Last 30 days" ? "Last 7 days" : "Last 30 days"; setPeriod(next); onNotify(`Analytics range changed to ${next.toLowerCase()}.`) }}><Clock3 size={16} /> {period} <ChevronDown size={15} /></button><button data-lexicon="export-report" className="button-primary" onClick={() => onAction(actionById("export-report")!, "Export this report")}><Download size={16} /> Export</button></div>} />
    <div className="analytics-summary"><Metric label="Recognized revenue" value={RILLWORK_METRICS.revenue} change={`${RILLWORK_METRICS.growth} vs. last month`} /><Metric label="Active accounts" value={String(RILLWORK_METRICS.activeCustomers)} change="2 added this month" /><Metric label="Revenue per account" value={RILLWORK_METRICS.revenuePerCustomer} change="4.6% vs. last month" /></div>
    <section className="analytics-chart-panel"><div className="panel-heading"><div><span>Monthly recognized revenue</span><strong>{RILLWORK_METRICS.revenue}</strong></div><div className="chart-legend"><span><i /> This month</span><span><i /> Last month</span></div></div><LineGraph /></section>
    <div className="analytics-lower"><section className="source-list"><div className="panel-heading"><div><span>Account mix</span><strong>Revenue by plan</strong></div></div>{[["Foundry", "48%", "#d5ff5f"], ["Workshop", "37%", "#a7b583"], ["Bench", "15%", "#66705d"]].map(([label, amount, color]) => <div className="source-row" key={label}><span>{label}</span><div><i style={{ width: amount, backgroundColor: color }} /></div><strong>{amount}</strong></div>)}</section><section className="insight-card"><span className="eyeline"><Sparkles size={13} /> Lexicon insight</span><h3>Voice-assisted account reviews finish 22% faster.</h3><p>Measured across sessions that read an account, changed a plan, or prepared an invoice.</p><button onClick={() => onNavigate("console")}>Inspect agent sessions <ChevronRight size={15} /></button></section></div>
  </>
}

function Metric({ label, value, change }: { label: string; value: string; change: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong><small><ArrowUpRight size={13} /> {change}</small></div>
}

function LineGraph() {
  return <div className="line-graph"><div className="graph-grid"><i /><i /><i /><i /></div><svg viewBox="0 0 760 240" preserveAspectRatio="none" aria-label="Monthly recurring revenue chart"><path d="M0,186 C38,175 58,192 95,162 S148,148 180,155 S232,123 273,139 S330,111 372,126 S424,96 457,110 S510,74 554,94 S610,72 646,66 S700,34 760,42" fill="none" stroke="#d5ff5f" strokeWidth="3" vectorEffect="non-scaling-stroke" /><path d="M0,212 C47,199 81,212 118,193 S178,174 214,184 S266,165 303,168 S352,142 394,157 S454,132 486,145 S542,122 580,134 S636,102 674,116 S722,85 760,95" fill="none" stroke="#66705d" strokeWidth="2" strokeDasharray="6 6" vectorEffect="non-scaling-stroke" /></svg><div className="graph-labels"><span>Jul 1</span><span>Jul 8</span><span>Jul 15</span><span>Jul 22</span><span>Jul 30</span></div></div>
}

function CustomersView({ customers, onAction, onNotify }: { customers: RillworkCustomer[]; onAction: ManualActionHandler; onNotify: (message: string) => void }) {
  const [query, setQuery] = useState("")
  const [workshopOnly, setWorkshopOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const visibleCustomers = customers.filter((customer) => {
    const matchesQuery = `${customer.name} ${customer.owner} ${customer.plan}`.toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (!workshopOnly || customer.plan === "Workshop")
  })
  return <>
    <PageHeader title="Customers" description={`${customers.length} active fabrication accounts across three plans.`} action={<button data-lexicon="create-customer" className="button-primary" onClick={() => onAction(actionById("create-customer")!, "Create a new customer")}><Plus size={16} /> New customer</button>} />
    <div className="table-toolbar"><div className="table-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search accounts, owners, or plans" /></div><button className={workshopOnly ? "button-secondary is-active-control" : "button-secondary"} onClick={() => { setWorkshopOnly((active) => !active); onNotify(workshopOnly ? "Customer plan filter cleared." : "Showing Workshop customers only.") }}><ListFilter size={16} /> Workshop plan</button></div>
    <section className="data-table"><table><thead><tr><th><input type="checkbox" aria-label="Select all customers" /></th><th>Customer</th><th>Plan</th><th>Lifetime spend</th><th>Last activity</th><th /></tr></thead><tbody>{visibleCustomers.map((customer) => <tr key={customer.name}><td><input type="checkbox" aria-label={`Select ${customer.name}`} /></td><td><div className="customer-cell"><span className="avatar avatar--stone">{customer.initials}</span><div><strong>{customer.name}</strong><small>{customer.owner}</small></div></div></td><td><span className="plan-label">{customer.plan}</span></td><td>{customer.spend}</td><td>{customer.last}</td><td className="row-actions"><button className="row-menu" aria-expanded={activeMenu === customer.id} onClick={() => setActiveMenu((current) => current === customer.id ? null : customer.id)} aria-label={`Open actions for ${customer.name}`}><MoreHorizontal size={17} /></button>{activeMenu === customer.id && <div className="row-actions-menu"><button onClick={() => { setActiveMenu(null); onAction(actionById("update-customer")!, `Update ${customer.name}`, { customer: customer.id }) }}>Edit customer</button><button className="is-destructive" onClick={() => { setActiveMenu(null); onAction(actionById("delete-customer")!, `Delete ${customer.name}`, { customer: customer.id }) }}>Delete customer</button></div>}</td></tr>)}{visibleCustomers.length === 0 && <tr><td colSpan={6} className="empty-table">No customers match this view.</td></tr>}</tbody></table><div className="table-footer"><span>Page {page} · {visibleCustomers.length} matching customers</span><div><button onClick={() => { setPage((current) => Math.max(1, current - 1)); onNotify("Showing previous customer page.") }}>Previous</button><button onClick={() => { setPage((current) => current + 1); onNotify("Showing next customer page.") }}>Next</button></div></div></section>
  </>
}

function OrdersView({ orders, filterActive, onFilterChange, onAction, onNotify }: { orders: RillworkOrder[]; filterActive: boolean; onFilterChange: (active: boolean) => void; onAction: ManualActionHandler; onNotify: (message: string) => void }) {
  const [status, setStatus] = useState<"All orders" | "Open" | "Paid" | "Cancelled">("All orders")
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const visibleOrders = orders.filter((order) => status === "All orders" || order.status === status)
  return <>
    <PageHeader title="Orders" description={filterActive ? "Showing subscription orders placed in the last seven days." : `${orders.length} subscription orders across the active account book.`} action={<div className="header-controls"><button className="button-secondary" onClick={() => onAction(actionById("export-orders")!, "Export all orders")}><Download size={16} /> Export</button><button className="button-primary" onClick={() => onAction(actionById("create-order")!, "Create an order")}><Plus size={16} /> New order</button></div>} />
    <div className="table-toolbar"><div className="segmented-control">{(["All orders", "Open", "Paid", "Cancelled"] as const).map((tab) => <button key={tab} className={status === tab ? "is-selected" : ""} onClick={() => { setStatus(tab); onNotify(`Showing ${tab.toLowerCase()}.`) }}>{tab}</button>)}</div>{filterActive && <button className="filter-chip" onClick={() => { onFilterChange(false); onNotify("Last 7 days filter removed.") }}><Clock3 size={14} /> Last 7 days <X size={13} /></button>}</div>
    <section className="data-table" data-lexicon="orders-table"><table><thead><tr><th>Order</th><th>Customer</th><th>Product</th><th>Amount</th><th>Status</th><th>Date</th><th /></tr></thead><tbody>{visibleOrders.map((order) => <tr key={order.id}><td><strong>{order.id}</strong></td><td>{order.customer}</td><td>{order.product}</td><td>{order.amount}</td><td><span className={`status-label ${order.status === "Paid" ? "status-label--paid" : order.status === "Cancelled" ? "status-label--draft" : "status-label--open"}`}><StatusPip tone={order.status === "Paid" ? "lime" : order.status === "Cancelled" ? "gray" : "amber"} />{order.status}</span></td><td>{order.date}</td><td className="row-actions"><button className="row-menu" aria-expanded={activeMenu === order.id} onClick={() => setActiveMenu((current) => current === order.id ? null : order.id)} aria-label={`Open actions for ${order.id}`}><MoreHorizontal size={17} /></button>{activeMenu === order.id && <div className="row-actions-menu"><button onClick={() => { setActiveMenu(null); onAction(actionById("update-order")!, `Update ${order.id}`, { orderId: order.id }) }}>Change status</button><button className="is-destructive" onClick={() => { setActiveMenu(null); onAction(actionById("delete-order")!, `Delete ${order.id}`, { orderId: order.id }) }}>Delete order</button></div>}</td></tr>)}</tbody></table><div className="table-footer"><span>{visibleOrders.length} orders in the current view</span><span>Updated just now</span></div></section>
  </>
}

function InvoicesView({ invoices, onAction }: { invoices: RillworkInvoice[]; onAction: ManualActionHandler }) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  return <>
    <PageHeader title="Invoices" description={`${invoices.length} renewal and subscription invoices in the current ledger.`} action={<button data-lexicon="create-invoice" className="button-primary" onClick={() => onAction(actionById("create-invoice")!, "Create an invoice")}><Plus size={16} /> Create invoice</button>} />
    <div className="invoice-totals"><Metric label="Outstanding" value="$4,740.00" change="2 invoices due" /><Metric label="Paid this month" value="$23,340.00" change="6 invoices" /><Metric label="Overdue" value="$0.00" change="On track" /></div>
    <section className="data-table"><table><thead><tr><th>Invoice</th><th>Customer</th><th>Amount</th><th>Due date</th><th>Status</th><th /></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id}><td><strong>{invoice.id}</strong></td><td>{invoice.customer}</td><td>{invoice.amount}</td><td>{invoice.due}</td><td><span className={`status-label ${invoice.status === "Paid" ? "status-label--paid" : invoice.status === "Sent" ? "status-label--open" : "status-label--draft"}`}><StatusPip tone={invoice.status === "Paid" ? "lime" : invoice.status === "Sent" ? "amber" : "gray"} />{invoice.status}</span></td><td className="row-actions"><button className="row-menu" aria-expanded={activeMenu === invoice.id} onClick={() => setActiveMenu((current) => current === invoice.id ? null : invoice.id)} aria-label={`Open actions for ${invoice.id}`}><MoreHorizontal size={17} /></button>{activeMenu === invoice.id && <div className="row-actions-menu"><button onClick={() => { setActiveMenu(null); onAction(actionById("update-invoice")!, `Update ${invoice.id}`, { invoiceId: invoice.id }) }}>Edit invoice</button><button className="is-destructive" onClick={() => { setActiveMenu(null); onAction(actionById("delete-invoice")!, `Delete ${invoice.id}`, { invoiceId: invoice.id }) }}>Delete invoice</button></div>}</td></tr>)}</tbody></table></section>
  </>
}

function SettingsView({ settings, onChange, onNotify }: { settings: RillworkSettings; onChange: (settings: RillworkSettings) => void; onNotify: (message: string) => void }) {
  const [section, setSection] = useState("Workspace")
  const descriptions: Record<string, string> = {
    Workspace: "Identity, region, and operating defaults for this workspace.",
    Billing: "Subscription ownership, renewal timing, and billing contact.",
    Notifications: "Choose which account and revenue events need attention.",
    "API access": "Name the production integration and control its environment.",
    Security: "Set sign-in requirements, session length, and administrator access.",
  }
  return <>
    <PageHeader title="Settings" description={`Manage the ${RILLWORK_BRAND.name} workspace and its connected systems.`} />
    <div className="settings-layout">
      <nav className="settings-nav" aria-label="Settings sections">
        {Object.keys(descriptions).map((item) => <button key={item} className={section === item ? "is-active" : ""} onClick={() => setSection(item)}>{item}</button>)}
      </nav>
      <section className="settings-content">
        <div className="settings-heading"><h2>{section}</h2><p>{descriptions[section]}</p></div>
        {section === "Workspace" && <>
          <label>Workspace name<input value={settings.workspaceName} onChange={(event) => onChange({ ...settings, workspaceName: event.target.value })} /></label>
          <label>Workspace URL<div className="input-prefix"><span>rillwork.co/</span><input value={settings.workspaceUrl} onChange={(event) => onChange({ ...settings, workspaceUrl: event.target.value })} /></div></label>
          <label>Default currency<select value={settings.currency} onChange={(event) => onChange({ ...settings, currency: event.target.value as RillworkSettings["currency"] })}><option value="USD">USD — US dollar</option><option value="EUR">EUR — Euro</option></select></label>
          <label>Operating region<select defaultValue="North America"><option>North America</option><option>Europe</option><option>Asia Pacific</option></select></label>
        </>}
        {section === "Billing" && <>
          <label>Billing contact<input defaultValue="finance@rillwork.co" /></label>
          <label>Workspace plan<input defaultValue="Foundry — annual" disabled /></label>
          <label>Next renewal<input defaultValue="September 18, 2026" disabled /></label>
        </>}
        {section === "Notifications" && <>
          <label>Account activity<select defaultValue="Important only"><option>Important only</option><option>All activity</option><option>Off</option></select></label>
          <label>Revenue digest<select defaultValue="Every Monday"><option>Every Monday</option><option>Every Friday</option><option>Off</option></select></label>
          <label>Approval reminders<select defaultValue="After 4 hours"><option>After 1 hour</option><option>After 4 hours</option><option>Next business day</option></select></label>
        </>}
        {section === "API access" && <>
          <label>Integration label<input defaultValue="Rillwork production" /></label>
          <label>Environment<select defaultValue="Production"><option>Production</option><option>Staging</option><option>Development</option></select></label>
          <label>Access profile<input defaultValue="Customers, orders, invoices, analytics" disabled /></label>
        </>}
        {section === "Security" && <>
          <label>Administrator sign-in<select defaultValue="Require SSO"><option>Require SSO</option><option>Password and MFA</option><option>Password only</option></select></label>
          <label>Identity provider<input defaultValue="Okta — rillwork.co" /></label>
          <label>Idle session timeout<select defaultValue="8 hours"><option>2 hours</option><option>8 hours</option><option>24 hours</option></select></label>
        </>}
        <div className="form-footer"><button className="button-primary" onClick={() => onNotify(`${section} settings saved.`)}>Save changes</button></div>
      </section>
    </div>
  </>
}

function NotificationsView({ unread, onUnreadChange, onNotify }: { unread: Set<string>; onUnreadChange: (unread: Set<string>) => void; onNotify: (message: string) => void }) {
  const markRead = (id: string, title: string) => {
    const next = new Set(unread)
    next.delete(id)
    onUnreadChange(next)
    onNotify(`${title} marked as read.`)
  }
  return <>
    <PageHeader title="Notifications" description={`Account, billing, and system activity from ${RILLWORK_BRAND.name}.`} action={<button className="button-secondary" onClick={() => { onUnreadChange(new Set()); onNotify("All notifications marked as read.") }}>Mark all as read</button>} />
    <section className="notification-list">
      {workspaceNotifications.map((item) => (
        <Notification
          key={item.id}
          icon={<WorkspaceNotificationIcon kind={item.kind} />}
          title={item.title}
          detail={item.detail}
          time={item.time}
          unread={unread.has(item.id)}
          onClick={unread.has(item.id) ? () => markRead(item.id, item.title) : undefined}
        />
      ))}
    </section>
  </>
}

function Notification({ icon, title, detail, time, unread = false, onClick }: { icon: React.ReactNode; title: string; detail: string; time: string; unread?: boolean; onClick?: () => void }) {
  const content = <><span className="notification-icon">{icon}</span><span><strong>{title}</strong><p>{detail}</p><small>{time}</small></span>{unread && <StatusPip />}</>
  return onClick
    ? <button className={`notification-item ${unread ? "is-unread" : ""}`} onClick={onClick}>{content}</button>
    : <div className={`notification-item ${unread ? "is-unread" : ""}`}>{content}</div>
}

function NotificationsOverlay({
  unread,
  onUnreadChange,
  onNotify,
  onClose,
}: {
  unread: Set<string>
  onUnreadChange: (unread: Set<string>) => void
  onNotify: (message: string) => void
  onClose: () => void
}) {
  const markRead = (id: string, title: string) => {
    const next = new Set(unread)
    next.delete(id)
    onUnreadChange(next)
    onNotify(`${title} marked as read.`)
  }

  return (
    <>
      <div className="notifications-backdrop" onClick={onClose} />
      <div className="notifications-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="notifications-overlay__header">
          <h3>
            Notifications
            {unread.size > 0 && <span className="notifications-count-badge">{unread.size} new</span>}
          </h3>
          {unread.size > 0 && (
            <button
              className="notifications-mark-all"
              onClick={() => {
                onUnreadChange(new Set())
                onNotify("All notifications marked as read.")
              }}
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="notifications-overlay__list">
          {workspaceNotifications.map((item) => (
            <Notification
              key={item.id}
              icon={<WorkspaceNotificationIcon kind={item.kind} />}
              title={item.title}
              detail={item.detail}
              time={item.time}
              unread={unread.has(item.id)}
              onClick={unread.has(item.id) ? () => markRead(item.id, item.title) : undefined}
            />
          ))}
        </div>
      </div>
    </>
  )
}

function ProfileView({ profile, onChange, onNotify }: { profile: RillworkProfile; onChange: (profile: RillworkProfile) => void; onNotify: (message: string) => void }) {
  return <>
    <PageHeader title="Profile" description="Personal details used for approvals and workspace activity." />
    <section className="profile-card"><div className="profile-top"><span className="profile-avatar">{profile.fullName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><div><h2>{profile.fullName}</h2><p>{profile.email}</p></div><span className="profile-role">Operations lead</span></div><div className="profile-form"><label>Full name<input value={profile.fullName} onChange={(event) => onChange({ ...profile, fullName: event.target.value })} /></label><label>Email address<input value={profile.email} onChange={(event) => onChange({ ...profile, email: event.target.value })} /></label><label>Role<input defaultValue="Operations lead" disabled /></label><label>Time zone<select value={profile.timezone} onChange={(event) => onChange({ ...profile, timezone: event.target.value as RillworkProfile["timezone"] })}><option value="UTC">UTC — Coordinated Universal Time</option><option value="EST">EST — Eastern Standard Time</option></select></label></div><div className="form-footer"><button className="button-primary" onClick={() => onNotify("Profile saved.")}>Save profile</button></div></section>
  </>
}

function ConsoleView({ onAction, onAgentCommand, onCopy, copied }: { onAction: ManualActionHandler; onAgentCommand: (command: string) => void; onCopy: () => void; copied: boolean }) {
  const [consoleCommand, setConsoleCommand] = useState("Export this report")
  const action = resolveVoiceCommand(consoleCommand)
  return <>
    <PageHeader title="Lexicon console" description={`The capability model powering voice and typed actions in ${RILLWORK_BRAND.name}.`} />
    <div className="console-stat-row"><div><span>Mapped routes</span><strong>9</strong><small><Check size={13} /> All healthy</small></div><div><span>Mapped actions</span><strong>{mappedActions.length}</strong><small><Check size={13} /> Fully typed</small></div><div><span>Voice sessions</span><strong>186</strong><small><ArrowUpRight size={13} /> 18% this week</small></div><div><span>Execution success</span><strong>99.4%</strong><small><Check size={13} /> Last 30 days</small></div></div>
    <div className="console-layout">
      <section className="mapping-panel">
        <div className="panel-heading">
          <div><span>Capability map</span><strong>Rillwork capability set</strong></div>
          <small className="mapping-count">{mappedActions.length} actions</small>
        </div>
        <div className="mapping-table">
          {mappedActions.map((item) => (
            <button key={item.id} onClick={() => onAction(item, item.examples[0])}>
              <span className="mapping-icon">
                {item.operation === "navigate" ? <PanelRightOpen size={15} /> : item.operation === "export" ? <Download size={15} /> : <Zap size={15} />}
              </span>
              <span><strong>{item.label}</strong><small>{toolNameForCapability(item.id)}</small></span>
              {item.needsConfirmation && <LockKeyhole size={14} />}
              <ChevronRight size={16} />
            </button>
          ))}
        </div>
      </section>
      <section className="tester-panel">
        <div className="panel-heading">
          <div><span>Command tester</span><strong>Resolve a request before running it</strong></div>
          <span className="live-model"><StatusPip /> Ready</span>
        </div>
        <div className="command-tester">
          <label className="tester-input">
            <MessageCircle size={16} />
            <input
              aria-label="Command to test"
              value={consoleCommand}
              onChange={(event) => setConsoleCommand(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onAgentCommand(consoleCommand)
              }}
            />
            <button type="button" onClick={() => onAgentCommand(consoleCommand)} aria-label="Run command">
              Run <Play size={13} />
            </button>
          </label>
          <div className="tester-result">
            <div className="tester-result__status">
              <span><CheckCircle2 size={13} /> Capability matched</span>
              <small>{action.needsConfirmation ? "Confirmation required" : "Runs immediately"}</small>
            </div>
            <strong>{action.label}</strong>
            <p>{action.description}</p>
            <dl className="tester-result__details">
              <div><dt>Tool</dt><dd><code>{toolNameForCapability(action.id)}</code></dd></div>
              <div><dt>Route</dt><dd>{action.route}</dd></div>
              <div><dt>Policy</dt><dd>{action.needsConfirmation ? "Guarded" : "Direct"}</dd></div>
            </dl>
          </div>
        </div>
        <div className="session-log">
          <div><span>Recent executions</span><small>Latest first</small></div>
          <p><StatusPip /> <span>show_orders_last_week</span><strong>Completed</strong><em>424ms</em></p>
          <p><StatusPip /> <span>open_settings</span><strong>Completed</strong><em>188ms</em></p>
          <p><StatusPip /> <span>find_customers</span><strong>Completed</strong><em>236ms</em></p>
          <p><StatusPip /> <span>read_approval_request</span><strong>Completed</strong><em>301ms</em></p>
        </div>
      </section>
    </div>
    <div className="console-coverage"><section><div className="panel-heading"><div><span>Mapped surfaces</span><strong>What Lexicon can see</strong></div><span className="live-model"><StatusPip /> 52 healthy</span></div><div className="surface-map">{[["Overview", "Navigation · actions · approval queue", "11 nodes"], ["Customers", "Search · plan filter · account actions", "10 nodes"], ["Orders", "Status tabs · order table · export", "8 nodes"], ["Invoices", "Ledger · create form · invoice actions", "8 nodes"], ["Analytics", "Range controls · chart · report export", "9 nodes"], ["Settings", "Five sections · forms · save actions", "6 nodes"]].map(([surface, detail, count]) => <div key={surface}><span className="surface-page"><LayoutDashboard size={14} />{surface}</span><span>{detail}</span><strong>{count}</strong></div>)}</div></section><section className="workflow-map"><div className="panel-heading"><div><span>Workflow preview</span><strong>Export analytics report</strong></div><span className="live-model"><ShieldCheck size={13} /> Confirmation required</span></div><div className="workflow-path"><span>Analytics</span><ChevronRight size={14} /><span>Export report</span><ChevronRight size={14} /><span className="is-confirmation">Confirm</span><ChevronRight size={14} /><span>CSV download</span></div><p><CheckCircle2 size={14} /> All selectors were found in the latest scan. No failures to debug.</p></section></div>
    <section className="integration-panel"><div><span className="eyeline"><Code2 size={13} /> Installation</span><h3>Register product capabilities.</h3><p>The SDK turns typed handlers, fields, reads, and confirmation policies into Gemini tools.</p></div><pre><code>{'createLexiconRuntime({\n  app: "rillwork",\n  capabilities,\n})'}</code></pre><button className="copy-button" onClick={onCopy}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Copied" : "Copy"}</button></section>
  </>
}
