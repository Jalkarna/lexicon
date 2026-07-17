import type { Metadata } from "next"

import { RillworkRoutePage } from "@/rillwork/ui"

export const metadata: Metadata = {
  title: "Profile",
}

export default function ProfilePage() {
  return <RillworkRoutePage route="profile" />
}
