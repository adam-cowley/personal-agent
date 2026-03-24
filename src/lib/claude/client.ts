import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null

export function getAnthropicClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return client
}

export function buildSystemPrompt(entityContext: string): string {
  return `You are Elsie, a personal business coach and assistant. You help users manage their professional relationships, projects, and tasks using a knowledge graph stored in Neo4j.

You have access to tools that let you read and write to the graph. Use them proactively to answer questions, create and update records, and surface insights.

${entityContext}

When responding:
- Be concise and actionable
- Proactively surface relevant connections between entities
- Ask clarifying questions when intent is ambiguous
- Format lists and structured data clearly
- When you create or update entities, confirm what was done`
}

// Fallback for places that haven't been updated yet
export const SYSTEM_PROMPT = buildSystemPrompt("")
