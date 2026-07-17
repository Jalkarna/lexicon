# @lexicon/sdk

Lexicon is a framework-agnostic capability runtime for connecting natural-language interfaces to developer-owned application actions.

This directory is the product package. It is independently typechecked, built to `dist/`, and can be packed or published without the demo application.

The SDK owns:

- Serializable capability manifests and Gemini function declarations.
- Input coercion and required-field collection.
- Guarded previews and explicit later-turn confirmation.
- Runtime handler registration and execution.
- Typed and Live Gemini adapters with a deterministic local fallback.
- Browser microphone PCM capture and gapless Live audio playback.

The host application owns:

- Authentication and authorization.
- Data access and mutations.
- Navigation.
- Capability handlers and result presentation.

```ts
import { createLexiconRuntime } from "@lexicon/sdk"

const lexicon = createLexiconRuntime({
  app: "Acme",
  capabilities: [
    {
      id: "create-customer",
      label: "Create customer",
      description: "Create a customer account.",
      kind: "create",
      fields: [
        { name: "name", label: "Company name", type: "string", required: true },
      ],
      confirmation: "always",
      handler: async ({ input }) => {
        const customer = await customers.create(input)
        return { message: `${customer.name} was created.`, data: customer }
      },
    },
  ],
})
```

## Package entry points

- `@lexicon/sdk` — manifest types and the capability runtime.
- `@lexicon/sdk/gemini` — typed Gemini resolution and constrained Live token creation.
- `@lexicon/sdk/live` — browser PCM microphone capture and audio playback.

`@google/genai` is an optional peer dependency. Install it only when using
`@lexicon/sdk/gemini`.

```bash
npm install
npm run build
npm test
npm pack --dry-run
```
