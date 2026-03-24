import { NextRequest } from "next/server"
import { getAllSkillTools } from "@/lib/skills/registry"
import { runChat } from "@/lib/models/adapter"
import type { ModelConfig } from "@/lib/models/types"
import { getHistory, appendHistory, clearHistory } from "@/lib/chat/sessions"
import { entitySystemContext } from "@/entities/registry"
import { getPersona, buildSystemPrompt, DEFAULT_PERSONA_ID, getAllPersonas } from "@/modes/registry"
import { getEntity } from "@/entities/registry"
import { persistMessages } from "@/lib/chat/neo4j-sessions"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const { sessionId, message, personaId, modeContext } = await req.json() as {
    sessionId: string
    message: string
    personaId?: string
    modeContext?: Record<string, unknown>
  }

  const persona = getPersona(personaId ?? DEFAULT_PERSONA_ID) ?? getAllPersonas()[0]
  const tools = getAllSkillTools()

  // Fetch people if persona needs them (e.g. mbti-coach)
  let people: Array<{ id: string; name: string; role?: string; notes?: string }> = []
  if (persona.requiresMbtiTarget) {
    const personEntity = getEntity("Person")
    if (personEntity) {
      const all = await personEntity.list()
      people = all.map(p => ({
        id: p.id as string,
        name: p.name as string,
        role: p.role as string | undefined,
        notes: p.notes as string | undefined,
      }))
    }
  }

  const systemPrompt = `${buildSystemPrompt(persona, {
    targetMbti: modeContext?.targetMbti as string | undefined,
    people,
  })}\n\n${entitySystemContext()}`

  const model: ModelConfig = { provider: persona.provider, model: persona.model, label: persona.name }

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
          void persistMessages(sessionId, [
            { role: "user", content: message },
            { role: "assistant", content: textAcc },
          ], personaId ?? DEFAULT_PERSONA_ID).catch(() => { /* non-fatal */ })
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
