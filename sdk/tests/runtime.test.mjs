import assert from "node:assert/strict"
import test from "node:test"

import {
  createLexiconRuntime,
  toolNameForCapability,
} from "../dist/index.js"

function createRuntime(onCreate = () => undefined) {
  return createLexiconRuntime({
    app: "Acme",
    capabilities: [
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
            name: "email",
            label: "Email",
            type: "email",
            required: true,
          },
          {
            name: "plan",
            label: "Plan",
            type: "enum",
            options: ["Starter", "Growth"],
            required: true,
          },
        ],
        confirmation: "always",
        preview: (input) =>
          `Create ${input.name} on ${input.plan} with ${input.email}.`,
        handler: ({ input, source }) => {
          onCreate(input, source)
          return {
            message: `${input.name} was created.`,
            data: { id: "CUS-1", ...input },
          }
        },
      },
    ],
  })
}

test("collects missing fields, normalizes input, confirms, and executes", async () => {
  const calls = []
  const runtime = createRuntime((input, source) => calls.push({ input, source }))

  const first = await runtime.invoke("create-customer", {
    name: "Northstar",
  })
  assert.equal(first.status, "needs-input")
  assert.deepEqual(
    first.missingFields?.map((field) => field.name),
    ["email", "plan"]
  )

  const second = await runtime.continuePending({
    email: "hello@northstar.test",
    plan: "growth",
  })
  assert.equal(second.status, "needs-confirmation")
  assert.equal(
    second.preview,
    "Create Northstar on Growth with hello@northstar.test."
  )
  assert.equal(calls.length, 0)

  const third = await runtime.confirmPending()
  assert.equal(third.status, "completed")
  assert.equal(third.message, "Northstar was created.")
  assert.equal(third.data.id, "CUS-1")
  assert.deepEqual(calls, [
    {
      input: {
        name: "Northstar",
        email: "hello@northstar.test",
        plan: "Growth",
      },
      source: "ui",
    },
  ])
  assert.equal(runtime.pending(), null)
})

test("does not allow a model to self-confirm the first guarded tool call", async () => {
  let executions = 0
  const runtime = createRuntime(() => {
    executions += 1
  })
  const tool = toolNameForCapability("create-customer")
  const input = {
    name: "Northstar",
    email: "hello@northstar.test",
    plan: "Growth",
    confirmed: true,
  }

  const first = await runtime.invokeToolCall(tool, input, { source: "live" })
  assert.equal(first.status, "needs-confirmation")
  assert.equal(executions, 0)

  const second = await runtime.invokeToolCall(tool, input, { source: "live" })
  assert.equal(second.status, "completed")
  assert.equal(executions, 1)
})

test("keeps invalid enum values in the information-collection state", async () => {
  const runtime = createRuntime()
  const result = await runtime.invoke("create-customer", {
    name: "Northstar",
    email: "hello@northstar.test",
    plan: "Enterprise",
  })

  assert.equal(result.status, "needs-input")
  assert.deepEqual(
    result.missingFields?.map((field) => field.name),
    ["plan"]
  )
})

test("rejects malformed scalar, email, and integer input", async () => {
  const runtime = createLexiconRuntime({
    app: "Validation test",
    capabilities: [
      {
        id: "update-record",
        label: "Update record",
        description: "Update a record.",
        kind: "update",
        fields: [
          { name: "email", label: "Email", type: "email", required: true },
          { name: "seats", label: "Seats", type: "integer", required: true },
          { name: "note", label: "Note", type: "string", required: true },
        ],
        handler: () => undefined,
      },
    ],
  })

  const result = await runtime.invoke("update-record", {
    email: "not-an-email",
    seats: 2.5,
    note: { unsafe: true },
  })
  assert.equal(result.status, "needs-input")
  assert.deepEqual(
    result.missingFields?.map((field) => field.name),
    ["email", "seats", "note"]
  )
})

test("supports cancellation without executing the handler", async () => {
  let executions = 0
  const runtime = createRuntime(() => {
    executions += 1
  })
  await runtime.invoke("create-customer", {
    name: "Northstar",
    email: "hello@northstar.test",
    plan: "Growth",
  })

  const result = runtime.cancelPending()
  assert.equal(result.status, "cancelled")
  assert.equal(executions, 0)
  assert.equal(runtime.pending(), null)
})

test("returns a structured failure when a developer handler throws", async () => {
  const runtime = createRuntime(() => {
    throw new Error("Database unavailable.")
  })
  await runtime.invoke("create-customer", {
    name: "Northstar",
    email: "hello@northstar.test",
    plan: "Growth",
  })

  const result = await runtime.confirmPending()
  assert.equal(result.status, "failed")
  assert.equal(result.message, "Database unavailable.")
})

test("returns serializable function responses for model tool calls", async () => {
  const runtime = createRuntime()
  const result = await runtime.invoke("create-customer", { name: "Northstar" })
  assert.deepEqual(runtime.functionResponse(result), {
    status: "needs-input",
    message: "I need Email, Plan before I can create customer.",
    missingFields: [
      {
        name: "email",
        label: "Email",
        description: undefined,
      },
      {
        name: "plan",
        label: "Plan",
        description: undefined,
      },
    ],
    preview: undefined,
    data: undefined,
  })
})
