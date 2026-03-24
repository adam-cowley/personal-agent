/**
 * Neo4j-backed chat persistence.
 *
 * Chat nodes:   { id, title, modeId, createdAt, updatedAt }
 * Message nodes:{ id, chatId, role, content, createdAt }
 * Relationship: (Chat)-[:HAS_MESSAGE]->(Message)
 *
 * Messages with vector embeddings are searchable via the message_embedding
 * vector index (created by db:setup). Falls back gracefully when the index
 * or OpenAI key is not available.
 */

import { randomUUID } from "crypto"
import { runQuery } from "@/lib/neo4j/client"
import { embed } from "./embeddings"

export interface StoredMessage {
  id: string
  role: "user" | "assistant"
  content: string
  createdAt: string
}

export interface ChatSummary {
  id: string
  title: string
  modeId: string
  createdAt: string
  updatedAt: string
  messageCount: number
}

export interface SearchResult {
  chatId: string
  chatTitle: string
  messageId: string
  role: string
  content: string
  score: number
  createdAt: string
}

/** Ensure a Chat node exists for this session. */
export async function ensureChat(sessionId: string, title?: string, modeId = "default") {
  await runQuery(`
    MERGE (c:Chat {id: $id})
    ON CREATE SET c.title = $title, c.modeId = $modeId, c.createdAt = datetime(), c.updatedAt = datetime()
    ON MATCH  SET c.updatedAt = datetime()
  `, { id: sessionId, title: title ?? "New conversation", modeId })
}

/** Persist user/assistant text messages to Neo4j with optional embeddings. */
export async function persistMessages(
  sessionId: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  modeId = "default"
) {
  if (messages.length === 0) return
  // Ensure chat exists — title = first user message
  const firstUser = messages.find(m => m.role === "user")
  const title = firstUser
    ? firstUser.content.slice(0, 60) + (firstUser.content.length > 60 ? "…" : "")
    : undefined
  await ensureChat(sessionId, title, modeId)

  for (const msg of messages) {
    const id = randomUUID()
    const embedding = typeof msg.content === "string" ? await embed(msg.content) : null

    if (embedding) {
      await runQuery(`
        MATCH (c:Chat {id: $chatId})
        CREATE (m:Message {id: $id, role: $role, content: $content, embedding: $embedding, createdAt: datetime()})
        CREATE (c)-[:HAS_MESSAGE]->(m)
      `, { chatId: sessionId, id, role: msg.role, content: msg.content, embedding })
    } else {
      await runQuery(`
        MATCH (c:Chat {id: $chatId})
        CREATE (m:Message {id: $id, role: $role, content: $content, createdAt: datetime()})
        CREATE (c)-[:HAS_MESSAGE]->(m)
      `, { chatId: sessionId, id, role: msg.role, content: msg.content })
    }
  }

  // Update chat's updatedAt
  await runQuery(`MATCH (c:Chat {id: $id}) SET c.updatedAt = datetime()`, { id: sessionId })
}

/** List all chats ordered by most recent activity. */
export async function listChats(): Promise<ChatSummary[]> {
  const rows = await runQuery<{
    id: string; title: string; modeId: string
    createdAt: unknown; updatedAt: unknown; messageCount: number
  }>(`
    MATCH (c:Chat)
    OPTIONAL MATCH (c)-[:HAS_MESSAGE]->(m:Message)
    RETURN c.id AS id, c.title AS title, c.modeId AS modeId,
           c.createdAt AS createdAt, c.updatedAt AS updatedAt,
           count(m) AS messageCount
    ORDER BY c.updatedAt DESC
    LIMIT 100
  `)
  return rows.map(r => ({
    ...r,
    createdAt: String(r.createdAt ?? ""),
    updatedAt: String(r.updatedAt ?? ""),
  }))
}

/** Get all messages for a chat, ordered chronologically. */
export async function getChatMessages(chatId: string): Promise<StoredMessage[]> {
  const rows = await runQuery<{
    id: string; role: string; content: string; createdAt: unknown
  }>(`
    MATCH (c:Chat {id: $chatId})-[:HAS_MESSAGE]->(m:Message)
    RETURN m.id AS id, m.role AS role, m.content AS content, m.createdAt AS createdAt
    ORDER BY m.createdAt ASC
  `, { chatId })
  return rows.map(r => ({
    ...r,
    role: r.role as "user" | "assistant",
    createdAt: String(r.createdAt ?? ""),
  }))
}

/** Semantic search over messages using vector index, with full-text fallback. */
export async function searchMessages(query: string, limit = 10): Promise<SearchResult[]> {
  const queryEmbedding = await embed(query)

  if (queryEmbedding) {
    try {
      const rows = await runQuery<{
        chatId: string; chatTitle: string; messageId: string
        role: string; content: string; score: number; createdAt: unknown
      }>(`
        CALL db.index.vector.queryNodes('message_embedding', $limit, $embedding)
        YIELD node AS m, score
        MATCH (c:Chat)-[:HAS_MESSAGE]->(m)
        RETURN c.id AS chatId, c.title AS chatTitle,
               m.id AS messageId, m.role AS role, m.content AS content,
               score, m.createdAt AS createdAt
        ORDER BY score DESC
      `, { limit, embedding: queryEmbedding })
      if (rows.length > 0) return rows.map(r => ({ ...r, createdAt: String(r.createdAt ?? "") }))
    } catch {
      // Vector index not available — fall through to text search
    }
  }

  // Full-text fallback
  const rows = await runQuery<{
    chatId: string; chatTitle: string; messageId: string
    role: string; content: string; createdAt: unknown
  }>(`
    MATCH (c:Chat)-[:HAS_MESSAGE]->(m:Message)
    WHERE toLower(m.content) CONTAINS toLower($query)
    RETURN c.id AS chatId, c.title AS chatTitle,
           m.id AS messageId, m.role AS role, m.content AS content,
           m.createdAt AS createdAt
    ORDER BY m.createdAt DESC
    LIMIT $limit
  `, { query, limit })

  return rows.map(r => ({ ...r, score: 1, createdAt: String(r.createdAt ?? "") }))
}

/** Delete all messages for a chat (clear history). */
export async function deleteChatMessages(chatId: string) {
  await runQuery(`
    MATCH (c:Chat {id: $chatId})-[:HAS_MESSAGE]->(m:Message)
    DETACH DELETE m
  `, { chatId })
}
