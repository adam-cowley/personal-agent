import { randomUUID } from 'node:crypto';
import { createTool } from '@mastra/core/tools';
import neo4j from 'neo4j-driver';
import { z } from 'zod';
import { lastUserText, threadIdOf } from '../../memory/context';
import { run, safely, toPlain } from '../neo4j';
import type { Extension, OutputProc } from '../types';

/**
 * CONTEXT TRACES IN NEO4J
 *
 * A trace records *how* the agent got to an answer, not just the answer:
 *
 *   (:Trace)-[:IN_CONVERSATION]->(:Conversation)
 *   (:Trace)-[:RESPONDS_TO]->(:Message)          (when short-term is enabled)
 *   (:Trace)-[:HAS_STEP]->(:Step)-[:CALLED]->(:ToolCall {name, args, result})
 *
 * The flat memory/traces.jsonl is still written. This adds a queryable graph
 * and a `review_traces` tool so the agent can learn from what it did before.
 */
const clip = (v: unknown, n = 4000) => {
  const s = typeof v === 'string' ? v : JSON.stringify(v ?? null);
  return s.length > n ? `${s.slice(0, n)}…` : s;
};

const processor: OutputProc = {
  id: 'neo4j-context-traces',

  async processOutputResult({ messageList, messages, requestContext, result }) {
    const id = randomUUID();
    const threadId = threadIdOf({ messages, requestContext });
    const steps = result.steps.map((s, index) => {
      const resultsById = new Map(s.toolResults.map((r) => [r.payload.toolCallId, r.payload.result]));
      return {
        index,
        text: clip(s.text),
        toolCalls: s.toolCalls.map((c) => ({
          name: c.payload.toolName,
          args: clip(c.payload.args),
          result: clip(resultsById.get(c.payload.toolCallId)),
        })),
      };
    });

    await safely(
      'neo4j-context-traces',
      async () => {
        await run(
          `MERGE (c:Conversation {id: $threadId})
           CREATE (t:Trace {id: $id, at: $at, input: $input, output: $output,
                            finishReason: $finishReason, totalTokens: $totalTokens})
           CREATE (t)-[:IN_CONVERSATION]->(c)
           WITH t, c
           OPTIONAL MATCH (c)-[:HAS_MESSAGE]->(m:Message {role: 'user'})
           WITH t, m ORDER BY m.createdAt DESC LIMIT 1
           FOREACH (_ IN CASE WHEN m IS NULL THEN [] ELSE [1] END | CREATE (t)-[:RESPONDS_TO]->(m))`,
          {
            id,
            threadId,
            at: new Date().toISOString(),
            input: clip(lastUserText(messages)),
            output: clip(result.text),
            finishReason: String(result.finishReason),
            totalTokens: neo4j.int(result.usage?.totalTokens ?? 0),
          },
        );
        await run(
          `MATCH (t:Trace {id: $id})
           UNWIND $steps AS s
           CREATE (t)-[:HAS_STEP]->(st:Step {index: s.index, text: s.text})
           WITH st, s
           UNWIND s.toolCalls AS tc
           CREATE (st)-[:CALLED]->(:ToolCall {name: tc.name, args: tc.args, result: tc.result})`,
          { id, steps },
        );
      },
      undefined,
    );
    return messageList;
  },
};

const tools = {
  review_traces: createTool({
    id: 'review_traces',
    description:
      'Look back at how you handled earlier requests: the tool calls you made and what they returned. Use it to reuse approaches that worked or avoid repeating mistakes.',
    inputSchema: z.object({
      about: z.string().default('').describe('Optional text to match against past requests and answers.'),
      limit: z.number().int().min(1).max(10).default(5),
    }),
    execute: async ({ about, limit }) =>
      toPlain(
        await run(
          `MATCH (t:Trace)
           WHERE $about = '' OR toLower(t.input) CONTAINS $about OR toLower(t.output) CONTAINS $about
           WITH t ORDER BY t.at DESC LIMIT $limit
           OPTIONAL MATCH (t)-[:HAS_STEP]->(:Step)-[:CALLED]->(tc:ToolCall)
           RETURN t {.at, .input, .output, .finishReason, .totalTokens} AS trace,
                  collect(tc {.name, .args, .result}) AS toolCalls
           ORDER BY trace.at DESC`,
          { about: about.toLowerCase(), limit: neo4j.int(limit) },
        ),
      ),
  }),
};

export const neo4jContextTraces: Extension = {
  id: 'neo4j-context-traces',
  title: 'Context traces in Neo4j',
  description: 'Every turn recorded as Trace → Step → ToolCall, so you can query and reuse how the agent reasoned.',
  requires: ['NEO4J_URI', 'NEO4J_USERNAME', 'NEO4J_PASSWORD'],
  outputProcessors: [processor],
  tools,
  instructions: 'You can call review_traces to see how you handled similar requests before, including which tools you used.',
  setup: async () => {
    await run('CREATE CONSTRAINT trace_id IF NOT EXISTS FOR (t:Trace) REQUIRE t.id IS UNIQUE');
    await run('CREATE INDEX trace_at IF NOT EXISTS FOR (t:Trace) ON (t.at)');
  },
};
