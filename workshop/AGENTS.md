# AGENTS.md

Mastra project (`@mastra/core`). Check the installed version's types/docs rather than relying on memory: https://mastra.ai/llms.txt

- Register agents in `src/mastra/index.ts`.
- Agent memory is custom: flat files in `src/mastra/memory/`, Neo4j upgrades in `src/mastra/extensions/`. Mastra's built-in `Memory` is deliberately not used.
- To add an extension: create `src/mastra/extensions/<id>/index.ts` exporting an `Extension`, add the id to `registry.ts` and the map in `extensions/index.ts`.
- Use `npm run dev`, `npm run build`, `npm run typecheck`.
