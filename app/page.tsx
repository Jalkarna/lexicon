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
  LayoutDashboard,
  LineChart,
  ListFilter,
  LockKeyhole,
  Mic,
  MoreHorizontal,
  Package,
  PanelRightOpen,
  Play,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  Volume2,
  X,
  Zap,
} from "lucide-react"
import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai"
import { Dithering } from "@paper-design/shaders-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { motion } from "motion/react"

import { AnimatedNumber } from "@/components/ui/animated-number"
import { AgentAudioVisualizerBar } from "@/components/agents-ui/agent-audio-visualizer-bar"
import { CanvasRevealEffect } from "@/components/ui/canvas-reveal-effect"
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
} from "@/lib/lexicon"
import { GeminiPcmPlayer, MicrophonePcmStream } from "@/lib/live-audio"

type Experience = "marketing" | "workspace" | "auth"

type HistoryItem = {
  id: number
  text: string
  action: string
  status: "completed" | "awaiting"
  time: string
}

type CreateFlow = "customer" | "invoice"

type Toast = {
  id: number
  message: string
}

type AgentPhase = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error"
type ActionSource = "manual" | "voice" | "live"

const terminalTabs: TabContent[] = [
  {
    label: "install",
    command: "npm install @lexicon/voice",
    lines: [
      { text: "added 1 package in 1.42s", color: "text-[#d5ff5f]", delay: 240 },
      { text: "lexicon runtime ready", color: "text-neutral-400", delay: 180 },
    ],
  },
  {
    label: "map",
    command: "npx lexicon scan",
    lines: [
      { text: "found 8 routes", color: "text-[#d5ff5f]", delay: 180 },
      { text: "mapped 37 interactive elements", color: "text-neutral-400", delay: 180 },
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

const customerRows = [
  { name: "Stacked Studio", owner: "Mae C.", plan: "Growth", spend: "$16,240", last: "2h ago", initials: "SS" },
  { name: "Quarry Labs", owner: "Levi S.", plan: "Scale", spend: "$12,890", last: "4h ago", initials: "QL" },
  { name: "Morrow & Co.", owner: "Nadia R.", plan: "Growth", spend: "$9,440", last: "Yesterday", initials: "MC" },
  { name: "Tall Pine", owner: "Kris B.", plan: "Starter", spend: "$2,180", last: "Yesterday", initials: "TP" },
]

const orderRows = [
  { id: "ORD-2084", customer: "Stacked Studio", product: "Growth annual", amount: "$4,800", status: "Paid", date: "Jul 13" },
  { id: "ORD-2083", customer: "Bright Assembly", product: "Scale monthly", amount: "$980", status: "Paid", date: "Jul 13" },
  { id: "ORD-2082", customer: "Quarry Labs", product: "Growth annual", amount: "$3,200", status: "Open", date: "Jul 12" },
  { id: "ORD-2081", customer: "Morrow & Co.", product: "Growth monthly", amount: "$640", status: "Paid", date: "Jul 12" },
]

const invoiceRows = [
  { id: "INV-0992", customer: "Bright Assembly", amount: "$980.00", due: "Due today", status: "Sent" },
  { id: "INV-0991", customer: "Quarry Labs", amount: "$3,200.00", due: "Jul 22", status: "Draft" },
  { id: "INV-0990", customer: "Morrow & Co.", amount: "$640.00", due: "Jul 08", status: "Paid" },
  { id: "INV-0989", customer: "Stacked Studio", amount: "$4,800.00", due: "Jul 04", status: "Paid" },
]

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

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" aria-label="Lexicon">
      <span className="brand-mark"><span /></span>
      {!compact && <span>lexicon</span>}
    </div>
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
  return <motion.div className={className} initial={{ opacity: 0, clipPath: "inset(0 0 18% 0)" }} animate={{ opacity: 1, clipPath: "inset(0 0 0% 0)" }} transition={{ duration: 0.64, delay, ease: [0.22, 1, 0.36, 1] }}>{children}</motion.div>
}

function LiveLatency() {
  const [milliseconds, setMilliseconds] = useState(0)
  useEffect(() => {
    const timer = window.setTimeout(() => setMilliseconds(400), 520)
    return () => window.clearTimeout(timer)
  }, [])
  return <AnimatedNumber value={milliseconds} format={(value) => `${(value / 1000).toFixed(1)}s`} />
}

function ProductModelSurface({
  onRun,
  onConsole,
}: {
  onRun: (action: MappedAction, text: string) => void
  onConsole: () => void
}) {
  const choices = mappedActions.filter((action) => ["show-orders-last-week", "open-analytics", "export-report"].includes(action.id))
  const [selectedId, setSelectedId] = useState(choices[0]?.id ?? "show-orders-last-week")
  const selected = actionById(selectedId) ?? choices[0]!

  return (
    <div className="model-surface" aria-label="Northstar product model">
      <CanvasRevealEffect
        animationSpeed={0.24}
        colors={[[213, 255, 95], [142, 154, 106]]}
        dotSize={2}
        showGradient={false}
        containerClassName="model-surface__canvas !pointer-events-none !bg-[#11120f]"
      />
      <div className="model-surface__content">
        <div className="model-surface__bar">
          <span><StatusPip /> Northstar action registry</span>
          <button onClick={onConsole}>View full model <ChevronRight size={14} /></button>
        </div>

        <div className="model-surface__input">
          <span>incoming request</span>
          <div><VoiceOrb listening /><strong>“{selected.examples[0]}.”</strong></div>
          <code>intent → {selected.id}</code>
        </div>

        <div className="model-surface__resolution">
          <div className="model-surface__tool">
            <span>selected tool</span>
            <strong>select_mapped_action</strong>
            <code>{selected.id}</code>
          </div>
          <div className="model-surface__facts">
            <span><small>route</small><code>{selected.route}</code></span>
            <span><small>selector</small><code>{selected.selector}</code></span>
            <span><small>authority</small><strong>{selected.needsConfirmation ? "operator review" : "ready to execute"}</strong></span>
          </div>
        </div>

        <div className="model-surface__footer">
          <div className="model-surface__choices" aria-label="Choose a mapped action">
            {choices.map((action) => (
              <button key={action.id} className={action.id === selected.id ? "is-selected" : ""} onClick={() => setSelectedId(action.id)}>
                <StatusPip tone={action.needsConfirmation ? "amber" : "lime"} />
                <span>{action.label}</span>
              </button>
            ))}
          </div>
          <button className="model-surface__run" onClick={() => onRun(selected, selected.examples[0])}>{selected.needsConfirmation ? "Review in demo" : "Run in demo"} <ArrowUpRight size={14} /></button>
        </div>
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
          <span className="product-xray__kicker">The sentence is the interface</span>
          <h2>Look beneath<br />what was said.</h2>
        </div>
        <div>
          <p>The language your user speaks is only the surface. Underneath, Lexicon resolves one named route, one target, and one permissioned action.</p>
          <button onClick={onConsole}>Inspect the action map <ChevronRight size={15} /></button>
        </div>
      </div>
      <MaskContainer
        className="product-xray__field"
        size={38}
        revealSize={356}
        revealText={
          <div className="product-xray__voice-layer">
            <div className="product-xray__field-label"><span><Mic size={13} /> spoken request</span><span>move across the sentence</span></div>
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
          <div className="product-xray__field-label"><span><Zap size={13} /> registered product action</span><span>resolved in 168 ms</span></div>
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
  )
}

function CreateFlowDialog({ kind, onClose, onSubmit }: { kind: CreateFlow; onClose: () => void; onSubmit: (message: string) => void }) {
  const isCustomer = kind === "customer"
  return (
    <div className="app-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="app-dialog" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); onSubmit(isCustomer ? "Customer created and ready to invite." : "Invoice draft created and ready to send.") }}>
        <div className="app-dialog__header"><div><h2>{isCustomer ? "Create customer" : "Create invoice"}</h2><p>{isCustomer ? "Start a new account in Northstar." : "Create a draft from a customer account."}</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={18} /></button></div>
        {isCustomer ? <><label>Company name<input required placeholder="Example: Meridian Studio" autoFocus /></label><label>Primary contact<input required type="email" placeholder="owner@meridian.studio" /></label><label>Plan<select defaultValue="Growth"><option>Starter</option><option>Growth</option><option>Scale</option></select></label></> : <><label>Customer<select defaultValue="Bright Assembly"><option>Bright Assembly</option><option>Quarry Labs</option><option>Stacked Studio</option></select></label><label>Invoice amount<input required inputMode="decimal" defaultValue="980.00" /></label><label>Due date<input required type="date" defaultValue="2026-07-21" /></label></>}
        <div className="app-dialog__footer"><button type="button" className="button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="button-primary">{isCustomer ? "Create customer" : "Create draft"}</button></div>
      </form>
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
  return <div className="app-dialog-backdrop search-backdrop" role="presentation" onMouseDown={onClose}><section className="search-dialog" onMouseDown={(event) => event.stopPropagation()}><div className="search-dialog__input"><Search size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Northstar" /><kbd>Esc</kbd></div><div className="search-dialog__results">{results.map((entry) => <button key={entry.route} onClick={() => onSelect(entry.route)}><span><strong>{entry.label}</strong><small>{entry.detail}</small></span><ChevronRight size={16} /></button>)}{results.length === 0 && <p>No matching workspace surface.</p>}</div></section></div>
}

function AuthScreen({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const isSignup = mode === "signup"

  return (
    <main className="auth-shell">
      <section className="auth-intro">
        <button className="auth-logo" onClick={onBack}><Logo /></button>
        <div>
          <h1>The product knows<br />what to do next.</h1>
          <p>Map the actions people need. Let Lexicon carry out the conversation.</p>
        </div>
        <div className="auth-quote"><VoiceOrb /><p>“Show orders from last week.”<span>Orders filtered in 0.4 seconds</span></p></div>
      </section>
      <section className="auth-form-area">
        <button className="auth-back" onClick={onBack}>← Back to Lexicon</button>
        <div className="auth-form-wrap">
          <div className="auth-heading"><h2>{isSignup ? "Create your workspace" : "Welcome back"}</h2><p>{isSignup ? "Start mapping voice actions for your product." : "Sign in to your Lexicon workspace."}</p></div>
          <button className="sso-button" onClick={onContinue}><span className="google-mark">G</span> Continue with Google</button>
          <div className="auth-divider"><span>or continue with email</span></div>
          {isSignup && <label>Full name<input placeholder="Ava Morgan" /></label>}
          <label>Work email<input type="email" placeholder="you@company.com" /></label>
          <label>Password<input type="password" placeholder="••••••••••" /></label>
          <button className="auth-submit" onClick={onContinue}>{isSignup ? "Create workspace" : "Sign in"}<ArrowUpRight size={16} /></button>
          <p className="auth-switch">{isSignup ? "Already have a workspace?" : "New to Lexicon?"} <button onClick={() => setMode(isSignup ? "signin" : "signup")}>{isSignup ? "Sign in" : "Create an account"}</button></p>
        </div>
      </section>
    </main>
  )
}

export default function Page() {
  const [experience, setExperience] = useState<Experience>("marketing")
  const [route, setRoute] = useState<AppRoute>("overview")
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [listening, setListening] = useState(false)
  const [pendingAction, setPendingAction] = useState<MappedAction | null>(null)
  const [lastAction, setLastAction] = useState<MappedAction | null>(null)
  const [command, setCommand] = useState("")
  const [filterActive, setFilterActive] = useState(false)
  const [copied, setCopied] = useState(false)
  const [agentNotice, setAgentNotice] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [createFlow, setCreateFlow] = useState<CreateFlow | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [agentPhase, setAgentPhase] = useState<AgentPhase>("idle")
  const [pendingCommand, setPendingCommand] = useState("")
  const [pendingSource, setPendingSource] = useState<ActionSource>("voice")
  const [inputLevel, setInputLevel] = useState(0)
  const liveSession = useRef<Session | null>(null)
  const liveMicrophone = useRef<MicrophonePcmStream | null>(null)
  const livePlayer = useRef<GeminiPcmPlayer | null>(null)
  const liveClosing = useRef(false)
  const liveTranscript = useRef("")
  const voiceInput = useRef<HTMLInputElement | null>(null)
  const toastTimer = useRef<number | null>(null)
  const toastId = useRef(0)
  const [history, setHistory] = useState<HistoryItem[]>([
    { id: 1, text: "Take me to analytics", action: "View analytics", status: "completed", time: "Just now" },
    { id: 2, text: "Show orders from last week", action: "Filter orders", status: "completed", time: "09:42" },
    { id: 3, text: "Create an invoice", action: "Create invoice", status: "completed", time: "Yesterday" },
  ])

  const activeLabel = useMemo(() => pageLabels[route], [route])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)
      if (experience !== "workspace" || event.code !== "Space" || event.repeat || isTyping || event.metaKey || event.ctrlKey || event.altKey) return
      event.preventDefault()
      setVoiceOpen(true)
      window.setTimeout(() => voiceInput.current?.focus(), 0)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [experience])

  useEffect(() => () => {
    liveClosing.current = true
    try { liveSession.current?.close() } catch {}
    void liveMicrophone.current?.stop()
    void livePlayer.current?.close()
  }, [])

  function openWorkspace(target: AppRoute = "overview") {
    setExperience("workspace")
    setRoute(target)
  }

  function notify(message: string) {
    setToast({ id: ++toastId.current, message })
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2800)
  }

  function record(action: MappedAction, text: string, status: HistoryItem["status"] = "completed") {
    setHistory((current) => [
      { id: Date.now(), text, action: action.label, status, time: "Now" },
      ...current,
    ].slice(0, 5))
  }

  function speakResponse(text: string) {
    if (!("speechSynthesis" in window)) {
      setAgentPhase("idle")
      return
    }
    window.speechSynthesis.cancel()
    const response = new SpeechSynthesisUtterance(text)
    response.rate = 1.06
    response.pitch = 0.96
    response.onstart = () => setAgentPhase("speaking")
    response.onend = () => setAgentPhase("idle")
    response.onerror = () => setAgentPhase("idle")
    window.speechSynthesis.speak(response)
  }

  function execute(action: MappedAction, text = action.examples[0], source: ActionSource = "manual") {
    setRoute(action.route)
    setLastAction(action)
    setPendingAction(null)
    setPendingCommand("")
    setPendingSource("voice")
    if (action.id === "show-orders-last-week") setFilterActive(true)
    if (action.id === "create-customer") setCreateFlow("customer")
    if (action.id === "create-invoice") setCreateFlow("invoice")
    if (action.id === "export-report") notify("Analytics CSV is ready to download.")
    if (action.id === "approve-request") notify("Quarry Labs plan change was approved.")
    record(action, text)
    if (source === "voice") speakResponse(`${action.label} is ready.`)
  }

  function runVoiceAction(action: MappedAction, text: string, source: Exclude<ActionSource, "manual"> = "voice") {
    setLastAction(action)
    if (action.needsConfirmation) {
      setPendingAction(action)
      setPendingCommand(text)
      setPendingSource(source)
      setVoiceOpen(true)
      record(action, text, "awaiting")
      if (source === "voice") {
        setAgentPhase("speaking")
        speakResponse(`${action.label} needs your confirmation before I continue.`)
      } else {
        setAgentPhase("listening")
        setAgentNotice(`${action.label} is ready for your confirmation.`)
      }
      return
    }
    execute(action, text, source)
  }

  function runManualAction(action: MappedAction, text: string) {
    execute(action, text, "manual")
  }

  function appendTranscript(current: string, next: string) {
    if (!next) return current
    if (!current || next.startsWith(current)) return next
    if (current.endsWith(next)) return current
    return `${current}${/\s$/.test(current) || /^\s|^[,.;:!?]/.test(next) ? "" : " "}${next}`
  }

  async function stopLiveVoice() {
    liveClosing.current = true
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
    liveTranscript.current = ""
    setInputLevel(0)
    setListening(false)
    setAgentPhase("idle")
    setAgentNotice("Live voice session ended. Start it again whenever you are ready.")
  }

  async function resolveLiveToolCalls(session: Session, message: LiveServerMessage) {
    const calls = message.toolCall?.functionCalls ?? []
    if (!calls.length) return
    setAgentPhase("thinking")
    const functionResponses = calls.map((call) => {
      const actionId = call.args?.actionId
      const action = typeof actionId === "string" ? actionById(actionId) : undefined
      if (!action) {
        return { id: call.id, name: call.name, response: { error: "That action is not registered in this product." } }
      }
      const text = liveTranscript.current.trim() || action.examples[0]
      runVoiceAction(action, text, "live")
      return {
        id: call.id,
        name: call.name,
        response: {
          result: action.needsConfirmation
            ? `${action.label} is awaiting the user's confirmation in the product UI.`
            : `${action.label} ran through the developer-defined action map.`,
        },
      }
    })
    if (liveSession.current === session) session.sendToolResponse({ functionResponses })
  }

  async function startLiveVoice() {
    if (liveSession.current || agentPhase === "connecting") return
    liveClosing.current = false
    liveTranscript.current = ""
    setAgentPhase("connecting")
    setAgentNotice("Starting a secure Live voice session…")

    const player = new GeminiPcmPlayer(24000)
    livePlayer.current = player
    try {
      await player.prepare()
      const response = await fetch("/api/live/session", { method: "POST" })
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
              setAgentPhase("listening")
            }
            const incoming = content?.inputTranscription?.text ?? content?.interimInputTranscription?.text
            if (incoming) {
              liveTranscript.current = appendTranscript(liveTranscript.current, incoming)
              setCommand(liveTranscript.current)
            }
            const output = content?.outputTranscription?.text
            if (output) setAgentNotice(output)
            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data && part.inlineData.mimeType?.startsWith("audio/")) {
                setAgentPhase("speaking")
                void livePlayer.current?.enqueue(part.inlineData.data)
              }
              if (part.text) setAgentNotice(part.text)
            }
            if (message.toolCall?.functionCalls?.length) void resolveLiveToolCalls(session, message)
            if (content?.turnComplete && !pendingAction) setAgentPhase("listening")
          },
          onerror: () => {
            liveSession.current = null
            setListening(false)
            setAgentPhase("error")
            setAgentNotice("The Live connection had an error. You can reconnect or type a command.")
          },
          onclose: () => {
            liveSession.current = null
            if (!liveClosing.current) {
              setListening(false)
              setAgentPhase("error")
              setAgentNotice("Live voice disconnected. Reconnect when you are ready.")
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
      setAgentNotice("Live. Speak naturally — Lexicon will show and run only mapped actions.")
    } catch (error) {
      try { liveSession.current?.close() } catch {}
      liveSession.current = null
      await liveMicrophone.current?.stop().catch(() => {})
      liveMicrophone.current = null
      await livePlayer.current?.close().catch(() => {})
      livePlayer.current = null
      setListening(false)
      setAgentPhase("error")
      setAgentNotice(error instanceof Error ? error.message : "Live voice could not start. Type a command instead.")
    }
  }

  function toggleListening() {
    if (liveSession.current || agentPhase === "connecting") void stopLiveVoice()
    else void startLiveVoice()
  }

  async function submitCommand(value: string) {
    const message = value.trim()
    if (!message) return
    setCommand("")
    if (liveSession.current) {
      liveTranscript.current = message
      liveSession.current.sendRealtimeInput({ text: message })
      setAgentPhase("thinking")
      setAgentNotice("Sending your command to the live action map…")
      return
    }
    const deterministicAction = resolveVoiceCommand(message)
    setLastAction(deterministicAction)
    setAgentPhase("thinking")
    setAgentNotice("Resolving your request against Northstar’s mapped actions…")

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: message }),
      })
      const result = (await response.json()) as {
        action?: MappedAction
        provider?: string
        note?: string
        diagnostic?: string
      }
      const selectedAction = result.action ?? deterministicAction
      setAgentNotice(result.diagnostic ?? result.note ?? "A mapped action is ready to run.")
      runVoiceAction(selectedAction, message)
    } catch {
      setAgentNotice("The voice provider is unavailable. Lexicon kept execution on the local action map.")
      runVoiceAction(deterministicAction, message)
    }
  }

  function copySnippet() {
    navigator.clipboard?.writeText("npm i @lexicon/voice\nlexicon.mount({ app: 'northstar' })")
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  if (experience === "workspace") {
    return (
      <main className="workspace-shell">
        <aside className="app-sidebar">
          <button className="sidebar-brand" onClick={() => setExperience("marketing")} aria-label="Back to Lexicon home">
            <Logo />
          </button>
          <button className="workspace-switcher" onClick={() => notify("Northstar workspace selected.")}>
            <span className="workspace-avatar">N</span>
            <span><strong>Northstar</strong><small>Commerce OS</small></span>
            <ChevronDown size={15} />
          </button>
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
                  onClick={() => setRoute(item.id)}
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                </button>
              )
            })}
            <p>Account</p>
            <button data-lexicon="settings-nav" className={route === "settings" ? "is-active" : ""} onClick={() => setRoute("settings")}><Settings size={17} /><span>Settings</span></button>
            <button className={route === "console" ? "is-active" : ""} onClick={() => setRoute("console")}><Code2 size={17} /><span>Lexicon console</span></button>
          </nav>
          <button className="sidebar-agent" onClick={() => setVoiceOpen(true)}>
            <VoiceOrb />
            <span><strong>Voice is ready</strong><small>Press space to talk</small></span>
            <ChevronRight size={16} />
          </button>
          <button className="account-row" onClick={() => setRoute("profile")}>
            <span className="avatar avatar--green">AM</span>
            <span><strong>Ava Morgan</strong><small>Admin</small></span>
            <MoreHorizontal size={17} />
          </button>
        </aside>

        <section className="app-stage">
          <header className="app-topbar">
            <div className="breadcrumb"><span>Northstar</span><ChevronRight size={14} /><strong>{activeLabel}</strong></div>
            <div className="topbar-actions">
              <button className="icon-button" onClick={() => setSearchOpen(true)} aria-label="Search"><Search size={18} /></button>
              <button className="icon-button notification-button" onClick={() => setRoute("notifications")} aria-label="Notifications"><Bell size={18} /><StatusPip tone="amber" /></button>
              <button className="topbar-voice" onClick={() => setVoiceOpen(true)}><Mic size={16} /> Ask Lexicon <kbd>Space</kbd></button>
            </div>
          </header>
          <section className="app-content">
            <View
              route={route}
              filterActive={filterActive}
              onNavigate={setRoute}
              onVoice={() => setVoiceOpen(true)}
              onAction={runManualAction}
              onCopy={copySnippet}
              copied={copied}
              onNotify={notify}
              onFilterChange={setFilterActive}
            />
          </section>
        </section>

        <button className="floating-voice" onClick={() => setVoiceOpen(true)} aria-label="Open Lexicon voice assistant">
          <VoiceOrb listening={listening} />
          <span>Talk to Lexicon</span>
        </button>

        {voiceOpen && (
          <aside className="voice-panel" aria-label="Lexicon voice agent">
            <div className="voice-panel__header">
              <div><Logo compact /><span>Northstar is mapped</span></div>
              <button className="icon-button" onClick={() => setVoiceOpen(false)} aria-label="Close assistant"><X size={18} /></button>
            </div>
            <div className="voice-conversation">
              <div className="agent-message"><VoiceOrb listening={agentPhase === "listening" || agentPhase === "speaking" || agentPhase === "connecting"} /><p>{agentPhase === "connecting" ? "Connecting you to Live voice…" : agentPhase === "thinking" ? "Checking Northstar’s action map…" : agentPhase === "speaking" ? "Lexicon is responding." : agentPhase === "error" ? "Live voice needs attention. You can reconnect or type a command." : "What would you like to do?"}</p></div>
              {agentPhase !== "idle" && <div className={`voice-activity voice-activity--${agentPhase}`}><span>{agentPhase === "connecting" ? "Connecting" : agentPhase === "listening" ? "Listening live" : agentPhase === "thinking" ? "Resolving intent" : agentPhase === "speaking" ? "Responding" : "Connection issue"}</span><i style={{ transform: `scaleY(${0.35 + inputLevel * 0.85})` }} /><i /><i /><i /><i /></div>}
              {lastAction && (
                <div className="execution-preview">
                  <span className="eyeline"><Zap size={13} /> Intent recognized</span>
                  <strong>{lastAction.label}</strong>
                  <p>{lastAction.description}</p>
                  <div className="execution-path"><span>Voice</span><ChevronRight size={14} /><span>Mapped action</span><ChevronRight size={14} /><span>{pageLabels[lastAction.route]}</span></div>
                </div>
              )}
              {pendingAction && (
                <div className="confirmation-box">
                  <LockKeyhole size={16} />
                  <div><strong>Confirm action</strong><p>{pendingAction.operation === "export" ? "This will prepare a CSV download." : "This action changes workspace data."}</p></div>
                  <div className="confirmation-actions">
                    <button onClick={() => { setPendingAction(null); setPendingCommand(""); setPendingSource("voice") }}>Cancel</button>
                    <button className="confirm" onClick={() => { execute(pendingAction, pendingCommand || pendingAction.examples[0], pendingSource); if (pendingSource === "live") liveSession.current?.sendRealtimeInput({ text: `The user confirmed ${pendingAction.label}.` }) }}>Confirm</button>
                  </div>
                </div>
              )}
              {agentNotice && (
                <div className="agent-notice"><ShieldCheck size={14} /><span>{agentNotice}</span></div>
              )}
            </div>
            <div className="voice-suggestions">
              <p>Try saying</p>
              {commandExamples.slice(0, 3).map((example) => <button key={example} onClick={() => submitCommand(example)}>{example}</button>)}
            </div>
            <div className="voice-history">
              <p>Recent actions</p>
              {history.slice(0, 2).map((item) => <div key={item.id}><span className={item.status === "completed" ? "history-check" : "history-wait"}>{item.status === "completed" ? <Check size={11} /> : <Clock3 size={11} />}</span><span><strong>{item.action}</strong><small>{item.time}</small></span></div>)}
            </div>
            <form className="voice-input" onSubmit={(event) => { event.preventDefault(); submitCommand(command) }}>
              <button type="button" className={listening ? "mic-trigger is-listening" : "mic-trigger"} onClick={toggleListening} aria-label={listening ? "End live voice session" : "Start live voice session"} title={listening ? "End live voice" : "Start live voice"}><Mic size={18} /></button>
              <input ref={voiceInput} value={command} onChange={(event) => setCommand(event.target.value)} placeholder={listening ? "Live transcript appears here" : "Type a command or start Live voice"} />
              <button type="submit" className="send-button" aria-label="Send command"><Send size={16} /></button>
            </form>
          </aside>
        )}
        {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} onSelect={(selectedRoute) => { setRoute(selectedRoute); setSearchOpen(false) }} />}
        {createFlow && <CreateFlowDialog kind={createFlow} onClose={() => setCreateFlow(null)} onSubmit={(message) => { setCreateFlow(null); notify(message) }} />}
        {toast && <div className="app-toast" role="status"><CheckCircle2 size={16} /><span>{toast.message}</span><button onClick={() => setToast(null)} aria-label="Dismiss notification"><X size={14} /></button></div>}
      </main>
    )
  }

  if (experience === "auth") {
    return <AuthScreen onBack={() => setExperience("marketing")} onContinue={() => openWorkspace()} />
  }

  return (
    <main className="marketing-shell">
      <header className="marketing-nav">
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><Logo /></button>
        <nav>
          <a href="#how-it-works">How it works</a>
          <a href="#platform">Platform</a>
          <a href="#developers">Developers</a>
        </nav>
        <div><button className="text-link" onClick={() => setExperience("auth")}>Sign in</button><button className="text-link" onClick={() => openWorkspace("console")}>Developer console</button><button className="nav-cta" onClick={() => openWorkspace()}>Open demo <ArrowUpRight size={15} /></button></div>
      </header>

      <HeroDitheringRoot className="marketing-hero" srTitle="">
        <TextureOverlay texture="noise" opacity={0.1} className="marketing-hero__texture" />
        <div className="hero-copy">
          <h1>Software that answers back.</h1>
          <p>Lexicon gives every product a reliable voice interface—built from the structure your team already knows, not guesses a browser agent has to make.</p>
          <div className="hero-actions"><button className="primary-cta" onClick={() => openWorkspace()}><Mic size={17} /> Try the live demo</button><a href="#developers">See the SDK <ArrowDownRight size={16} /></a></div>
        </div>
        <div className="hero-swirl-container" aria-label="Live action demonstration">
          <Dithering
            className="hero-spiral"
            colorBack="#11120f"
            colorFront="#d5ff5f"
            fit="contain"
            scale={0.72}
            shape="swirl"
            size={2}
            speed={0.56}
            type="4x4"
          />
          <div className="hero-voice-visualizer" aria-hidden>
            <AgentAudioVisualizerBar
              color="#d5ff5f"
              size="xl"
              state="speaking"
            />
          </div>
        </div>
      </HeroDitheringRoot>

      <section className="proof-strip"><span>Designed for teams building the next interface</span><div><strong>Northstar</strong><strong>stacks</strong><strong>HOLLOW</strong><strong>pearl</strong><strong>fable</strong></div></section>

      <section id="how-it-works" className="workflow-section">
        <ScrollReveal delay={0.04}>
          <MappedProductFlow onRun={(action, text) => { openWorkspace(action.route); runVoiceAction(action, text) }} onConsole={() => openWorkspace("console")} />
        </ScrollReveal>
      </section>

      <section id="platform" className="platform-section">
        <ScrollReveal className="platform-copy"><h2>Not another agent<br />that hopes for the best.</h2><p>Generic browser agents have to rediscover a product every time. Lexicon keeps the product model next to the product itself: routes, elements, workflows, and exactly what has authority to act.</p><button onClick={() => openWorkspace("console")}>Explore the action map <ChevronRight size={16} /></button></ScrollReveal>
        <ScrollReveal className="architecture-graphic" delay={0.08}>
          <ProductModelSurface onRun={(action, text) => { openWorkspace(action.route); runVoiceAction(action, text) }} onConsole={() => openWorkspace("console")} />
        </ScrollReveal>
      </section>

      <section id="developers" className="developer-section">
        <ScrollReveal className="developer-copy"><h2>One dependency.<br />One product model.</h2><p>Bring Lexicon to an existing app in minutes. Start with automatic scanning, then make important paths explicit in a dashboard your whole team can understand.</p><button className="primary-cta" onClick={() => openWorkspace("console")}>Open developer console <ArrowUpRight size={16} /></button></ScrollReveal>
        <ScrollReveal className="terminal-shell" delay={0.1}>
          <div className="terminal-chrome"><span /><span /><span><strong>lexicon</strong> — terminal</span></div>
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
            return <button key={example} onClick={() => { openWorkspace(action.route); runVoiceAction(action, example) }}><span><Mic size={15} /> {example}</span><span className="command-result">{action.label}<ChevronRight size={15} /></span></button>
          })}
        </ScrollReveal>
      </section>

      <section className="final-cta"><div><h2>Make your product<br />speak for itself.</h2></div><button className="primary-cta" onClick={() => openWorkspace()}><Mic size={17} /> Launch the demo</button></section>
      <footer className="marketing-footer"><Logo /><span>© 2026 Lexicon, Inc.</span><div><a href="#platform">Platform</a><a href="#developers">Developers</a><button onClick={() => openWorkspace("console")}>Console</button></div></footer>
    </main>
  )
}

function View({
  route,
  filterActive,
  onNavigate,
  onVoice,
  onAction,
  onCopy,
  copied,
  onNotify,
  onFilterChange,
}: {
  route: AppRoute
  filterActive: boolean
  onNavigate: (route: AppRoute) => void
  onVoice: () => void
  onAction: (action: MappedAction, text: string) => void
  onCopy: () => void
  copied: boolean
  onNotify: (message: string) => void
  onFilterChange: (active: boolean) => void
}) {
  if (route === "analytics") return <AnalyticsView onAction={onAction} onNotify={onNotify} />
  if (route === "customers") return <CustomersView onAction={onAction} onNotify={onNotify} />
  if (route === "orders") return <OrdersView filterActive={filterActive} onFilterChange={onFilterChange} onNotify={onNotify} />
  if (route === "invoices") return <InvoicesView onAction={onAction} onNotify={onNotify} />
  if (route === "settings") return <SettingsView onNotify={onNotify} />
  if (route === "notifications") return <NotificationsView onNotify={onNotify} />
  if (route === "profile") return <ProfileView onNotify={onNotify} />
  if (route === "console") return <ConsoleView onAction={onAction} onCopy={onCopy} copied={copied} onNotify={onNotify} />
  return <OverviewView onNavigate={onNavigate} onVoice={onVoice} onAction={onAction} onNotify={onNotify} />
}

function PageHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-header"><div><h1>{title}</h1><p>{description}</p></div>{action}</div>
}

function OverviewView({ onNavigate, onVoice, onAction, onNotify }: { onNavigate: (route: AppRoute) => void; onVoice: () => void; onAction: (action: MappedAction, text: string) => void; onNotify: (message: string) => void }) {
  return <>
    <PageHeader title="Good morning, Ava." description="Here’s what’s moving in Northstar today." action={<button className="button-secondary" onClick={() => onVoice()}><Mic size={16} /> Ask Lexicon</button>} />
    <div className="overview-grid">
      <section className="revenue-panel"><div className="panel-heading"><div><span>Revenue</span><strong>$84,620 <em><ArrowUpRight size={14} /> 12.4%</em></strong></div><button onClick={() => onNavigate("analytics")}>View analytics <ChevronRight size={15} /></button></div><RevenueChart /><div className="chart-axis"><span>Jul 1</span><span>Jul 8</span><span>Jul 14</span></div></section>
      <section className="quick-actions"><div className="panel-heading"><div><span>Quick actions</span><strong>Run with Lexicon</strong></div><Bot size={20} /></div><button data-lexicon="create-customer" onClick={() => onAction(actionById("create-customer")!, "Create a new customer")}><span className="action-icon"><Users size={18} /></span><span><strong>Create customer</strong><small>Start a mapped flow</small></span><ChevronRight size={17} /></button><button data-lexicon="create-invoice" onClick={() => onAction(actionById("create-invoice")!, "Create an invoice")}><span className="action-icon"><FileText size={18} /></span><span><strong>Create invoice</strong><small>Draft from an account</small></span><ChevronRight size={17} /></button></section>
      <section className="activity-panel"><div className="panel-heading"><div><span>Approval queue</span><strong>Requires your attention</strong></div><button className="text-button" onClick={() => onNotify("Approval queue opened with 1 pending request.")}>See all</button></div><div className="approval-item" data-lexicon="approval-request"><span className="avatar avatar--peach">JB</span><div><strong>James from Quarry Labs</strong><p>Requested a plan change to Scale.</p></div><button onClick={() => onAction(actionById("approve-request")!, "Approve the request")}>Review</button></div><div className="activity-list"><span><Clock3 size={15} /> Invoice INV-0992 was opened <small>12 min ago</small></span><span><CheckCircle2 size={15} /> Morrow & Co. paid $640.00 <small>34 min ago</small></span></div></section>
      <section className="signal-panel"><div><span className="eyeline"><Activity size={13} /> Signal</span><h3>Churn risk is down for the third consecutive week.</h3><button onClick={() => onNavigate("analytics")}>See the cohort <ChevronRight size={15} /></button></div><div className="signal-bars"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div></section>
    </div>
  </>
}

function RevenueChart() {
  const bars = [34, 41, 36, 50, 49, 57, 47, 61, 59, 76, 67, 72, 86, 91]
  return <div className="revenue-chart">{bars.map((height, index) => <span key={index} style={{ height: `${height}%` }} className={index > 10 ? "is-current" : ""} />)}<div className="chart-marker"><small>Today</small><strong>$9,480</strong></div></div>
}

function AnalyticsView({ onAction, onNotify }: { onAction: (action: MappedAction, text: string) => void; onNotify: (message: string) => void }) {
  const [period, setPeriod] = useState<"Last 30 days" | "Last 7 days">("Last 30 days")
  return <>
    <PageHeader title="Analytics" description="A clear view of the product and people behind the numbers." action={<div className="header-controls"><button className="button-secondary" onClick={() => { const next = period === "Last 30 days" ? "Last 7 days" : "Last 30 days"; setPeriod(next); onNotify(`Analytics range changed to ${next.toLowerCase()}.`) }}><Clock3 size={16} /> {period} <ChevronDown size={15} /></button><button data-lexicon="export-report" className="button-primary" onClick={() => onAction(actionById("export-report")!, "Export this report")}><Download size={16} /> Export</button></div>} />
    <div className="analytics-summary"><Metric label="Net revenue" value="$84,620" change="12.4%" /><Metric label="Active customers" value="1,428" change="8.7%" /><Metric label="Revenue per customer" value="$59.26" change="3.2%" /></div>
    <section className="analytics-chart-panel"><div className="panel-heading"><div><span>Monthly recurring revenue</span><strong>$84,620</strong></div><div className="chart-legend"><span><i /> This month</span><span><i /> Last month</span></div></div><LineGraph /></section>
    <div className="analytics-lower"><section className="source-list"><div className="panel-heading"><div><span>Acquisition</span><strong>Where new customers start</strong></div></div>{[["Organic search", "42%", "#d5ff5f"], ["Referrals", "28%", "#a7b583"], ["Paid", "19%", "#7e8c68"], ["Other", "11%", "#536049"]].map(([label, amount, color]) => <div className="source-row" key={label}><span>{label}</span><div><i style={{ width: amount, backgroundColor: color }} /></div><strong>{amount}</strong></div>)}</section><section className="insight-card"><span className="eyeline"><Sparkles size={13} /> Lexicon insight</span><h3>Teams who use voice commands return 18% faster.</h3><p>Comparing sessions with at least one mapped action against baseline product sessions.</p><button onClick={() => onNotify("Session replay is queued from the last analytics interaction.")}>View session replay <ChevronRight size={15} /></button></section></div>
  </>
}

function Metric({ label, value, change }: { label: string; value: string; change: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong><small><ArrowUpRight size={13} /> {change} vs. last month</small></div>
}

function LineGraph() {
  return <div className="line-graph"><div className="graph-grid"><i /><i /><i /><i /></div><svg viewBox="0 0 760 240" preserveAspectRatio="none" aria-label="Monthly recurring revenue chart"><path d="M0,186 C38,175 58,192 95,162 S148,148 180,155 S232,123 273,139 S330,111 372,126 S424,96 457,110 S510,74 554,94 S610,72 646,66 S700,34 760,42" fill="none" stroke="#d5ff5f" strokeWidth="3" vectorEffect="non-scaling-stroke" /><path d="M0,212 C47,199 81,212 118,193 S178,174 214,184 S266,165 303,168 S352,142 394,157 S454,132 486,145 S542,122 580,134 S636,102 674,116 S722,85 760,95" fill="none" stroke="#66705d" strokeWidth="2" strokeDasharray="6 6" vectorEffect="non-scaling-stroke" /></svg><div className="graph-labels"><span>Jul 1</span><span>Jul 8</span><span>Jul 15</span><span>Jul 22</span><span>Jul 30</span></div></div>
}

function CustomersView({ onAction, onNotify }: { onAction: (action: MappedAction, text: string) => void; onNotify: (message: string) => void }) {
  const [query, setQuery] = useState("")
  const [growthOnly, setGrowthOnly] = useState(false)
  const [page, setPage] = useState(1)
  const visibleCustomers = customerRows.filter((customer) => {
    const matchesQuery = `${customer.name} ${customer.owner} ${customer.plan}`.toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (!growthOnly || customer.plan === "Growth")
  })
  return <>
    <PageHeader title="Customers" description="1,428 active accounts across all plans." action={<button data-lexicon="create-customer" className="button-primary" onClick={() => onAction(actionById("create-customer")!, "Create a new customer")}><Plus size={16} /> New customer</button>} />
    <div className="table-toolbar"><div className="table-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customers" /></div><button className={growthOnly ? "button-secondary is-active-control" : "button-secondary"} onClick={() => { setGrowthOnly((active) => !active); onNotify(growthOnly ? "Customer plan filter cleared." : "Showing Growth customers only.") }}><ListFilter size={16} /> Filters</button><button className="button-secondary" onClick={() => onNotify("Customer table columns are configured for this workspace.")}><SlidersHorizontal size={16} /> Columns</button></div>
    <section className="data-table"><table><thead><tr><th><input type="checkbox" aria-label="Select all customers" /></th><th>Customer</th><th>Plan</th><th>Lifetime spend</th><th>Last activity</th><th /></tr></thead><tbody>{visibleCustomers.map((customer) => <tr key={customer.name}><td><input type="checkbox" aria-label={`Select ${customer.name}`} /></td><td><div className="customer-cell"><span className="avatar avatar--stone">{customer.initials}</span><div><strong>{customer.name}</strong><small>{customer.owner}</small></div></div></td><td><span className="plan-label">{customer.plan}</span></td><td>{customer.spend}</td><td>{customer.last}</td><td><button className="row-menu" onClick={() => onNotify(`${customer.name} actions are ready.`)} aria-label={`Open actions for ${customer.name}`}><MoreHorizontal size={17} /></button></td></tr>)}{visibleCustomers.length === 0 && <tr><td colSpan={6} className="empty-table">No customers match this view.</td></tr>}</tbody></table><div className="table-footer"><span>Page {page} · {visibleCustomers.length} matching customers</span><div><button onClick={() => { setPage((current) => Math.max(1, current - 1)); onNotify("Showing previous customer page.") }}>Previous</button><button onClick={() => { setPage((current) => current + 1); onNotify("Showing next customer page.") }}>Next</button></div></div></section>
  </>
}

function OrdersView({ filterActive, onFilterChange, onNotify }: { filterActive: boolean; onFilterChange: (active: boolean) => void; onNotify: (message: string) => void }) {
  const [status, setStatus] = useState<"All orders" | "Open" | "Paid">("All orders")
  const visibleOrders = orderRows.filter((order) => status === "All orders" || order.status === status)
  return <>
    <PageHeader title="Orders" description={filterActive ? "Showing orders placed in the last seven days." : "Track incoming payments and orders in one place."} action={<button className="button-secondary" onClick={() => onNotify("Orders CSV download is ready.")}><Download size={16} /> Export</button>} />
    <div className="table-toolbar"><div className="segmented-control">{(["All orders", "Open", "Paid"] as const).map((tab) => <button key={tab} className={status === tab ? "is-selected" : ""} onClick={() => { setStatus(tab); onNotify(`Showing ${tab.toLowerCase()}.`) }}>{tab}</button>)}</div>{filterActive && <button className="filter-chip" onClick={() => { onFilterChange(false); onNotify("Last 7 days filter removed.") }}><Clock3 size={14} /> Last 7 days <X size={13} /></button>}</div>
    <section className="data-table" data-lexicon="orders-table"><table><thead><tr><th>Order</th><th>Customer</th><th>Product</th><th>Amount</th><th>Status</th><th>Date</th><th /></tr></thead><tbody>{visibleOrders.map((order) => <tr key={order.id}><td><strong>{order.id}</strong></td><td>{order.customer}</td><td>{order.product}</td><td>{order.amount}</td><td><span className={`status-label ${order.status === "Paid" ? "status-label--paid" : "status-label--open"}`}><StatusPip tone={order.status === "Paid" ? "lime" : "amber"} />{order.status}</span></td><td>{order.date}</td><td><button className="row-menu" onClick={() => onNotify(`${order.id} details opened.`)} aria-label={`Open actions for ${order.id}`}><MoreHorizontal size={17} /></button></td></tr>)}</tbody></table><div className="table-footer"><span>{visibleOrders.length} orders in the current view</span><span>Updated just now</span></div></section>
  </>
}

function InvoicesView({ onAction, onNotify }: { onAction: (action: MappedAction, text: string) => void; onNotify: (message: string) => void }) {
  return <>
    <PageHeader title="Invoices" description="Create, send, and keep track of every invoice." action={<button data-lexicon="create-invoice" className="button-primary" onClick={() => onAction(actionById("create-invoice")!, "Create an invoice")}><Plus size={16} /> Create invoice</button>} />
    <div className="invoice-totals"><Metric label="Outstanding" value="$4,180.00" change="2 invoices due" /><Metric label="Paid this month" value="$32,440.00" change="18 invoices" /><Metric label="Overdue" value="$0.00" change="On track" /></div>
    <section className="data-table"><table><thead><tr><th>Invoice</th><th>Customer</th><th>Amount</th><th>Due date</th><th>Status</th><th /></tr></thead><tbody>{invoiceRows.map((invoice) => <tr key={invoice.id}><td><strong>{invoice.id}</strong></td><td>{invoice.customer}</td><td>{invoice.amount}</td><td>{invoice.due}</td><td><span className={`status-label ${invoice.status === "Paid" ? "status-label--paid" : invoice.status === "Sent" ? "status-label--open" : "status-label--draft"}`}><StatusPip tone={invoice.status === "Paid" ? "lime" : invoice.status === "Sent" ? "amber" : "gray"} />{invoice.status}</span></td><td><button className="row-menu" onClick={() => onNotify(`${invoice.id} details opened.`)} aria-label={`Open actions for ${invoice.id}`}><MoreHorizontal size={17} /></button></td></tr>)}</tbody></table></section>
  </>
}

function SettingsView({ onNotify }: { onNotify: (message: string) => void }) {
  const [section, setSection] = useState("Workspace")
  const descriptions: Record<string, string> = {
    Workspace: "Details that identify your workspace to the team.",
    Billing: "Plan, payment method, and invoice history for Northstar.",
    Notifications: "Choose which workspace events need your attention.",
    "API access": "Manage API keys and application integrations.",
    Security: "Control sign-in, sessions, and workspace access.",
  }
  return <>
    <PageHeader title="Settings" description="Manage how Northstar works for your team." />
    <div className="settings-layout"><nav className="settings-nav">{Object.keys(descriptions).map((item) => <button key={item} className={section === item ? "is-active" : ""} onClick={() => setSection(item)}>{item}</button>)}</nav><section className="settings-content"><div className="settings-heading"><h2>{section}</h2><p>{descriptions[section]}</p></div>{section === "Workspace" && <><label>Workspace name<input defaultValue="Northstar" /></label><label>Workspace URL<div className="input-prefix"><span>northstar.app/</span><input defaultValue="workspace" /></div></label><label>Default currency<select defaultValue="USD"><option>USD — US Dollar</option><option>EUR — Euro</option></select></label></>}{section === "Notifications" && <><label>Workspace activity<select defaultValue="Important"><option>Important only</option><option>All activity</option><option>Off</option></select></label><label>Weekly summary<select defaultValue="Monday"><option>Monday</option><option>Friday</option><option>Off</option></select></label></>}{section !== "Workspace" && section !== "Notifications" && <label>{section === "Billing" ? "Billing contact" : section === "API access" ? "Integration label" : "Session policy"}<input defaultValue={section === "Billing" ? "billing@northstar.app" : section === "API access" ? "Northstar production" : "Require SSO for admins"} /></label>}<div className="form-footer"><button className="button-primary" onClick={() => onNotify(`${section} settings saved.`)}>Save changes</button></div></section></div>
  </>
}

function NotificationsView({ onNotify }: { onNotify: (message: string) => void }) {
  const [unread, setUnread] = useState(new Set(["payment", "plan"]))
  const markRead = (id: string, title: string) => {
    setUnread((current) => { const next = new Set(current); next.delete(id); return next })
    onNotify(`${title} marked as read.`)
  }
  return <>
    <PageHeader title="Notifications" description="The latest activity from Northstar." action={<button className="button-secondary" onClick={() => { setUnread(new Set()); onNotify("All notifications marked as read.") }}>Mark all as read</button>} />
    <section className="notification-list"><Notification icon={<CreditCard size={17} />} title="Payment received from Morrow & Co." detail="$640.00 was added to your balance." time="34 minutes ago" unread={unread.has("payment")} onClick={() => markRead("payment", "Payment notification")} /><Notification icon={<Users size={17} />} title="Quarry Labs requested a plan change" detail="Their team wants to move to the Scale plan." time="2 hours ago" unread={unread.has("plan")} onClick={() => markRead("plan", "Plan request")} /><Notification icon={<FileText size={17} />} title="Invoice INV-0992 was viewed" detail="Bright Assembly opened their invoice." time="5 hours ago" onClick={() => onNotify("Invoice notification opened.")} /><Notification icon={<ShieldCheck size={17} />} title="Lexicon mapping check completed" detail="All 37 mapped actions are ready to use." time="Yesterday" onClick={() => onNotify("Mapping report opened.")} /></section>
  </>
}

function Notification({ icon, title, detail, time, unread = false, onClick }: { icon: React.ReactNode; title: string; detail: string; time: string; unread?: boolean; onClick: () => void }) {
  return <button className={`notification-item ${unread ? "is-unread" : ""}`} onClick={onClick}><span className="notification-icon">{icon}</span><span><strong>{title}</strong><p>{detail}</p><small>{time}</small></span>{unread && <StatusPip />}</button>
}

function ProfileView({ onNotify }: { onNotify: (message: string) => void }) {
  return <>
    <PageHeader title="Profile" description="Your personal details and preferences." />
    <section className="profile-card"><div className="profile-top"><span className="profile-avatar">AM</span><div><h2>Ava Morgan</h2><p>ava@northstar.app</p></div><button className="button-secondary" onClick={() => onNotify("Photo picker opened.")}>Change photo</button></div><div className="profile-form"><label>Full name<input defaultValue="Ava Morgan" /></label><label>Email address<input defaultValue="ava@northstar.app" /></label><label>Role<input defaultValue="Administrator" disabled /></label><label>Time zone<select defaultValue="UTC"><option>UTC — Coordinated Universal Time</option><option>EST — Eastern Standard Time</option></select></label></div><div className="form-footer"><button className="button-primary" onClick={() => onNotify("Profile saved.")}>Save profile</button></div></section>
  </>
}

function ConsoleView({ onAction, onCopy, copied, onNotify }: { onAction: (action: MappedAction, text: string) => void; onCopy: () => void; copied: boolean; onNotify: (message: string) => void }) {
  const [consoleCommand, setConsoleCommand] = useState("Export this report")
  const action = resolveVoiceCommand(consoleCommand)
  return <>
    <PageHeader title="Lexicon console" description="The action model powering voice in Northstar." action={<button className="button-secondary" onClick={() => onNotify("Replaying the most recent successful voice session.")}><Play size={15} /> Replay session</button>} />
    <div className="console-stat-row"><div><span>Mapped routes</span><strong>8</strong><small><Check size={13} /> All healthy</small></div><div><span>Mapped actions</span><strong>{mappedActions.length}</strong><small><Check size={13} /> 100% deterministic</small></div><div><span>Voice sessions</span><strong>128</strong><small><ArrowUpRight size={13} /> 24% this week</small></div><div><span>Execution success</span><strong>99.2%</strong><small><Check size={13} /> Last 30 days</small></div></div>
    <div className="console-layout"><section className="mapping-panel"><div className="panel-heading"><div><span>Action map</span><strong>Northstar lexicon</strong></div><button className="text-button" onClick={() => onNotify("Mapping editor opened for Northstar.")}>Edit map</button></div><div className="mapping-table">{mappedActions.map((item) => <button key={item.id} onClick={() => onAction(item, item.examples[0])}><span className="mapping-icon">{item.operation === "navigate" ? <PanelRightOpen size={15} /> : item.operation === "export" ? <Download size={15} /> : <Zap size={15} />}</span><span><strong>{item.label}</strong><small>{item.selector}</small></span>{item.needsConfirmation && <LockKeyhole size={14} />}<ChevronRight size={16} /></button>)}</div></section><section className="tester-panel"><div className="panel-heading"><div><span>Command tester</span><strong>Try the agent before your users do</strong></div><span className="live-model"><StatusPip /> Gemini tools</span></div><div className="command-tester"><div className="tester-input"><Mic size={17} /><input value={consoleCommand} onChange={(event) => setConsoleCommand(event.target.value)} /><button onClick={() => onAction(action, consoleCommand)}><Play size={15} /></button></div><div className="tester-result"><span className="eyeline"><CheckCircle2 size={13} /> Parsed action</span><strong>{action.label}</strong><p>{action.description}</p><div><span>Tool</span><code>select_mapped_action</code><span>→</span><code>{action.id}</code></div></div></div><div className="session-log"><div><span>Recent execution</span><button onClick={() => onNotify("Execution log expanded with 128 recent sessions.")}>View logs</button></div><p><StatusPip /> 10:48:19 <span>“Show orders from last week”</span> → <strong>show-orders-last-week</strong> <em>424ms</em></p><p><StatusPip /> 10:42:07 <span>“Open settings”</span> → <strong>open-settings</strong> <em>188ms</em></p></div></section></div>
    <div className="console-coverage"><section><div className="panel-heading"><div><span>Mapped surfaces</span><strong>What Lexicon can see</strong></div><button className="text-button" onClick={() => onNotify("Scan complete: 37 mapped elements are healthy.")}>Rescan app</button></div><div className="surface-map">{[["Overview", "Navigation · buttons · approval queue", "11 nodes"], ["Customers", "Table · create form · account actions", "9 nodes"], ["Orders", "Filters · orders table · export", "7 nodes"], ["Analytics", "Chart · date controls · report export", "10 nodes"]].map(([surface, detail, count]) => <div key={surface}><span className="surface-page"><LayoutDashboard size={14} />{surface}</span><span>{detail}</span><strong>{count}</strong></div>)}</div></section><section className="workflow-map"><div className="panel-heading"><div><span>Workflow preview</span><strong>Export analytics report</strong></div><span className="live-model"><ShieldCheck size={13} /> Confirmation required</span></div><div className="workflow-path"><span>Analytics</span><ChevronRight size={14} /><span>Export report</span><ChevronRight size={14} /><span className="is-confirmation">Confirm</span><ChevronRight size={14} /><span>CSV download</span></div><p><CheckCircle2 size={14} /> All selectors were found in the latest scan. No failures to debug.</p></section></div>
    <section className="integration-panel"><div><span className="eyeline"><Code2 size={13} /> Installation</span><h3>Mount the voice surface.</h3><p>Lexicon’s SDK publishes your manifest and renders the assistant wherever your users need it.</p></div><pre><code>{'npm i @lexicon/voice\nlexicon.mount({ app: "northstar" })'}</code></pre><button className="copy-button" onClick={onCopy}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Copied" : "Copy"}</button></section>
  </>
}
