import { NextRequest, NextResponse } from "next/server"
import { searchMessages } from "@/lib/chat/neo4j-sessions"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? ""
  if (!q.trim()) return NextResponse.json([])
  try {
    const results = await searchMessages(q, 20)
    return NextResponse.json(results)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
