import { NextResponse } from "next/server"
import { listChats } from "@/lib/chat/neo4j-sessions"

export const runtime = "nodejs"

export async function GET() {
  try {
    const chats = await listChats()
    return NextResponse.json(chats)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
