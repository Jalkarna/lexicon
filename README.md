# Lexicon

**Give software a voice without giving the model unrestricted control.**

[Live demo](https://lexicon-wheat.vercel.app/) · [Project story](./ABOUT_PROJECT.md) · Built for OpenAI Build Week

Lexicon is a framework-agnostic TypeScript SDK that connects natural-language and live-voice interfaces to developer-owned product actions. Instead of asking a browser agent to inspect a screen and guess what to click, Lexicon gives the model an explicit map of routes, typed inputs, handlers, and confirmation policies.

The model interprets intent. Lexicon validates the request and enforces policy. The application keeps authority over execution.

## Why Lexicon

Browser agents are useful when an application has no integration surface, but they operate from the outside. They repeatedly inspect pixels or DOM state, infer the next interaction, and hope the interface has not changed. This introduces latency and makes important workflows sensitive to layout changes, loading states, hidden permissions, and incorrect clicks.

Lexicon works from inside the product. A request such as “Create a customer named Northstar Labs on the Foundry plan” maps to a registered `create-customer` capability with typed fields and a real application handler. If the action is guarded, Lexicon prepares a preview and requires explicit confirmation in a later user turn before anything runs.

```text
User request
    ↓
Gemini understands the intent
    ↓
Lexicon matches a registered capability
    ↓
Validate and collect typed inputs
    ↓
Apply direct or confirmation-required policy
    ↓
Run the application-owned handler
```

## What is included

The repository contains two independent projects:

```text
lexicon/
├── sdk/    # @lexicon/sdk — reusable capability runtime
└── demo/   # Rillwork — Next.js product using the SDK
```

### `@lexicon/sdk`

- Serializable capability manifests
- Gemini function declarations
- Input coercion and required-field collection
- Guarded previews and later-turn confirmation
- Runtime handler registration and execution
- Typed Gemini and Live adapters
- Browser microphone PCM capture and gapless audio playback
- Deterministic local resolution for testing and fallback behavior

The SDK does not import React, Next.js, or the demo application. Authentication, data access, navigation, and mutations remain owned by the host product.

### Rillwork demo

Rillwork is a complete Next.js application showing Lexicon across normal product workflows rather than a standalone chat window. The demo registers **32 capabilities across 9 routes**, including:

- Analytics and navigation
- Customers, orders, and invoices
- Approval-required plan changes
- Settings, profile, and notification actions
- Filters, report exports, and live voice
- A capability console for inspecting routes, fields, schemas, and policies

Manual UI interactions and assistant interactions use the same application handlers, so voice does not create a second copy of the product’s business logic.

## Safety model

Confirmation belongs to the Lexicon runtime, not the model. A guarded tool call creates pending state tied to the exact capability and normalized input. The model cannot approve its own request by returning a field such as `confirmed: true`; execution requires a separate user turn that matches the pending action.

Routine reads and navigation can remain fast, while sensitive writes receive a visible preview and explicit consent.

## How Codex and GPT-5.6 were used

We used **Codex with GPT-5.6** throughout Build Week as an engineering collaborator, not as part of Lexicon’s production runtime.

Codex helped us:

- Explore the capability-based architecture and pressure-test it against browser-agent failure modes
- Implement and refactor the framework-independent TypeScript SDK
- Build the Next.js demo, capability console, live-voice surface, and guarded-action UI
- Trace confirmation authority across multiple conversation turns
- Generate focused tests for validation, missing fields, cancellation, handler failures, and model self-confirmation attempts
- Review the package boundary so the SDK stayed independent from React and the demo
- Debug integration issues, improve accessibility and interaction polish, and prepare the project documentation

GPT-5.6 was especially useful for reasoning across the full system—model tools, runtime state, application handlers, and UI feedback—while Codex provided the repository-aware workflow for inspecting code, making changes, running tests, and validating the result. Product direction, safety boundaries, and final implementation decisions remained human-owned.

Lexicon itself uses Gemini for typed intent resolution and live voice. Codex and GPT-5.6 were the development tools used to build and evaluate the project.

## Built with

TypeScript, Next.js, React, Node.js, Gemini API, Gemini Live API, Codex, GPT-5.6, Web Audio API, Tailwind CSS, and Vercel.

## Run locally

Node.js 20 or newer is required.

Build the SDK:

```bash
cd sdk
npm install
npm run build
```

Run the demo:

```bash
cd demo
npm install
cp .env.example .env.local
npm run dev
```

Set `LEXICON_GEMINI_API_KEY` in `demo/.env.local`, then open [http://localhost:3000](http://localhost:3000).

On Windows, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-windows.ps1
```

## Validation

```bash
cd sdk
npm test
npm run typecheck

cd ../demo
npm run typecheck
npm run build
```

The SDK test suite covers manifest sanitization, tool generation, local resolution, missing-field collection, confirmation authority, cancellation, invalid inputs, handler failures, and serializable model responses.
