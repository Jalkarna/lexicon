# Lexicon

Lexicon is a voice layer for web products. Developers map the routes and actions that matter once; the voice agent resolves language through those explicit mappings and executes the target action deterministically.

## Run the demo

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open the local URL, choose **Open demo**, and use the Lexicon voice surface. The workspace includes overview, analytics, customers, orders, invoices, settings, notifications, profile management, and a developer console.

## Voice runtime

The demo intentionally has two execution paths:

- `app/api/transcribe/route.ts` receives a short WAV recording captured with `getUserMedia`, transcribes it server-side with Gemini, and returns only the command text. There is no simulated microphone fallback.
- `app/api/agent/route.ts` is the command bridge. It opens a short Gemini Live session and gives Gemini a single native function, `select_mapped_action`, whose enum is derived from the developer-defined action map. If Gemini is unavailable, the route returns the local deterministic mapping.
- `lib/gemini-live.ts` contains the server-side Gemini Live session configuration and sends command text with `sendRealtimeInput`, the Live API's real-time input path. Set `LEXICON_GEMINI_API_KEY` in `.env.local` to keep Lexicon’s key isolated from any shared `GOOGLE_API_KEY` or `GEMINI_API_KEY` in the host environment.

No Playwright, Selenium, Puppeteer, screenshots, or visual scraping are used. Execution is always based on the mapped application structure.

## SDK shape

`lib/sdk.ts` demonstrates the lightweight browser integration:

```ts
import { mountLexicon } from "@/lib/sdk"

const lexicon = mountLexicon("northstar", { root: document.querySelector("#app")! })
lexicon.register({
  id: "export-report",
  label: "Export report",
  selector: "[data-lexicon='export-report']",
  needsConfirmation: true,
})
```

`scan()` discovers only developer-marked `[data-lexicon]` elements. `execute()` runs either the registered selector or a framework adapter's explicit `handler`, then publishes a `lexicon:executed` event for observability. `executeWorkflow()` composes developer-authored `navigate`, `click`, `fill`, and `extract` steps; it never falls back to visual scraping or arbitrary browser control.

## Design and UI registry

The project is initialized with shadcn and uses the Cult UI registry. The configuration lives in `components.json`; Cult UI text animation, animated numbers, and terminal playback are used in the landing experience. The project-level Codex MCP configuration is added through the shadcn CLI setup.

## Verification

```bash
npm run typecheck
npm run lint
npm run build
```
