import { randomUUID } from 'node:crypto';
import { createTool } from '@mastra/core/tools';
import neo4j from 'neo4j-driver';
import { z } from 'zod';
import { lastUserText } from '../../memory/context';
import { run, safely, toPlain } from '../neo4j';
import type { Extension, InputProc } from '../types';

/**
 * LONG-TERM MEMORY IN NEO4J
 *
 * Facts become a small knowledge graph instead of lines in a file:
 *
 *   (:Memory {text})-[:ABOUT]->(:Entity {name, type})
 *   (:Entity)-[:RELATED {type}]->(:Entity)
 *
 * Takes over the long-term slot from memory/long-term.md: the agent saves with
 * `remember_graph`, searches with `recall_graph`, and relevant memories are
 * injected before each model call.
 */
const terms = (text: string) => [...new Set(text.toLowerCase().match(/[a-z0-9]{4,}/g) ?? [])].slice(0, 12);

const RECALL = `
  MATCH (m:Memory)
  OPTIONAL MATCH (m)-[:ABOUT]->(e:Entity)
  WITH m, collect(e.name) AS entities
  WITH m, entities, [t IN $terms WHERE toLower(m.text) CONTAINS t OR any(n IN entities WHERE n CONTAINS t)] AS hits
  WHERE size($terms) = 0 OR size(hits) > 0
  RETURN m.text AS text, entities, m.createdAt AS createdAt
  ORDER BY size(hits) DESC, createdAt DESC LIMIT $limit`;

const processor: InputProc = {
  id: 'neo4j-long-term',

  async processInput({ messageList, messages }) {
    const q = terms(lastUserText(messages));
    // Memories matching this message, topped up with the most recent ones.
    const [relevant, recent] = await Promise.all([
      q.length ? safely('neo4j-long-term', () => run<{ text: string }>(RECALL, { terms: q, limit: neo4j.int(8) }), []) : [],
      safely('neo4j-long-term', () => run<{ text: string }>(RECALL, { terms: [], limit: neo4j.int(5) }), []),
    ]);
    const texts = [...new Set([...relevant, ...recent].map((r) => r.text))];
    if (texts.length) {
      messageList.addSystem(`Long-term memory (from Neo4j):\n${texts.map((t) => `- ${t}`).join('\n')}`, 'neo4j-long-term');
    }
    return messageList;
  },
};

const entity = z.object({ name: z.string(), type: z.string().describe('e.g. Person, Company, Project, Place, Preference') });

const tools = {
  remember_graph: createTool({
    id: 'remember_graph',
    description:
      'Save a durable fact to the long-term knowledge graph in Neo4j. Include the entities the fact is about and any relationships between them.',
    inputSchema: z.object({
      fact: z.string().describe('One self-contained fact, written as a full sentence.'),
      entities: z.array(entity).describe('People, places, projects etc. the fact is about.'),
      relations: z
        .array(z.object({ from: z.string(), type: z.string().describe('e.g. WORKS_AT, LIVES_IN'), to: z.string() }))
        .default([])
        .describe('Relationships between the entities above, by name.'),
    }),
    execute: async ({ fact, entities, relations }) => {
      await run(
        `CREATE (m:Memory {id: $id, text: $fact, createdAt: $now})
         WITH m
         UNWIND $entities AS e
         MERGE (n:Entity {name: toLower(e.name)})
           ON CREATE SET n.displayName = e.name, n.type = e.type
         MERGE (m)-[:ABOUT]->(n)`,
        { id: randomUUID(), fact, entities, now: neo4j.int(Date.now()) },
      );
      if (relations.length) {
        await run(
          `UNWIND $relations AS r
           MERGE (a:Entity {name: toLower(r.from)})
           MERGE (b:Entity {name: toLower(r.to)})
           MERGE (a)-[:RELATED {type: toUpper(replace(r.type, ' ', '_'))}]->(b)`,
          { relations },
        );
      }
      return { saved: fact, entities: entities.length, relations: relations.length };
    },
  }),

  recall_graph: createTool({
    id: 'recall_graph',
    description: 'Search long-term memory in Neo4j: matching memories plus how the entities they mention connect to other things.',
    inputSchema: z.object({ query: z.string().describe('Names or keywords to look for.') }),
    execute: async ({ query }) => {
      const t = terms(query.length < 4 ? `${query}____`.slice(0, 4) : query);
      const memories = await run(RECALL, { terms: t, limit: neo4j.int(10) });
      const connections = await run(
        `MATCH (a:Entity)-[r:RELATED]-(b:Entity)
         WHERE any(t IN $terms WHERE a.name CONTAINS t)
         RETURN a.displayName AS from, r.type AS type, b.displayName AS to LIMIT 25`,
        { terms: t },
      );
      return toPlain({ memories, connections });
    },
  }),
};

export const neo4jLongTerm: Extension = {
  id: 'neo4j-long-term',
  title: 'Long-term memory in Neo4j',
  description: 'Durable facts stored as a knowledge graph of memories and entities, recalled by relevance.',
  requires: ['NEO4J_URI', 'NEO4J_USERNAME', 'NEO4J_PASSWORD'],
  inputProcessors: [processor],
  tools,
  instructions:
    'Long-term memory is the Neo4j graph. Save durable facts with remember_graph (always name the entities and relationships) and look things up with recall_graph. Do not use the flat-file `remember` tool.',
  setup: async () => {
    await run('CREATE CONSTRAINT memory_id IF NOT EXISTS FOR (m:Memory) REQUIRE m.id IS UNIQUE');
    await run('CREATE CONSTRAINT entity_name IF NOT EXISTS FOR (e:Entity) REQUIRE e.name IS UNIQUE');
  },
};
