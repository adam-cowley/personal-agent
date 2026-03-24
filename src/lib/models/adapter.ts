/**
 * Provider-agnostic adapter for tool-calling chat with streaming.
 *
 * Yields SSE-compatible events:
 *   { type: "text_delta",     text }     — streamed text token
 *   { type: "thinking_delta", text }     — reasoning/thinking token (Anthropic Opus)
 *   { type: "tool_use",       name, id } — tool invoked
 *   { type: "error",          message }  — error
 */

import type { ModelConfig } from "./types"
import type { Skill } from "@/lib/skills/types"

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

export interface ChatEvent {
  type: "text_delta" | "thinking_delta" | "tool_use" | "tool_result" | "entity_form" | "choice_form" | "error"
  text?: string
  name?: string
  id?: string
  result?: string
  message?: string
  entityType?: string
  prefilled?: Record<string, unknown>
  question?: string
  options?: Array<{ id: string; label: string; description?: string }>
  multiple?: boolean
}

/**
 * If a tool handler returns JSON with `__entityForm: true`, the adapter emits
 * an `entity_form` event to the client (showing a pre-filled dialog) and sends
 * `__aiMessage` back to the AI as the tool result.
 */
interface EntityFormPayload {
  __entityForm: true
  entityType: string
  prefilled: Record<string, unknown>
  __aiMessage: string
}

interface ChoiceFormPayload {
  __choiceForm: true
  question: string
  options: Array<{ id: string; label: string; description?: string }>
  multiple: boolean
  __aiMessage: string
}

type InterruptPayload = EntityFormPayload | ChoiceFormPayload | null

function parseInterrupt(content: string): InterruptPayload {
  try {
    const parsed = JSON.parse(content)
    if (parsed.__entityForm === true) return parsed as EntityFormPayload
    if (parsed.__choiceForm === true) return parsed as ChoiceFormPayload
  } catch { /* not JSON */ }
  return null
}

export interface RunChatOptions {
  model: ModelConfig
  messages: ChatMessage[]
  tools: Skill["tools"]
  system: string
}

// ─── Anthropic (streaming + extended thinking) ───────────────────────────────

async function* runAnthropicChat(opts: RunChatOptions): AsyncGenerator<ChatEvent> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let currentMessages: any[] = opts.messages.map(m => ({ role: m.role, content: m.content }))
  const supportsThinking = opts.model.model.includes("opus")

  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createParams: any = {
      model: opts.model.model,
      max_tokens: supportsThinking ? 16000 : 4096,
      system: opts.system,
      tools: opts.tools.map(t => t.definition),
      messages: currentMessages,
      stream: true,
    }
    if (supportsThinking) createParams.thinking = { type: "enabled", budget_tokens: 8000 }

    const stream = await client.messages.create(createParams)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contentBlocks: any[] = []
    let stopReason = ""
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let currentBlock: any = null

    for await (const event of stream as unknown as AsyncIterable<{ type: string; [k: string]: unknown }>) {
      if (event.type === "content_block_start") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cb = event.content_block as any
        currentBlock = cb.type === "tool_use" ? { ...cb, input: "" } : cb
        if (cb.type === "tool_use") yield { type: "tool_use", name: cb.name, id: cb.id }
      } else if (event.type === "content_block_delta") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const delta = event.delta as any
        if (delta.type === "text_delta") {
          yield { type: "text_delta", text: delta.text }
          if (currentBlock) currentBlock = { ...currentBlock, text: (currentBlock.text ?? "") + delta.text }
        } else if (delta.type === "thinking_delta") {
          yield { type: "thinking_delta", text: delta.thinking }
          if (currentBlock) currentBlock = { ...currentBlock, thinking: (currentBlock.thinking ?? "") + delta.thinking }
        } else if (delta.type === "input_json_delta") {
          if (currentBlock) currentBlock = { ...currentBlock, input: (currentBlock.input ?? "") + delta.partial_json }
        }
      } else if (event.type === "content_block_stop") {
        if (currentBlock) {
          if (currentBlock.type === "tool_use" && typeof currentBlock.input === "string") {
            try { currentBlock.input = JSON.parse(currentBlock.input) } catch { currentBlock.input = {} }
          }
          contentBlocks.push(currentBlock)
        }
        currentBlock = null
      } else if (event.type === "message_delta") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        stopReason = (event.delta as any)?.stop_reason ?? ""
      }
    }

    if (stopReason !== "tool_use") break

    const toolUseBlocks = contentBlocks.filter(b => b.type === "tool_use")
    if (toolUseBlocks.length === 0) break

    const toolResults: Array<{ type: "tool_result"; tool_use_id: string; content: string }> = []
    for (const tb of toolUseBlocks) {
      const handler = opts.tools.find(t => t.definition.name === tb.name)?.handler
      let content: string
      try {
        content = handler ? await handler(tb.input as Record<string, unknown>) : `Unknown tool: ${tb.name}`
      } catch (err) {
        content = `Error: ${err instanceof Error ? err.message : String(err)}`
      }
      const interrupt = parseInterrupt(content)
      if (interrupt) {
        if ('__entityForm' in interrupt) {
          yield { type: "entity_form", entityType: interrupt.entityType, prefilled: interrupt.prefilled }
        } else {
          yield { type: "choice_form", question: interrupt.question, options: interrupt.options, multiple: interrupt.multiple }
        }
        content = interrupt.__aiMessage
      }
      yield { type: "tool_result" as const, name: tb.name, id: tb.id, result: content }
      toolResults.push({ type: "tool_result", tool_use_id: tb.id, content })
    }

    currentMessages = [
      ...currentMessages,
      { role: "assistant", content: contentBlocks },
      { role: "user", content: toolResults },
    ]
  }
}

// ─── OpenAI (streaming) ───────────────────────────────────────────────────────

async function* runOpenAIChat(opts: RunChatOptions): AsyncGenerator<ChatEvent> {
  const OpenAI = (await import("openai")).default
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const tools = opts.tools.length > 0
    ? opts.tools.map(t => ({
        type: "function" as const,
        function: {
          name: t.definition.name,
          description: t.definition.description,
          parameters: t.definition.input_schema,
        },
      }))
    : undefined

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let messages: any[] = [
    { role: "system", content: opts.system },
    ...opts.messages.map(m => ({ role: m.role, content: m.content })),
  ]

  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = await client.chat.completions.create({ model: opts.model.model, messages, ...(tools ? { tools } : {}), stream: true } as any)

    let finishReason = ""
    const toolCallMap: Record<number, { id: string; name: string; args: string }> = {}
    let assistantContent = ""

    for await (const chunk of stream as unknown as AsyncIterable<any>) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const delta = (chunk as any).choices?.[0]?.delta
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      finishReason = (chunk as any).choices?.[0]?.finish_reason ?? finishReason

      if (delta?.content) {
        yield { type: "text_delta", text: delta.content }
        assistantContent += delta.content
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0
          if (!toolCallMap[idx]) {
            toolCallMap[idx] = { id: tc.id ?? "", name: tc.function?.name ?? "", args: "" }
            if (tc.function?.name) yield { type: "tool_use", name: tc.function.name, id: tc.id ?? "" }
          }
          if (tc.function?.arguments) toolCallMap[idx].args += tc.function.arguments
          if (tc.function?.name && !toolCallMap[idx].name) toolCallMap[idx].name = tc.function.name
          if (tc.id && !toolCallMap[idx].id) toolCallMap[idx].id = tc.id
        }
      }
    }

    const toolCalls = Object.values(toolCallMap)
    if (finishReason !== "tool_calls" || toolCalls.length === 0) break

    messages = [
      ...messages,
      {
        role: "assistant",
        content: assistantContent || null,
        tool_calls: toolCalls.map(tc => ({
          id: tc.id, type: "function", function: { name: tc.name, arguments: tc.args },
        })),
      },
    ]

    const openaiToolResults: Array<{ role: "tool"; tool_call_id: string; content: string }> = []
    for (const tc of toolCalls) {
      const handler = opts.tools.find(t => t.definition.name === tc.name)?.handler
      let content: string
      try {
        content = handler ? await handler(JSON.parse(tc.args || "{}")) : `Unknown tool: ${tc.name}`
      } catch (err) {
        content = `Error: ${err instanceof Error ? err.message : String(err)}`
      }
      const interrupt = parseInterrupt(content)
      if (interrupt) {
        if ('__entityForm' in interrupt) {
          yield { type: "entity_form", entityType: interrupt.entityType, prefilled: interrupt.prefilled }
        } else {
          yield { type: "choice_form", question: interrupt.question, options: interrupt.options, multiple: interrupt.multiple }
        }
        content = interrupt.__aiMessage
      }
      yield { type: "tool_result" as const, name: tc.name, id: tc.id, result: content }
      openaiToolResults.push({ role: "tool", tool_call_id: tc.id, content })
    }

    messages = [...messages, ...openaiToolResults]
  }
}

// ─── Gemini (streaming) ───────────────────────────────────────────────────────

async function* runGeminiChat(opts: RunChatOptions): AsyncGenerator<ChatEvent> {
  const { GoogleGenAI } = await import("@google/genai")
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

  const tools = opts.tools.length > 0
    ? [{ functionDeclarations: opts.tools.map(t => ({ name: t.definition.name, description: t.definition.description, parameters: t.definition.input_schema })) }]
    : undefined

  const history = opts.messages.slice(0, -1).map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }))

  const lastMessage = opts.messages[opts.messages.length - 1]
  const chat = client.chats.create({
    model: opts.model.model,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: { systemInstruction: opts.system, ...(tools ? { tools } : {}) } as any,
    history,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let currentParts: any[] = [{ text: lastMessage?.content ?? "" }]

  while (true) {
    const stream = await chat.sendMessageStream({ message: currentParts })
    const functionCalls: Array<{ name: string; args: Record<string, unknown> }> = []

    for await (const chunk of stream) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parts = (chunk as any).candidates?.[0]?.content?.parts
      if (!parts) continue
      for (const part of parts) {
        if (part.text) {
          yield { type: "text_delta", text: part.text }
        } else if (part.functionCall) {
          yield { type: "tool_use", name: part.functionCall.name, id: part.functionCall.name + "_" + Date.now() }
          functionCalls.push({ name: part.functionCall.name, args: part.functionCall.args ?? {} })
        }
      }
    }

    if (functionCalls.length === 0) break

    const geminiParts: unknown[] = []
    for (const fc of functionCalls) {
      const handler = opts.tools.find(t => t.definition.name === fc.name)?.handler
      let result: unknown
      let rawResult: string
      try {
        rawResult = handler ? await handler(fc.args) : JSON.stringify({ error: `Unknown tool: ${fc.name}` })
        result = JSON.parse(rawResult)
      } catch (err) {
        rawResult = err instanceof Error ? err.message : String(err)
        result = { error: rawResult }
      }
      const formPayload = parseEntityForm(rawResult)
      if (formPayload) {
        yield { type: "entity_form", entityType: formPayload.entityType, prefilled: formPayload.prefilled }
        rawResult = formPayload.__aiMessage
        result = { message: rawResult }
      }
      yield { type: "tool_result" as const, name: fc.name, id: fc.name + "_result", result: rawResult }
      geminiParts.push({ functionResponse: { name: fc.name, response: result } })
    }
    currentParts = geminiParts
  }
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export async function* runChat(opts: RunChatOptions): AsyncGenerator<ChatEvent> {
  switch (opts.model.provider) {
    case "anthropic": yield* runAnthropicChat(opts); break
    case "openai":    yield* runOpenAIChat(opts);    break
    case "gemini":    yield* runGeminiChat(opts);    break
    default:
      yield { type: "error", message: `Unknown provider: ${(opts.model as ModelConfig).provider}` }
  }
}
