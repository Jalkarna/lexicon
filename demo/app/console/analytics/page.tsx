import type { Metadata } from "next"

import { RillworkRoutePage } from "@/rillwork/ui"

export const metadata: Metadata = {
  title: "Analytics",
}

export default function AnalyticsPage() {
  return <RillworkRoutePage route="analytics" />
}
