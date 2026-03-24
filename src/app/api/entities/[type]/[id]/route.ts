import { NextRequest, NextResponse } from "next/server"
import { getEntity } from "@/entities/registry"

type Ctx = { params: Promise<{ type: string; id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { type, id } = await params
  const entity = getEntity(type)
  if (!entity) return NextResponse.json({ error: "Unknown entity type" }, { status: 404 })

  const item = await entity.get(id)
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(item)
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { type, id } = await params
  const entity = getEntity(type)
  if (!entity) return NextResponse.json({ error: "Unknown entity type" }, { status: 404 })

  const data = await req.json()
  try {
    const item = await entity.update(id, data)
    return NextResponse.json(item)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { type, id } = await params
  const entity = getEntity(type)
  if (!entity) return NextResponse.json({ error: "Unknown entity type" }, { status: 404 })

  await entity.delete(id)
  return new Response(null, { status: 204 })
}
