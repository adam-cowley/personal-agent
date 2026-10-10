import { randomUUID } from 'node:crypto';
import neo4j from 'neo4j-driver';
import { lastUserText, threadIdOf } from '../../memory/context';
import { run, safely } from '../neo4j';
import type { Extension, InputProc, OutputProc } from '../types';

/**
 * SHORT-TERM MEMORY IN NEO4J
 *
 * Stores the conversation as a linked list of messages:
 *
 *   (:Conversation {id})-[:HAS_MESSAGE]->(:Message {role, content, createdAt})
 *   (:Message)-[:NEXT]->(:Message)
 *
 * Takes over the "recent turns" slot from memory/short-term/*.md: the last N
 * messages are read back from the graph and injected before each model call.
 * (The flat file is still written, as a backup you can read.)
 */
const WINDOW = Number(process.env.SHORT_TERM_TURNS ?? 10) * 2;

const processor: InputProc & OutputProc = {
  id: 'neo4j-short-term',

  async processInput({ messageList, messages, requestContext }) {
    const threadId = threadIdOf({ messages, requestContext });
    const rows = await safely(
      'neo4j-short-term',
      () =>
        run<{ role: string; content: string }>(
          `MATCH (:Conversation {id: $threadId})-[:HAS_MESSAGE]->(m:Message)
           WITH m ORDER BY m.createdAt DESC LIMIT $limit
           RETURN m.role AS role, m.content AS content ORDER BY m.createdAt ASC`,
          { threadId, limit: neo4j.int(WINDOW) },
        ),
      [],
    );
    if (rows.length) {
      messageList.addSystem(
        `Recent conversation from earlier in this thread (from Neo4j):\n${rows.map((r) => `${r.role}: ${r.content}`).join('\n')}`,
        'neo4j-short-term',
      );
    }
    return messageList;
  },

  async processOutputResult({ messageList, messages, requestContext, result }) {
    const threadId = threadIdOf({ messages, requestContext });
    const now = Date.now();
    await safely(
      'neo4j-short-term',
      () =>
        run(
          `MERGE (c:Conversation {id: $threadId})
             ON CREATE SET c.createdAt = $now
           SET c.updatedAt = $now
           WITH c
           OPTIONAL MATCH (c)-[:HAS_MESSAGE]->(last:Message) WHERE NOT (last)-[:NEXT]->()
           WITH c, last
           CREATE (u:Message {id: $userId, role: 'user', content: $user, createdAt: $now})
           CREATE (a:Message {id: $assistantId, role: 'assistant', content: $assistant, createdAt: $now + 1})
           CREATE (c)-[:HAS_MESSAGE]->(u), (c)-[:HAS_MESSAGE]->(a), (u)-[:NEXT]->(a)
           FOREACH (_ IN CASE WHEN last IS NULL THEN [] ELSE [1] END | CREATE (last)-[:NEXT]->(u))`,
          {
            threadId,
            now: neo4j.int(now),
            userId: randomUUID(),
            assistantId: randomUUID(),
            user: lastUserText(messages),
            assistant: result.text,
          },
        ),
      undefined,
    );
    return messageList;
  },
};

export const neo4jShortTerm: Extension = {
  id: 'neo4j-short-term',
  title: 'Short-term memory in Neo4j',
  description: 'Conversation history as a (:Conversation)-[:HAS_MESSAGE]->(:Message) graph, replayed into context each turn.',
  requires: ['NEO4J_URI', 'NEO4J_USERNAME', 'NEO4J_PASSWORD'],
  inputProcessors: [processor],
  outputProcessors: [processor],
  setup: async () => {
    await run('CREATE CONSTRAINT conversation_id IF NOT EXISTS FOR (c:Conversation) REQUIRE c.id IS UNIQUE');
    await run('CREATE CONSTRAINT message_id IF NOT EXISTS FOR (m:Message) REQUIRE m.id IS UNIQUE');
    await run('CREATE INDEX message_created IF NOT EXISTS FOR (m:Message) ON (m.createdAt)');
  },
};
