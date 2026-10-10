# Agent memory workshop

A [Mastra](https://mastra.ai) agent (scaffolded with `npm create mastra@latest`) whose memory starts as **plain text files**. During the workshop you switch on **extensions** one at a time that move each kind of memory into **Neo4j**.

| Memory | Starts as (always on) | Extension | In Neo4j |
| --- | --- | --- | --- |
| **Short-term** – recent turns | `memory/short-term/<thread>.md` | `neo4j-short-term` | `(:Conversation)-[:HAS_MESSAGE]->(:Message)`, linked by `[:NEXT]` |
| **Long-term** – durable facts | `memory/long-term.md` | `neo4j-long-term` | `(:Memory)-[:ABOUT]->(:Entity)-[:RELATED]->(:Entity)` |
| **Context traces** – how it got there | `memory/traces.jsonl` | `neo4j-context-traces` | `(:Trace)-[:HAS_STEP]->(:Step)-[:CALLED]->(:ToolCall)` |

The flat files are always written, so you can `cat` them next to the graph. Extensions that own a *read* path (short-term, long-term) take over injecting context from the flat files.

## Setup

```bash
npm install
cp .env.example .env      # add ANTHROPIC_API_KEY
npm run dev               # Mastra Studio at http://localhost:4111 → Agent
```

Try: *"Hi, I'm Sam and I work at Acme on the data platform team."*, then start a new chat and ask *"What do you remember about me?"* Open `memory/` to see what was written.

## Enabling extensions

1. Get a Neo4j database (free [Aura](https://neo4j.com/cloud/aura-free/), or `docker run -p 7687:7687 -e NEO4J_AUTH=neo4j/password neo4j:5`) and fill in `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD` in `.env`.
2. Check the connection: `npm run ext -- check`
3. Enable one extension, create its schema, restart `npm run dev`:

```bash
npm run ext -- enable short-term      # step 1
npm run ext -- setup
```

then repeat with `long-term` (step 2) and `context-traces` (step 3). `npm run ext` lists what is on; `npm run ext -- disable <id>` turns one off. This just edits `EXTENSIONS=` in `.env`.

### Exercises

1. **Short-term:** chat, restart the server, chat again. Run `MATCH (c:Conversation)-[:HAS_MESSAGE]->(m) RETURN c, m` in Neo4j Browser.
2. **Long-term:** tell it about your team and projects, then `MATCH p=(:Memory)-[:ABOUT]->(:Entity)-[:RELATED*0..2]-() RETURN p`. Notice facts about the same entity connect.
3. **Traces:** ask it the time in a few cities, then `MATCH p=(:Trace)-[:HAS_STEP]->(:Step)-[:CALLED]->(:ToolCall) RETURN p`. Ask the agent *"how did you answer my last question?"*

## How it works

- `src/mastra/memory/` – flat-file store (`files.ts`), the always-on processor and `remember`/`forget` tools (`flat-memory.ts`).
- `src/mastra/extensions/<id>/index.ts` – one folder per extension. Each exports an `Extension` (`types.ts`): optional `tools`, `inputProcessors` (inject context before the model), `outputProcessors` (persist after it), `instructions`, and `setup` (constraints).
- `src/mastra/agents/agent.ts` – assembles the agent from the base plus whichever extensions are enabled.

Mastra's built-in `Memory` is intentionally not used, so the files and graph are the single source of truth. Neo4j failures are logged and never crash the agent; the flat files keep working.

## Writing your own extension

Copy `neo4j-context-traces/`, change the Cypher, add the id to `extensions/registry.ts` and the map in `extensions/index.ts`.
