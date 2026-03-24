# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # Start Next.js dev server (http://localhost:3000)
npm run build         # Production build
npm run lint          # ESLint

# Database
npm run db:setup      # Create Neo4j constraints and full-text indexes
npm run db:seed       # Setup schema + load demo data (people, projects, tasks)

# CLI / digests
npm run digest:daily  # Generate and save a daily digest
npm run digest:weekly # Generate and save a weekly digest
npm run scheduler     # Start background cron scheduler (keeps process alive)

# Raw CLI
npm run cli -- <command>
```

Run a Neo4j instance locally with Docker:
```bash
docker run -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=neo4j/password neo4j:latest
```

## Architecture

**Stack:** Next.js 16 (App Router) · TypeScript · shadcn/ui (Tailwind v4) · Neo4j · Anthropic Claude

**Mobile-first layout:** The app is constrained to `max-w-md` (centered, border-x) to work as a narrow window or macOS menu bar popup. `AppShell` (`src/components/layout/AppShell.tsx`) wraps every page with a compact top nav.

---

## Adding a New Graph Entity Type

Everything lives in `config/graph.yaml`. No TypeScript changes needed.

Add a new node to the `nodes:` section:

```yaml
nodes:
  Company:
    labels:
      - company
    properties:
      id:
        type: STRING
        nullable: false
        unique: true
      name:
        type: STRING
        nullable: false
      industry:
        type: STRING
      website:
        type: STRING
    indexes:
      company_search:
        type: FULLTEXT
        label: company
        properties:
          - name
    extensions:
      reasoningHint: "Companies are organisations that people work for or collaborate with."
      ui:
        label: Company
        plural: Companies
        _icon: Building          # Must be a key in src/lib/spec/icon-map.ts
        displayName: name
        displaySub: industry
        fields:
          - key: name
            label: Name
            type: text
            required: true
            placeholder: "Company name"
          - key: industry
            label: Industry
            type: text
          - key: website
            label: Website
            type: email
```

Add any relationships in the `relationships:` section:

```yaml
relationships:
  worksAt:
    type: WORKS_AT
    from: Person
    to: Company
    extensions:
      outMinCardinality: 0
      outMaxCardinality: many
```

To add a relation field (e.g. "company" on Person pointing to a Company node), add a field of `type: relation` and reference the relationship id:

```yaml
      # Inside Person node's ui.fields:
      - key: companyId
        label: Company
        type: relation
        endpoint: /api/entities/company
        labelKey: name
        valueKey: id
        relationship: worksAt
```

**Icon names** are mapped in `src/lib/spec/icon-map.ts`. Add new Lucide icons there if needed.

After editing `graph.yaml`, restart the dev server (YAML is cached at startup).

---

## Adding a New Persona

Each persona is a single YAML file in `config/personas/`. Create `config/personas/<id>.yaml`:

```yaml
id: warren-buffett
name: Warren Buffett
description: "Get investment and business wisdom from the Oracle of Omaha"
category: persona          # default | persona | coach | panel
mbti: ISTJ
enneagram: "6"
provider: anthropic        # anthropic | openai | gemini
model: claude-sonnet-4-6   # any model supported by the provider
welcomeMessage: "Tell me about the business. I want to understand the economics first."
instructions: |
  You are Warren Buffett. You think in decades, not quarters.

  When evaluating any idea or business:
  - Ask about the moat: what keeps competitors out in 10 years?
  - Focus on unit economics and return on invested capital
  - Be sceptical of complexity — if you can't explain it simply, it's probably not a good investment
  - Value patience and inaction over constant activity
  - Reference your actual mental models: circle of competence, Mr Market, margin of safety

  Speak plainly. Use folksy analogies. Be direct about when something is outside your circle.
```

**Field reference:**
- `id` — used in URLs and code; must be unique and URL-safe
- `category` — controls grouping in the PersonaSelector UI
- `provider` / `model` — this persona uses its own LLM instance
- `requiresMbtiTarget: true` — triggers the MBTI picker before activation
- `{{mbtiTargetContext}}` / `{{peopleContext}}` — placeholders in `instructions` that get runtime context injected

Restart the dev server after adding a persona file.

---

## Group Conversations

`POST /api/group-chat` — multiple personas respond in turn, each using their own configured LLM. The UI exposes this via the "Group conversation" tab in PersonaSelector.

Each persona sees the full conversation thread including previous personas' responses in the same turn.

---

## Skills Pattern

Skills are the core extension point. Each skill is a self-contained module in `src/skills/<name>/`:

```
src/skills/
  people/
    index.ts     ← exports a `Skill` object with tool definitions + handlers
    queries.ts   ← Neo4j Cypher queries for this domain
  projects/      ← same structure
  tasks/         ← same structure
  digest/        ← same structure (also calls Claude internally)
```

**To add a new skill:**
1. Create `src/skills/<name>/index.ts` exporting a `Skill` (see `src/lib/skills/types.ts`)
2. Create `src/skills/<name>/queries.ts` with Neo4j queries
3. Register in `src/lib/skills/registry.ts`

Skills are automatically exposed as Claude tools in the chat API. Claude decides which tools to call; the agentic loop in `src/app/api/chat/route.ts` handles multi-turn tool use.

---

## Chat History

`src/lib/chat/neo4j-sessions.ts` — persists chat messages to Neo4j `Chat` and `Message` nodes. Each message is optionally embedded (OpenAI `text-embedding-3-small`, 1536 dims) for vector search. Falls back to substring search if no OpenAI key or vector index.

APIs: `GET /api/chats`, `GET /api/chats/[chatId]`, `GET /api/chats/search?q=...`

The `ChatHistory` component (`src/components/chat/ChatHistory.tsx`) provides a bottom-sheet history browser with debounced semantic search.

---

## Graph Schema

**Source of truth:** `config/graph.yaml`

Application nodes: `Person`, `Project`, `Task`
System nodes (not in graph.yaml): `Digest`, `Chat`, `Message`

Relationships defined in graph.yaml:
- `(Person)-[:WORKS_ON]->(Project)`
- `(Person)-[:ASSIGNED_TO]->(Task)`
- `(Task)-[:PART_OF]->(Project)`
- `(Person)-[:KNOWS]->(Person)`

Full-text indexes: defined per-node in graph.yaml, set up via `npm run db:setup`
Vector index: `message_embedding` (1536 dims, cosine similarity) — requires `db:setup`

Schema setup is in `src/lib/neo4j/schema.ts`. Run `npm run db:setup` once before first use.

---

## Chat / Agentic Loop

`POST /api/chat` (`src/app/api/chat/route.ts`) runs a multi-turn agentic loop:
1. Resolve persona from `personaId` → load provider/model/instructions from `config/personas/*.yaml`
2. Send user messages + all skill tool definitions to the persona's LLM
3. If the model calls tools → execute in parallel via skill handlers → append results → loop
4. Stream text blocks and tool_use events as SSE (`data: {type, ...}`)
5. Stop when `stop_reason !== 'tool_use'`

The `ChatWindow` component (`src/components/chat/ChatWindow.tsx`) consumes the SSE stream and renders tool badges alongside assistant messages.

---

## Adding shadcn Components

Always use the CLI — never install component files directly:
```bash
npx shadcn@latest add <component-name>
```

---

## CLI & Scheduler

`src/cli/index.ts` — thin command dispatcher, run with `npm run cli -- <command>`
`src/cli/scheduler.ts` — `node-cron` schedules for daily/weekly digests; import `startScheduler()` to embed in a custom Next.js server or run standalone with `npm run scheduler`
