import assert from "node:assert/strict"
import test from "node:test"

import {
  buildLexiconAgentInstruction,
  buildLexiconToolDeclarations,
  capabilityForToolName,
  resolveLexiconLocally,
  sanitizeLexiconManifest,
  sanitizeLexiconPendingContext,
  toolNameForCapability,
} from "../dist/index.js"

const manifest = {
  app: "Acme",
  version: "1.0.0",
  capabilities: [
    {
      id: "open-orders",
      label: "Open orders",
      description: "Navigate to the orders page.",
      kind: "navigate",
      route: "/orders",
      examples: ["Take me to orders"],
      confirmation: "never",
    },
    {
      id: "create-customer",
      label: "Create customer",
      description: "Create a customer account.",
      kind: "create",
      fields: [
        {
          name: "name",
          label: "Company name",
          type: "string",
          required: true,
        },
        {
          name: "plan",
          label: "Plan",
          type: "enum",
          options: ["Starter", "Growth"],
        },
      ],
      confirmation: "always",
    },
  ],
}

test("sanitizes a serializable manifest and removes unsupported entries", () => {
  const sanitized = sanitizeLexiconManifest({
    ...manifest,
    capabilities: [
      ...manifest.capabilities,
      {
        id: "../bad",
        label: "Bad",
        description: "Invalid capability.",
        kind: "action",
      },
    ],
  })

  assert.equal(sanitized?.app, "Acme")
  assert.equal(sanitized?.capabilities.length, 2)
  assert.equal(sanitized?.capabilities[1]?.fields?.[1]?.options?.[1], "Growth")
})

test("builds stable tool names and constrained Gemini declarations", () => {
  const declarations = buildLexiconToolDeclarations(manifest)
  const guarded = declarations.find(
    (declaration) => declaration.name === "lexicon_create_customer"
  )

  assert.equal(toolNameForCapability("create-customer"), "lexicon_create_customer")
  assert.equal(
    capabilityForToolName(manifest, "lexicon_open_orders")?.id,
    "open-orders"
  )
  assert.deepEqual(guarded?.parametersJsonSchema.propertyOrdering, [
    "name",
    "plan",
    "confirmed",
  ])
  assert.equal(
    guarded?.parametersJsonSchema.properties.confirmed?.type,
    "boolean"
  )
  assert.equal(guarded?.parametersJsonSchema.additionalProperties, false)
})

test("builds an instruction that preserves SDK confirmation authority", () => {
  const instruction = buildLexiconAgentInstruction(manifest, {
    capabilityId: "create-customer",
    status: "needs-confirmation",
    input: { name: "Northstar" },
  })

  assert.match(instruction, /Never set confirmed=true in the first call/)
  assert.match(instruction, /awaiting confirmation/)
  assert.match(instruction, /lexicon_create_customer/)
})

test("sanitizes only pending contexts that belong to the manifest", () => {
  assert.equal(
    sanitizeLexiconPendingContext(
      {
        capabilityId: "unknown",
        status: "needs-input",
        input: {},
      },
      manifest
    ),
    undefined
  )

  assert.deepEqual(
    sanitizeLexiconPendingContext(
      {
        capabilityId: "create-customer",
        status: "needs-input",
        input: { name: "Northstar" },
        missingFields: ["plan"],
      },
      manifest
    ),
    {
      capabilityId: "create-customer",
      status: "needs-input",
      input: { name: "Northstar" },
      missingFields: ["plan"],
    }
  )
})

test("local resolution maps requests and handles pending confirmation", () => {
  assert.deepEqual(resolveLexiconLocally("Take me to orders", manifest), {
    call: {
      name: "lexicon_open_orders",
      args: {},
    },
  })

  assert.deepEqual(
    resolveLexiconLocally("yes, proceed", manifest, {
      capabilityId: "create-customer",
      status: "needs-confirmation",
      input: { name: "Northstar" },
    }),
    {
      call: {
        name: "lexicon_create_customer",
        args: { name: "Northstar", confirmed: true },
      },
    }
  )
})

test("local resolution collects several pending values from one answer", () => {
  assert.deepEqual(
    resolveLexiconLocally("Northstar Labs, hello@northstar.test, Growth", manifest, {
      capabilityId: "create-customer",
      status: "needs-input",
      input: {},
      missingFields: ["name", "plan"],
    }),
    {
      call: {
        name: "lexicon_create_customer",
        args: {
          name: "Northstar Labs",
          plan: "Growth",
        },
      },
    }
  )
})
