import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { appendLongTerm, appendShortTerm, appendTrace, forgetLongTerm, readLongTerm, readShortTerm } from './files';
import { lastUserText, threadIdOf } from './context';
import { isEnabled } from '../extensions/registry';
import type { InputProc, OutputProc } from '../extensions/types';

const SHORT_TERM_TURNS = Number(process.env.SHORT_TERM_TURNS ?? 10);

/**
 * Base memory: plain text files. Always on.
 *
 * Writes (every turn): short-term log + trace line, always, so you can `cat` them.
 * Reads (before the model): long-term facts + recent turns — unless a Neo4j
 * extension has taken over that slot, in which case it injects the context instead.
 */
export const flatMemory: InputProc & OutputProc = {
  id: 'flat-memory',
  name: 'Flat-file memory',

  processInput({ messageList, messages, requestContext }) {
    const threadId = threadIdOf({ messages, requestContext });

    if (!isEnabled('neo4j-long-term')) {
      const facts = readLongTerm();
      if (facts.length) {
        messageList.addSystem(`Long-term memory (memory/long-term.md):\n${facts.map((f) => `- ${f}`).join('\n')}`, 'flat-long-term');
      }
    }
    if (!isEnabled('neo4j-short-term')) {
      const recent = readShortTerm(threadId, SHORT_TERM_TURNS);
      if (recent) {
        messageList.addSystem(`Recent conversation from earlier in this thread (memory/short-term):\n${recent}`, 'flat-short-term');
      }
    }
    return messageList;
  },

  processOutputResult({ messages, messageList, requestContext, result }) {
    const threadId = threadIdOf({ messages, requestContext });
    const user = lastUserText(messages);
    appendShortTerm(threadId, user, result.text);
    appendTrace({
      at: new Date().toISOString(),
      threadId,
      input: user,
      output: result.text,
      finishReason: result.finishReason,
      usage: result.usage,
      steps: result.steps.map((s, i) => ({
        step: i,
        text: s.text,
        toolCalls: s.toolCalls.map((c) => ({ name: c.payload.toolName, args: c.payload.args })),
        toolResults: s.toolResults.map((r) => ({ name: r.payload.toolName, result: r.payload.result })),
      })),
    });
    return messageList;
  },
};

export const flatMemoryTools = {
  remember: createTool({
    id: 'remember',
    description:
      'Save a durable fact about the user or their world to long-term memory (memory/long-term.md). Use for preferences, people, decisions, and anything worth knowing in future conversations.',
    inputSchema: z.object({ fact: z.string().describe('One self-contained fact, written as a full sentence.') }),
    execute: async ({ fact }) => {
      appendLongTerm(fact);
      return { saved: fact };
    },
  }),
  forget: createTool({
    id: 'forget',
    description: 'Remove long-term memories (flat file) containing the given text.',
    inputSchema: z.object({ contains: z.string() }),
    execute: async ({ contains }) => ({ removed: forgetLongTerm(contains) }),
  }),
};
