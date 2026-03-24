/**
 * POST /api/group-chat
 *
 * Multi-persona turn-based conversation. Each persona has its own LLM instance
 * (their configured provider + model from personas/*.yaml) and responds in sequence.
 * Each persona sees the full conversation including prior personas' responses this turn.
 *
 * SSE events:
 *   { type: "turn_start",  personaId, name }
 *   { type: "text_delta",  text }
 *   { type: "turn_end",    personaId }
 *   { type: "error",       message }
 *   data: [DONE]
 */

import { NextRequest } from "next/server"
import { getAllSkillTools } from "@/lib/skills/registry"
import { runChat } from "@/lib/models/adapter"
import { getHistory, appendHistory } from "@/lib/chat/sessions"
import { entitySystemContext } from "@/entities/registry"
import { getPersona, buildSystemPrompt, DEFAULT_PERSONA_ID } from "@/modes/registry"
import { getEntity } from "@/entities/registry"
import type { ModelConfig } from "@/lib/models/types"

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const { sessionId, message, personaIds, modeContext } = await req.json() as {
    sessionId: string
    message: string
    personaIds: string[]
    modeContext?: Record<string, unknown>
  }

  if (!personaIds || personaIds.length === 0) {
    return new Response(JSON.stringify({ error: "personaIds required" }), { status: 400 })
  }

  const tools = getAllSkillTools()
  const entityContext = entitySystemContext()

  // Resolve personas
  const personas = personaIds
    .map(id => getPersona(id) ?? getPersona(DEFAULT_PERSONA_ID)!)
    .filter(Boolean)

  // Fetch people if needed for mbti-coach context
  let people: Array<{ id: string; name: string; role?: string; notes?: string }> = []
  const needsPeople = personas.some(p => p.requiresMbtiTarget)
  if (needsPeople) {
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

  const history = getHistory(sessionId)
  const userMsg = { role: "user" as const, content: message }
  appendHistory(sessionId, [userMsg])

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // Accumulate this turn's thread: starts with history + user message
        // Each persona's response is appended so the next sees it
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const turnThread: Array<{ role: "user" | "assistant"; content: any }> = [
          ...history,
          userMsg,
        ]

        for (const persona of personas) {
          send({ type: "turn_start", personaId: persona.id, name: persona.name })

          const systemPrompt = buildSystemPrompt(persona, {
            targetMbti: modeContext?.targetMbti as string | undefined,
            people,
          })

          const model: ModelConfig = { provider: persona.provider, model: persona.model, label: persona.name }

          let textAcc = ""
          for await (const event of runChat({
            model,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            messages: turnThread as any,
            tools,
            system: `${systemPrompt}\n\n${entityContext}\n\nYou are speaking as part of a group conversation. Other participants may have already responded this turn — respond in your own voice, and feel free to engage with or build on what others have said.`,
          })) {
            if (event.type === "text_delta" || event.type === "thinking_delta" || event.type === "tool_use" || event.type === "tool_result") {
              send(event)
            }
            if (event.type === "text_delta" && event.text) textAcc += event.text
          }

          send({ type: "turn_end", personaId: persona.id })

          if (textAcc) {
            // Append as user context so the next persona's thread ends with a user message.
            // (Each persona is a distinct model — prior responses are context, not self.)
            turnThread.push({ role: "user", content: `[${persona.name} said]: ${textAcc}` })
          }
        }

        // Persist the full turn to session history
        const fullResponse = turnThread
          .slice(history.length + 1)  // skip original history + user msg
          .map(m => m.content)
          .join("\n\n")

        if (fullResponse) {
          appendHistory(sessionId, [{ role: "assistant", content: fullResponse }])
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
