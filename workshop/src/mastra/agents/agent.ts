import { Agent } from '@mastra/core/agent';
import { flatMemory, flatMemoryTools } from '../memory/flat-memory';
import { activeExtensions } from '../extensions';
import { isEnabled } from '../extensions/registry';
import { currentTimeTool } from '../tools/time';

const extensions = activeExtensions();

const BASE_INSTRUCTIONS = `You are a personal assistant with memory. Be concise and friendly.

Your memory lives in plain text files:
- memory/long-term.md holds durable facts. Save new ones with the \`remember\` tool whenever the user shares something worth knowing later (preferences, people, projects, decisions). Use \`forget\` if asked to drop something.
- memory/short-term/ holds the recent turns of this conversation; it is shown to you automatically.
- memory/traces.jsonl records what you did each turn; you do not need to manage it.

Use what you remember naturally. Do not announce that you are reading memory.`;

// When Neo4j takes over long-term memory, the flat-file tools would just compete with it.
const flatTools = isEnabled('neo4j-long-term') ? {} : flatMemoryTools;

export const agent = new Agent({
  id: 'agent',
  name: 'Agent',
  description: 'A personal assistant whose memory starts as flat text files and is upgraded to Neo4j, one extension at a time.',
  metadata: {
    suggestedPrompts: [
      "Hi! I'm Sam, I work at Acme on the data platform team.",
      'What do you remember about me?',
      'What time is it in Tokyo?',
    ],
  },
  instructions: [BASE_INSTRUCTIONS, ...extensions.map((e) => e.instructions).filter(Boolean)].join('\n\n'),
  model: 'anthropic/claude-sonnet-5',
  defaultOptions: { maxSteps: 20 },
  tools: {
    get_current_time: currentTimeTool,
    ...flatTools,
    ...Object.assign({}, ...extensions.map((e) => e.tools ?? {})),
  },
  // Order matters: flat memory first, then extensions in the order they were enabled.
  inputProcessors: [flatMemory, ...extensions.flatMap((e) => e.inputProcessors ?? [])],
  outputProcessors: [flatMemory, ...extensions.flatMap((e) => e.outputProcessors ?? [])],
});
