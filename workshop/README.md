# Agent memory workshop

A [Mastra](https://mastra.ai) agent (scaffolded with `npm create mastra@latest`) whose memory starts as **plain text files**. During the workshop you switch on **extensions** one at a time that move each kind of memory into **Neo4j**.

| Memory | Starts as (always on) | Extension | In Neo4j |
| --- | --- | --- | --- |
| **Short-term** – recent turns | `memory/short-term/<thread>.md` | `neo4j-short-term` | `(:Conversation)-[:HAS_MESSAGE]->(:Message)`, linked by `[:NEXT]` |
| **Long-term** – durable facts | `memory/long-term.md` | `neo4j-long-term` | `(:Memory)-[:ABOUT]->(:Entity)-[:RELATED]->(:Entity)` |
| **Context traces** – how it got there | `memory/traces.jsonl` | `neo4j-context-traces` | `(:Message)-[:TRIGGERED]->(:Trace)-[:RESULTED_IN]->(:Message)`, plus `(:Trace)-[:HAS_STEP]->(:Step)-[:CALLED]->(:ToolCall)` |
| **Skills** – reusable procedures learned from traces | `skills/<name>/SKILL.md` (approved only) | `neo4j-skills` | `(:Skill)-[:DERIVED_FROM]->(:Trace)`, with `status` |
| **Workflows** – fixed tool sequences learned from traces | `workflows/<name>.json` (approved only) | `neo4j-workflows` | `(:Workflow)-[:HAS_STEP]->(:WorkflowStep)`, `(:Workflow)-[:DERIVED_FROM]->(:Trace)` |

The flat files are always written, so you can `cat` them next to the graph. Extensions that own a *read* path (short-term, long-term) take over injecting context from the flat files.

## Run in a GitHub Codespace (easiest)

Open the repo in a Codespace (**Code → Codespaces → Create**). The dev container starts a **Neo4j 5** service next to your workspace, installs dependencies, writes `.env` with the connection details, and pre-creates the schema for every extension. Before you start:

1. Add an `ANTHROPIC_API_KEY` [Codespaces secret](https://github.com/settings/codespaces) for this repo (or put it in `workshop/.env`).
2. In the terminal (already in `workshop/`): `npm run dev`, then open the forwarded port **4111** (Mastra Studio).
3. Neo4j Browser is on port **7474**, login `neo4j` / `workshop-password` (Bolt: `bolt://neo4j:7687` from the workspace).

Then work through the steps below with `npm run ext -- enable <id>` (no `setup` needed, it's already done). `npm run ext -- enable all` switches on every extension at once; `npm run ext -- disable all` returns to flat files only. The Neo4j data persists in a Docker volume for the life of the Codespace.

## Setup (local)

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

then repeat with `long-term` (step 2), `context-traces` (step 3) and `skills` (step 4) and `workflows` (step 5). Steps 4 and 5 require `context-traces`. `npm run ext` lists what is on; `npm run ext -- disable <id>` turns one off. This just edits `EXTENSIONS=` in `.env`.

### Exercises

1. **Short-term:** chat, restart the server, chat again. Run `MATCH (c:Conversation)-[:HAS_MESSAGE]->(m) RETURN c, m` in Neo4j Browser.
2. **Long-term:** tell it about your team and projects, then `MATCH p=(:Memory)-[:ABOUT]->(:Entity)-[:RELATED*0..2]-() RETURN p`. Notice facts about the same entity connect.
3. **Traces:** ask it the time in a few cities, then `MATCH p=(:Trace)-[:HAS_STEP]->(:Step)-[:CALLED]->(:ToolCall) RETURN p`. Ask the agent *"how did you answer my last question?"*

4. **Skills (review-gated):** after a few tool-using chats, ask *"Look at how you've answered my time questions and propose a skill for it."* The agent calls `review_traces` then `propose_skill`. Nothing is usable yet:

```bash
npm run ext -- skills                    # list drafts
npm run ext -- skills show <name>        # read the draft
npm run ext -- skills approve <name>     # moves it to skills/ — the agent can now load_skill it
npm run ext -- skills reject <name>
```

   Then `MATCH (s:Skill)-[:DERIVED_FROM]->(t:Trace) RETURN s, t` shows which traces a skill came from.

5. **Workflows (review-gated):** a skill is advice the model may follow; a workflow is a fixed sequence of tool calls that runs the same way every time (as a real Mastra workflow built from stored data, never generated code). Ask the agent for the time in a few cities, then *"Turn that into a workflow."* It proposes JSON like `{"tool": "get_current_time", "args": {"timezone": "{{inputs.tz}}"}}`, with `{{inputs.x}}` for caller values and `{{steps.N.field}}` for earlier outputs. Drafts are checked on save (tools must exist, references must be valid), then reviewed:

```bash
npm run ext -- workflows                 # list drafts
npm run ext -- workflows show <name>
npm run ext -- workflows approve <name>  # now runnable via run_workflow
npm run ext -- workflows reject <name>
```

   Workflow steps can't call the propose/run tools, so workflows can't create or nest other workflows. Review the steps carefully: approving a workflow approves every tool call in it.

## How it works

- `src/mastra/memory/` – flat-file store (`files.ts`), the always-on processor and `remember`/`forget` tools (`flat-memory.ts`).
- `src/mastra/extensions/<id>/index.ts` – one folder per extension. Each exports an `Extension` (`types.ts`): optional `tools`, `inputProcessors` (inject context before the model), `outputProcessors` (persist after it), `instructions`, and `setup` (constraints).
- `src/mastra/agents/agent.ts` – assembles the agent from the base plus whichever extensions are enabled.

Mastra's built-in `Memory` is intentionally not used, so the files and graph are the single source of truth. Neo4j failures are logged and never crash the agent; the flat files keep working.

## Writing your own extension

Copy `neo4j-context-traces/`, change the Cypher, add the id to `extensions/registry.ts` and the map in `extensions/index.ts`.
