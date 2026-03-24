import { NextRequest, NextResponse } from "next/server"
import { getChatMessages } from "@/lib/chat/neo4j-sessions"
import { appendHistory } from "@/lib/chat/sessions"

export const runtime = "nodejs"

/** Load a past chat's messages and repopulate the in-memory session store. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params
  try {
    const messages = await getChatMessages(chatId)
    // Repopulate in-memory store so the AI has context for continued conversation
    appendHistory(chatId, messages.map(m => ({ role: m.role, content: m.content })))
    return NextResponse.json(messages)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
