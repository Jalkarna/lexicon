import { redirect } from "next/navigation"

export default function NotificationsPage() {
  redirect("/console/overview?showNotifications=true")
}
