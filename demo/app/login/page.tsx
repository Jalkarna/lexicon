import type { Metadata } from "next"

import { LexiconAuthPage } from "@/rillwork/ui"

export const metadata: Metadata = {
  title: "Sign in — Lexicon",
}

export default function LoginPage() {
  return <LexiconAuthPage mode="signin" />
}
