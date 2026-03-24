# Elsie

A personal AI assistant with a Neo4j knowledge graph backend. Chat with multiple AI personas, manage people/projects/tasks, and generate digests — all driven by YAML configuration with no code changes required for common extensions.

## Stack

- **Next.js 16** (App Router) — frontend and API routes
- **Neo4j** — graph database for entities, relationships, chat history, and embeddings
- **Anthropic Claude / OpenAI / Gemini** — multi-provider LLM support, one per persona
- **shadcn/ui** (Tailwind v4, @base-ui/react) — component library
- **TypeScript** throughout

---

## Quick Start

### 1. Prerequisites

- Node.js 20+
- A running Neo4j instance (local Docker is easiest)

```bash
docker run -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=neo4j/password neo4j:latest
```

### 2. Environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
ANTHROPIC_API_KEY=sk-ant-...      # required
OPENAI_API_KEY=sk-proj-...        # optional — needed for Whisper, embeddings, OpenAI personas
GEMINI_API_KEY=...                # optional — needed for Gemini personas

NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
NEO4J_DATABASE=neo4j
```

### 3. Run

```bash
npm install
npm run dev
```

The Neo4j schema (constraints + indexes) is created automatically on first startup via `src/instrumentation.ts`. To also load demo data:

```bash
npm run db:seed
```

Open [http://localhost:3000](http://localhost:3000).

---

## How It Works

### Chat & Agentic Loop

`POST /api/chat` runs a multi-turn agentic loop:

1. Resolve the selected persona from `config/personas/*.yaml`
2. Send conversation history + all registered skill tools to the persona's LLM
3. If the model calls tools → execute handlers in parallel → append results → loop
4. Stream text and tool events as SSE to the client
5. Stop when the model stops calling tools

The client (`ChatWindow`) consumes the SSE stream, rendering streamed text and tool badges in real time.

### Personas

Each persona is a YAML file in `config/personas/`. They are independent — each has its own LLM provider, model, personality instructions, and welcome message.

```yaml
# config/personas/socratic.yaml
id: socratic
name: Socratic Coach
provider: openai
model: gpt-4o-mini
welcomeMessage: "Let's think through this together."
instructions: |
  You are a Socratic coach. Ask one precise question at a time.
```

**Group conversations** (`/api/group-chat`) run multiple personas in sequence, each seeing the full thread including prior personas' responses in the same turn.

To add a persona: create a YAML file and restart the dev server. No code changes.

### Graph Schema & Entities

The graph schema is defined entirely in `config/graph.yaml`. Every node type with a `ui` extension block gets:

- A CRUD API at `/api/entities/[type]`
- A list/edit page at `/e/[type]`
- Automatic inclusion in the AI's system prompt
- Form fields, select options, relation pickers, and tab groups — all from YAML

**Adding an entity type** — add a node to `config/graph.yaml`:

```yaml
nodes:
  Company:
    labels: [company]
    properties:
      id: { type: STRING, nullable: false, unique: true }
      name: { type: STRING, nullable: false }
      industry: { type: STRING }
    indexes:
      company_search:
        type: FULLTEXT
        label: company
        properties: [name]
    extensions:
      reasoningHint: "Companies that people work for."
      ui:
        label: Company
        plural: Companies
        _icon: Building
        displayName: name
        displaySub: industry
        fields:
          - key: name
            label: Name
            type: text
            required: true
          - key: industry
            label: Industry
            type: text
```

**Field types:** `text`, `email`, `textarea`, `date`, `select`, `enum`, `relation`

**Select / enum options** use a map format — the key is the stored value:

```yaml
- key: status
  label: Status
  type: select
  options:
    active: { label: Active }
    paused: { label: Paused }

- key: mbtiEnergy
  label: Energy
  type: enum
  options:
    E: { label: Extraversion, description: Energised by people & activity }
    I: { label: Introversion, description: Energised by solitude & reflection }
```

`enum` renders as a card picker with descriptions; `select` renders as a dropdown.

**Relation fields** link to another node type via a defined relationship:

```yaml
- key: projectId
  label: Project
  type: relation
  endpoint: /api/entities/project
  labelKey: name
  valueKey: id
  relationship: partOf
```

**Tab groups** (`_groups`) split form fields into named tabs. Fields not listed in any group appear above the tabs:

```yaml
_groups:
  - label: Job
    fields: [role, email, notes]
  - label: Myers-Briggs
    fields: [mbtiEnergy, mbtiInformation, mbtiDecisions, mbtiStructure]
```

Restart the dev server after editing `graph.yaml`.

### Skills

Skills are the AI's tools — how it reads and writes the graph. Each skill lives in `src/skills/<name>/`:

```
src/skills/
  people/
    index.ts    ← exports a Skill object (tool definitions + handlers)
    queries.ts  ← Neo4j Cypher queries
  projects/
  tasks/
  digest/
  interactions/
```

To add a skill:
1. Create `src/skills/<name>/index.ts` exporting a `Skill`
2. Create `src/skills/<name>/queries.ts` with Cypher queries
3. Register in `src/lib/skills/registry.ts`

The agentic loop automatically exposes all registered skills as Claude tools.

### Multi-Provider Adapter

`src/lib/models/adapter.ts` is a provider-agnostic streaming adapter supporting Anthropic, OpenAI, and Gemini. All three support:
- Streaming text deltas
- Tool use / function calling
- Multi-turn agentic loops

Anthropic Opus also supports extended thinking (streamed as `thinking_delta` events).

### Chat History

Messages are persisted to Neo4j `Chat` and `Message` nodes. If an OpenAI API key is present, messages are embedded with `text-embedding-3-small` (1536 dims) for semantic search. Falls back to substring search without embeddings.

APIs: `GET /api/chats`, `GET /api/chats/[chatId]`, `GET /api/chats/search?q=`

### Digests

The digest skill queries the graph for recent activity and asks Claude to summarise it. Digests are saved as `Digest` nodes in Neo4j.

```bash
npm run digest:daily    # generate and save a daily digest
npm run digest:weekly   # generate and save a weekly digest
npm run scheduler       # start background cron (daily + weekly, configurable via TZ)
```

---

## Project Structure

```
config/
  graph.yaml            ← entity types, properties, indexes, UI config
  personas/             ← one YAML file per AI persona

src/
  app/
    api/
      chat/             ← POST /api/chat (single persona SSE)
      group-chat/       ← POST /api/group-chat (multi-persona SSE)
      entities/[type]/  ← CRUD API generated from graph.yaml
      spec/             ← GET /api/spec (client-safe config)
      chats/            ← chat history API
    e/[type]/           ← entity list/edit pages
    digest/             ← digest viewer
    settings/           ← settings page

  components/
    chat/               ← ChatWindow, ChatInput, MessageBubble, PersonaSelector
    entity/             ← EntityListPage, EntityDialog, EntityForm
    layout/             ← AppShell, EntityMenu

  entities/
    types.ts            ← EntityDef, FieldDef, FieldGroup interfaces
    registry.ts         ← builds EntityDef objects from graph.yaml at startup
    client-config.ts    ← client-safe entity config (no Neo4j imports)

  lib/
    models/
      adapter.ts        ← multi-provider streaming adapter (Anthropic/OpenAI/Gemini)
      types.ts          ← ModelConfig
    neo4j/
      client.ts         ← Neo4j driver, runQuery helper
      schema.ts         ← setupSchema() — constraints + indexes
    skills/
      types.ts          ← Skill, SkillTool interfaces
      registry.ts       ← registers all skills
    spec/
      loader.ts         ← loads graph.yaml and persona YAMLs (cached)
      entity-crud.ts    ← generates EntityDef CRUD from graph.yaml
      types.ts          ← GraphSpec, NodeSpec, etc.

  modes/
    registry.ts         ← loads personas, builds system prompts

  skills/               ← people, projects, tasks, digest, interactions

  cli/
    index.ts            ← CLI dispatcher
    scheduler.ts        ← node-cron background scheduler
```

---

## Commands

```bash
npm run dev             # start dev server
npm run build           # production build
npm run lint            # ESLint

npm run db:seed         # seed demo data (people, projects, tasks)

npm run digest:daily    # generate daily digest
npm run digest:weekly   # generate weekly digest
npm run scheduler       # start background digest scheduler

npm run cli -- <cmd>    # raw CLI access
```
