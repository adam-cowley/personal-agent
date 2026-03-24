/**
 * Server-side conversation history store.
 *
 * Keyed by session ID (UUID generated client-side, stored in sessionStorage).
 * Each session holds the full multi-turn message history including tool call
 * exchanges so the client only needs to send the latest user message.
 *
 * NOTE: In-memory store — resets on server restart. Fine for local dev.
 * For production persistence, replace with Redis or a DB-backed store.
 */

export interface HistoryMessage {
  role: "user" | "assistant"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: string | any[] // string for simple text, array for tool-call turns
}

interface Session {
  history: HistoryMessage[]
  updatedAt: number
}

const store = new Map<string, Session>()

// Prune sessions older than 24 h every hour
setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000
  for (const [id, s] of store) {
    if (s.updatedAt < cutoff) store.delete(id)
  }
}, 60 * 60 * 1000)

export function getHistory(sessionId: string): HistoryMessage[] {
  return store.get(sessionId)?.history ?? []
}

export function appendHistory(sessionId: string, messages: HistoryMessage[]) {
  const existing = store.get(sessionId)?.history ?? []
  store.set(sessionId, {
    history: [...existing, ...messages],
    updatedAt: Date.now(),
  })
}

export function clearHistory(sessionId: string) {
  store.delete(sessionId)
}
