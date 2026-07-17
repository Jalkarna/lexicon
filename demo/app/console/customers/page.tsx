import type { Metadata } from "next"

import { RillworkRoutePage } from "@/rillwork/ui"

export const metadata: Metadata = {
  title: "Customers",
}

export default function CustomersPage() {
  return <RillworkRoutePage route="customers" />
}
