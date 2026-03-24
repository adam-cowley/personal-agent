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

### Skills Pattern

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

### Modes System

`src/modes/` — prompt-based lenses that change how Elsie responds. Each `Mode` in `src/modes/registry.ts` has a `buildSystemPrompt(people)` method.

Built-in modes: `default` (Elsie), `steve-jobs`, `socratic`, `devils-advocate`, `mbti-coach`, `board` (Virtual Board of Directors — requires selecting people).

The chat API accepts `modeId` and `personIds[]` in the POST body. For board mode, selected people's name/role/notes are injected into the system prompt.

To add a mode: create a file in `src/modes/builtin/`, add it to `src/modes/registry.ts`.

### Chat History

`src/lib/chat/neo4j-sessions.ts` — persists chat messages to Neo4j `Chat` and `Message` nodes. Each message is optionally embedded (OpenAI `text-embedding-3-small`, 1536 dims) for vector search. Falls back to substring search if no OpenAI key or vector index.

APIs: `GET /api/chats`, `GET /api/chats/[chatId]`, `GET /api/chats/search?q=...`

The `ChatHistory` component (`src/components/chat/ChatHistory.tsx`) provides a bottom-sheet history browser with debounced semantic search.

### Graph Schema

Nodes: `Person`, `Project`, `Task`, `Note`, `Digest`, `Chat`, `Message`

Key relationships:
- `(Person)-[:WORKS_ON]->(Project)`
- `(Person)-[:ASSIGNED_TO]->(Task)`
- `(Task)-[:PART_OF]->(Project)`
- `(Person)-[:KNOWS]->(Person)`
- `(Chat)-[:HAS_MESSAGE]->(Message)`

Full-text indexes: `person_search`, `project_search`, `task_search`
Vector index: `message_embedding` (1536 dims, cosine similarity) — requires `db:setup`

Schema setup is in `src/lib/neo4j/schema.ts`. Run `npm run db:setup` once before first use.

### Chat / Agentic Loop

`POST /api/chat` (`src/app/api/chat/route.ts`) runs a multi-turn agentic loop:
1. Send user messages + all skill tool definitions to Claude
2. If Claude calls tools → execute in parallel via skill handlers → append results → loop
3. Stream text blocks and tool_use events as SSE (`data: {type, ...}`)
4. Stop when `stop_reason !== 'tool_use'`

The `ChatWindow` component (`src/components/chat/ChatWindow.tsx`) consumes the SSE stream and renders tool badges alongside assistant messages.

### Adding shadcn Components

Always use the CLI — never install component files directly:
```bash
npx shadcn@latest add <component-name>
```

### Entity UI Components

Card components in `src/components/entities/` (PersonCard, ProjectCard, TaskCard) are intentionally simple. Clone them to create new entity types — they follow the same pattern: receive plain data props, render with shadcn Card + Badge.

### CLI & Scheduler

`src/cli/index.ts` — thin command dispatcher, run with `npm run cli -- <command>`
`src/cli/scheduler.ts` — `node-cron` schedules for daily/weekly digests; import `startScheduler()` to embed in a custom Next.js server or run standalone with `npm run scheduler`
