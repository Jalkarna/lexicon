import type { Metadata } from "next"

import { RillworkRoutePage } from "@/rillwork/ui"

export const metadata: Metadata = {
  title: "Overview",
}

export default function OverviewPage() {
  return <RillworkRoutePage route="overview" />
}
