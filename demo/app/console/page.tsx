import type { Metadata } from "next"

import { RillworkRoutePage } from "@/rillwork/ui"

export const metadata: Metadata = {
  title: "Capability console",
}

export default function CapabilityConsolePage() {
  return <RillworkRoutePage route="console" />
}
