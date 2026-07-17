# Lexicon

This repository contains two independent projects:

```text
lexicon/
├── sdk/    # @lexicon/sdk — the reusable, publishable product
└── demo/   # @lexicon/demo — a separate Next.js app using the SDK
```

The root is only a container. It has no package manifest, lockfile, or dependency tree. SDK code never imports the demo, React, or Next.js. The demo installs `@lexicon/sdk` from `../sdk` exactly as a local external package.

## Install the SDK

```bash
cd sdk
npm install
npm run build
```

## Install and run the demo

```bash
cd demo
npm install
cp .env.example .env.local
npm run dev
```

Set `LEXICON_GEMINI_API_KEY` in `.env.local`. `GOOGLE_API_KEY` and `GEMINI_API_KEY` are also accepted.

## Packages

- [`sdk/`](./sdk) contains manifests, tool generation, conversational field collection, guarded confirmation, capability execution, Gemini adapters, and browser Live audio utilities. It owns its own `package-lock.json`, builds to `sdk/dist`, and packs as `@lexicon/sdk`.
- [`demo/`](./demo) contains the complete Rillwork Next.js application: routes, UI, demo data, capability mappings, handlers, assets, and environment configuration.
