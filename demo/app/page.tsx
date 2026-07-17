import type { Metadata } from "next"

import { LexiconLandingPage } from "@/rillwork/ui"

export const metadata: Metadata = {
  title: "Lexicon — Voice actions for software",
  description:
    "A capability SDK for dependable voice and typed actions inside web products.",
}

export default function HomePage() {
  return <LexiconLandingPage />
}
