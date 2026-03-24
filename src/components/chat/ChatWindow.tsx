"use client"

import { useEffect, useRef, useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageBubble, type Message } from "./MessageBubble"
import { ChatInput } from "./ChatInput"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { EntityDialog } from "@/components/entity/EntityDialog"
import { makeEntityDef } from "@/entities/client-config"
import type { ClientEntityConfig } from "@/entities/client-config"
import { PersonaSelector } from "./PersonaSelector"
import { ChatHistory } from "./ChatHistory"
import { ChoiceForm } from "./ChoiceForm"
import type { Persona } from "@/modes/types"

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID()
  return Math.random().toString(36).slice(2)
}

const SESSION_KEY = "elsie-chat-id"
const DEFAULT_PERSONA_ID = "elsie"

function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY)
  if (!id) { id = uid(); localStorage.setItem(SESSION_KEY, id) }
  return id
}

/** Properly buffered SSE line reader — handles chunk boundaries */
async function* readSSE(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buf = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split("\n")
    buf = lines.pop() ?? ""
    for (const line of lines) {
      if (line.startsWith("data: ")) yield line.slice(6)
    }
  }
  if (buf.startsWith("data: ")) yield buf.slice(6)
}

export function ChatWindow() {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [entityConfigs, setEntityConfigs] = useState<ClientEntityConfig[]>([])
  const [selectedPersonaId, setSelectedPersonaId] = useState(DEFAULT_PERSONA_ID)
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [isGroupMode, setIsGroupMode] = useState(false)
  const [modeContext, setModeContext] = useState<Record<string, unknown>>({})

  const [messages, setMessages] = useState<Message[]>([
    { id: uid(), role: "assistant", content: "Hi! I'm Elsie, your business coach. What would you like to work on?" },
  ])
  const [loading, setLoading] = useState(false)
  const [entityForm, setEntityForm] = useState<{
    entityType: string
    prefilled: Record<string, unknown>
  } | null>(null)
  const [choiceForm, setChoiceForm] = useState<{
    question: string
    options: Array<{ id: string; label: string; description?: string }>
    multiple: boolean
  } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const sessionId = useRef<string>("")
  const entitySavedRef = useRef<{ type: string; item: Record<string, unknown> } | null>(null)

  // Load spec (personas + entity configs) from API
  useEffect(() => {
    fetch("/api/spec")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.personas) setPersonas(data.personas)
        if (data?.entities) setEntityConfigs(data.entities)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    sessionId.current = getSessionId()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // ── Single persona chat ────────────────────────────────────────────────────

  async function sendSingleMessage(text: string) {
    const userMsg: Message = { id: uid(), role: "user", content: text }
    const assistantId = uid()
    const assistantMsg: Message = {
      id: assistantId, role: "assistant", content: "", thinking: "", isStreaming: true, isThinking: false,
    }
    setMessages(prev => [...prev, userMsg, assistantMsg])
    setLoading(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId.current,
          message: text,
          personaId: selectedPersonaId,
          modeContext,
        }),
      })
      if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`)

      let textAcc = ""
      let thinkingAcc = ""
      const toolsUsed: string[] = []

      for await (const raw of readSSE(res.body!)) {
        if (raw === "[DONE]") break
        try {
          const event = JSON.parse(raw)
          if (event.type === "text_delta" && event.text) {
            textAcc += event.text
            setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: textAcc, isThinking: false } : m))
          } else if (event.type === "thinking_delta" && event.text) {
            thinkingAcc += event.text
            setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, thinking: thinkingAcc, isThinking: true } : m))
          } else if (event.type === "tool_use" && event.name) {
            if (!toolsUsed.includes(event.name)) toolsUsed.push(event.name)
            setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, toolsUsed: [...toolsUsed] } : m))
          } else if (event.type === "tool_result" && event.name && event.result !== undefined) {
            setMessages(prev => prev.map(m => m.id === assistantId
              ? { ...m, toolResults: { ...(m.toolResults ?? {}), [event.name!]: event.result! } }
              : m
            ))
          } else if (event.type === "entity_form" && event.entityType && event.prefilled) {
            setEntityForm({ entityType: event.entityType, prefilled: event.prefilled })
          } else if (event.type === "choice_form" && event.question && event.options) {
            setChoiceForm({ question: event.question, options: event.options, multiple: event.multiple ?? false })
          } else if (event.type === "error") {
            throw new Error(event.message ?? "Unknown error")
          }
        } catch (e) {
          if (e instanceof SyntaxError) continue
          throw e
        }
      }

      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, isStreaming: false, isThinking: false, toolsUsed } : m
      ))
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong"
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: `Error: ${msg}`, isStreaming: false, isThinking: false } : m
      ))
    } finally {
      setLoading(false)
    }
  }

  // ── Follow-up after entity form (no user bubble) ──────────────────────────

  async function sendFollowUp(text: string) {
    const assistantId = uid()
    setMessages(prev => [...prev, {
      id: assistantId, role: "assistant", content: "", isStreaming: true, isThinking: false,
    }])
    setLoading(true)
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId.current, message: text, personaId: selectedPersonaId, modeContext }),
      })
      if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`)
      let textAcc = ""
      for await (const raw of readSSE(res.body!)) {
        if (raw === "[DONE]") break
        try {
          const event = JSON.parse(raw)
          if (event.type === "text_delta" && event.text) {
            textAcc += event.text
            setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: textAcc, isThinking: false } : m))
          } else if (event.type === "error") {
            throw new Error(event.message ?? "Unknown error")
          }
        } catch (e) { if (e instanceof SyntaxError) continue; throw e }
      }
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, isStreaming: false } : m))
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong"
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: `Error: ${msg}`, isStreaming: false } : m))
    } finally {
      setLoading(false)
    }
  }

  // ── Group chat ─────────────────────────────────────────────────────────────

  async function sendGroupMessage(text: string) {
    const userMsg: Message = { id: uid(), role: "user", content: text }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    // Track one message bubble per persona in this turn
    const turnMessageIds: Record<string, string> = {}
    let currentTurnPersonaId: string | null = null

    try {
      const res = await fetch("/api/group-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId.current,
          message: text,
          personaIds: selectedGroupIds,
          modeContext,
        }),
      })
      if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`)

      for await (const raw of readSSE(res.body!)) {
        if (raw === "[DONE]") break
        try {
          const event = JSON.parse(raw)
          if (event.type === "turn_start") {
            const msgId = uid()
            turnMessageIds[event.personaId] = msgId
            currentTurnPersonaId = event.personaId
            const newMsg: Message = {
              id: msgId,
              role: "assistant",
              content: "",
              isStreaming: true,
              personaId: event.personaId,
              personaName: event.name,
            }
            setMessages(prev => [...prev, newMsg])
          } else if (event.type === "text_delta" && event.text) {
            const activeId = currentTurnPersonaId ? turnMessageIds[currentTurnPersonaId] : null
            if (activeId) {
              setMessages(prev => prev.map(m =>
                m.id === activeId ? { ...m, content: m.content + event.text } : m
              ))
            }
          } else if (event.type === "turn_end") {
            const msgId = turnMessageIds[event.personaId]
            if (msgId) {
              setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isStreaming: false } : m))
            }
            currentTurnPersonaId = null
          } else if (event.type === "tool_use" && event.name) {
            const activeId = currentTurnPersonaId ? turnMessageIds[currentTurnPersonaId] : null
            if (activeId) {
              setMessages(prev => prev.map(m => {
                if (m.id !== activeId) return m
                const toolsUsed = m.toolsUsed ?? []
                return !toolsUsed.includes(event.name!)
                  ? { ...m, toolsUsed: [...toolsUsed, event.name!] }
                  : m
              }))
            }
          } else if (event.type === "error") {
            throw new Error(event.message ?? "Unknown error")
          }
        } catch (e) {
          if (e instanceof SyntaxError) continue
          throw e
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong"
      setMessages(prev => [...prev, {
        id: uid(), role: "assistant", content: `Error: ${msg}`,
      }])
    } finally {
      setLoading(false)
    }
  }

  function sendMessage(text: string) {
    if (isGroupMode) sendGroupMessage(text)
    else sendSingleMessage(text)
  }

  // ── Persona selection ──────────────────────────────────────────────────────

  function handlePersonaSelect(personaId: string, ctx: Record<string, unknown> = {}) {
    const persona = personas.find(p => p.id === personaId)
    setSelectedPersonaId(personaId)
    setIsGroupMode(false)
    setSelectedGroupIds([])
    setModeContext(ctx)
    if (persona) {
      setMessages([{ id: uid(), role: "assistant", content: persona.welcomeMessage }])
      newSession()
    }
  }

  function handleGroupSelect(personaIds: string[]) {
    setSelectedGroupIds(personaIds)
    setIsGroupMode(true)
    setModeContext({})
    const names = personaIds
      .map(id => personas.find(p => p.id === id)?.name)
      .filter(Boolean)
      .join(", ")
    setMessages([{
      id: uid(),
      role: "assistant",
      content: `Group conversation started with: ${names}. What would you like to discuss?`,
    }])
    newSession()
  }

  function newSession() {
    const newId = uid()
    localStorage.setItem(SESSION_KEY, newId)
    sessionId.current = newId
  }

  function loadChat(chatId: string, msgs: Array<{ role: "user" | "assistant"; content: string; id: string }>) {
    localStorage.setItem(SESSION_KEY, chatId)
    sessionId.current = chatId
    const displayMsgs = msgs.map(m => ({ id: m.id ?? uid(), role: m.role, content: m.content }))
    setMessages(displayMsgs.length > 0 ? displayMsgs : [{ id: uid(), role: "assistant", content: "Continuing this conversation…" }])
    setSelectedPersonaId(DEFAULT_PERSONA_ID)
    setIsGroupMode(false)
    setSelectedGroupIds([])
  }

  async function clearChat() {
    await fetch("/api/chat", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sessionId.current }),
    })
    newSession()
    setMessages([{ id: uid(), role: "assistant", content: "Chat cleared. How can I help you?" }])
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b px-3 py-1.5 bg-muted/20">
        <PersonaSelector
          personas={personas}
          selectedPersonaId={selectedPersonaId}
          selectedGroupIds={selectedGroupIds}
          isGroupMode={isGroupMode}
          onSelect={handlePersonaSelect}
          onGroupSelect={handleGroupSelect}
        />
        <div className="flex items-center gap-1">
          <ChatHistory currentChatId={sessionId.current} onLoadChat={loadChat} />
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={clearChat}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-muted"
                  aria-label="Clear chat"
                />
              }
            >
              <Trash2 className="size-4" />
            </TooltipTrigger>
            <TooltipContent>Clear chat</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="py-3">
          {messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {choiceForm && !loading && (
            <ChoiceForm
              question={choiceForm.question}
              options={choiceForm.options}
              multiple={choiceForm.multiple}
              onSubmit={(answer) => {
                setChoiceForm(null)
                sendMessage(answer)
              }}
            />
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <ChatInput onSend={sendMessage} disabled={loading} />

      {entityForm && (() => {
        const config = entityConfigs.find(e => e.type.toLowerCase() === entityForm.entityType.toLowerCase())
        if (!config) return null
        const entity = makeEntityDef(config)
        const entityType = entityForm.entityType
        return (
          <EntityDialog
            entity={entity}
            initial={entityForm.prefilled}
            open={true}
            onSaved={(item) => { entitySavedRef.current = { type: entityType, item } }}
            onClose={() => {
              const saved = entitySavedRef.current
              entitySavedRef.current = null
              setEntityForm(null)
              if (saved) {
                sendFollowUp(`[System: The ${saved.type} form was submitted and the record was saved. Details: ${JSON.stringify(saved.item)}]`)
              } else {
                sendFollowUp(`[System: The user cancelled the ${entityType} form without saving.]`)
              }
            }}
          />
        )
      })()}
    </div>
  )
}
