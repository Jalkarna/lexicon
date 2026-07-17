import type { Metadata } from "next"

import { RillworkRoutePage } from "@/rillwork/ui"

export const metadata: Metadata = {
  title: "Settings",
}

export default function SettingsPage() {
  return <RillworkRoutePage route="settings" />
}
