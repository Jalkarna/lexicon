import type { Metadata } from "next"

import { RillworkConsoleLayout } from "@/rillwork/ui"

export const metadata: Metadata = {
  title: {
    default: "Rillwork demo — Lexicon",
    template: "%s — Rillwork",
  },
  description:
    "A routed demo application showing Lexicon SDK navigation, reads, mutations, approvals, and voice workflows.",
}

export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <RillworkConsoleLayout>{children}</RillworkConsoleLayout>
}
