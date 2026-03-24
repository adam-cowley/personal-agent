import { AppShell } from "@/components/layout/AppShell"
import { ChatWindow } from "@/components/chat/ChatWindow"

export default function HomePage() {
  return (
    <AppShell>
      <ChatWindow />
    </AppShell>
  )
}
