import { NextRequest, NextResponse } from "next/server"
import { getEntity } from "@/entities/registry"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params
  const entity = getEntity(type)
  if (!entity) return NextResponse.json({ error: "Unknown entity type" }, { status: 404 })

  try {
    const items = await entity.list()
    return NextResponse.json(items)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params
  const entity = getEntity(type)
  if (!entity) return NextResponse.json({ error: "Unknown entity type" }, { status: 404 })

  const data = await req.json()
  try {
    const item = await entity.create(data)
    return NextResponse.json(item, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
