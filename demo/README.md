# Lexicon Rillwork demo

This is a standalone Next.js demo application consuming `@lexicon/sdk` from the sibling [`../sdk`](../sdk) package through its `file:../sdk` dependency.

The demo owns all application-specific concerns:

- Rillwork data and state.
- Route mappings and navigation.
- Customer, order, and invoice handlers.
- Approval, settings, profile, notification, filter, and export actions.
- End-user voice and typed-command UI.
- Gemini API route wiring and environment variables.

The SDK owns capability validation, missing-field collection, confirmation state, tool schemas, execution, and Gemini/Live adapters.

## Routes

- `/`
- `/login`
- `/signup`
- `/console`
- `/console/overview`
- `/console/analytics`
- `/console/customers`
- `/console/orders`
- `/console/invoices`
- `/console/settings`
- `/console/profile`

```bash
npm install
npm run dev
```
