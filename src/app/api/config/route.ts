import { NextRequest, NextResponse } from "next/server"
import { getConfig, setConfig } from "@/lib/config"

export const runtime = "nodejs"

export async function GET() {
  const config = await getConfig()
  return NextResponse.json(config)
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const updated = await setConfig({
    name: typeof body.name === "string" ? body.name.trim() || undefined : undefined,
    systemPrompt: typeof body.systemPrompt === "string" ? body.systemPrompt : undefined,
  })
  return NextResponse.json(updated)
}
