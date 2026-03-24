import { NextRequest, NextResponse } from 'next/server'
import { setupSchema, seedDemoData } from '@/lib/neo4j/schema'

export async function POST(req: NextRequest) {
  const { seed } = await req.json().catch(() => ({})) as { seed?: boolean }

  try {
    await setupSchema()
    if (seed) {
      await seedDemoData()
    }
    return NextResponse.json({ ok: true, seeded: !!seed })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
