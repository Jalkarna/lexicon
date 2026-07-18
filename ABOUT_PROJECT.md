# About the project

## Inspiration

Lexicon started from the problems we saw with browser agents. They inspect a screen or DOM, guess what to click, and repeat this for every step. It looks impressive, but it can be slow and fragile. A changed button, loading state, or hidden permission can break the workflow—or cause the wrong action.

We wanted an assistant that works with the product’s real actions instead of operating it from the outside.

## What we built

Lexicon is a TypeScript SDK that exposes product actions as typed capabilities. Each capability defines its inputs, route, handler, and confirmation policy.

Gemini understands what the user means. Lexicon validates the request, collects missing fields, applies the product’s rules, and runs the real handler. Sensitive actions require confirmation in a separate user turn, so the model cannot approve its own request.

We built Rillwork, a full Next.js product, to demonstrate it. It includes 32 capabilities across 9 routes covering analytics, customers, orders, invoices, approvals, settings, navigation, and exports.

## Challenges

The hardest part was making confirmation actually trustworthy while keeping the conversation natural. We also worked through incomplete user requests, live-audio latency, microphone playback, and keeping the reusable SDK separate from demo-specific business logic.

## What we learned

Browser agents are useful when no integration exists, but they have to infer how a product works from its interface. A capability-based agent gets a direct contract with the application.

Our main lesson was simple: let the model understand intent, but let the product keep authority.
