import type { Metadata } from "next"

import { RillworkRoutePage } from "@/rillwork/ui"

export const metadata: Metadata = {
  title: "Invoices",
}

export default function InvoicesPage() {
  return <RillworkRoutePage route="invoices" />
}
