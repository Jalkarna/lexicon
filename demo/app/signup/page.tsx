import type { Metadata } from "next"

import { LexiconAuthPage } from "@/rillwork/ui"

export const metadata: Metadata = {
  title: "Create a workspace — Lexicon",
}

export default function SignupPage() {
  return <LexiconAuthPage mode="signup" />
}
