import type { Metadata } from "next"

import { RillworkRoutePage } from "@/rillwork/ui"

export const metadata: Metadata = {
  title: "Orders",
}

export default function OrdersPage() {
  return <RillworkRoutePage route="orders" />
}
