import { NextRequest } from "next/server"
import { getAllSkillTools } from "@/lib/skills/registry"
import { runChat } from "@/lib/models/adapter"
import { AVAILABLE_MODELS, DEFAULT_MODEL, type ModelConfig } from "@/lib/models/types"
import { getHistory, appendHistory, clearHistory } from "@/lib/chat/sessions"
import { entitySystemContext } from "@/entities/registry"
import { getMode, DEFAULT_MODE_ID } from "@/modes/registry"
import { personEntity } from "@/entities/person"
import { persistMessages } from "@/lib/chat/neo4j-sessions"
import { getConfig } from "@/lib/config"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const { sessionId, message, model: modelId, modeId, personIds, modeContext } = await req.json() as {
    sessionId: string
    message: string
    model?: string
    modeId?: string
    personIds?: string[]
    modeContext?: Record<string, unknown>
  }

  const model: ModelConfig = AVAILABLE_MODELS.find(m => m.model === modelId) ?? DEFAULT_MODEL
  const tools = getAllSkillTools()

  // Resolve mode and build system prompt
  const mode = getMode(modeId ?? DEFAULT_MODE_ID) ?? getMode(DEFAULT_MODE_ID)!
  let people: { id: string; name: string; role?: string; notes?: string }[] = []
  if (personIds && personIds.length > 0) {
    const all = await personEntity.list()
    people = all.filter(p => personIds.includes(p.id as string))
      .map(p => ({ id: p.id as string, name: p.name as string, role: p.role as string | undefined, notes: p.notes as string | undefined }))
  }
  const appConfig = await getConfig()
  // For the default mode: use the custom system prompt if set, otherwise fall back to the built-in
  const modePrompt = (mode.id === DEFAULT_MODE_ID && appConfig.systemPrompt)
    ? appConfig.systemPrompt.replace(/\{name\}/g, appConfig.name)
    : mode.buildSystemPrompt(people, modeContext).replace(/Elsie/g, appConfig.name)
  const systemPrompt = `${modePrompt}\n\n${entitySystemContext()}`

  // Fetch existing history and append the new user message
  const history = getHistory(sessionId)
  const newUserMsg = { role: "user" as const, content: message }
  appendHistory(sessionId, [newUserMsg])

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      let textAcc = ""

      try {
        for await (const event of runChat({
          model,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          messages: [...history, newUserMsg] as any,
          tools,
          system: systemPrompt,
        })) {
          send(event)
          if (event.type === "text_delta" && event.text) textAcc += event.text
        }

        if (textAcc) {
          appendHistory(sessionId, [{ role: "assistant", content: textAcc }])
          // Persist to Neo4j for history + search (fire and forget — don't block stream close)
          void persistMessages(sessionId, [
            { role: "user", content: message },
            { role: "assistant", content: textAcc },
          ], modeId ?? DEFAULT_MODE_ID).catch(() => { /* non-fatal */ })
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"))
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : String(err) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}

export async function DELETE(req: NextRequest) {
  const { sessionId } = await req.json() as { sessionId: string }
  clearHistory(sessionId)
  return new Response(null, { status: 204 })
}
