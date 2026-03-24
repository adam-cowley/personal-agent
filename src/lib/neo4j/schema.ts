/**
 * Graph schema setup — run once via `npm run db:setup` or the /api/graph/setup endpoint.
 *
 * Nodes: Person, Project, Task, Note, Digest
 * Relationships:
 *   (Person)-[:WORKS_ON]->(Project)
 *   (Person)-[:ASSIGNED_TO]->(Task)
 *   (Task)-[:PART_OF]->(Project)
 *   (Person)-[:KNOWS]->(Person)
 *   (Note)-[:ABOUT]->(Person|Project|Task)
 *   (Digest)-[:SUMMARIZES]->(Person|Project|Task)
 */

import { runQuery } from './client'

export async function setupSchema() {
  const constraints = [
    'CREATE CONSTRAINT person_id IF NOT EXISTS FOR (p:Person) REQUIRE p.id IS UNIQUE',
    'CREATE CONSTRAINT project_id IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE',
    'CREATE CONSTRAINT task_id IF NOT EXISTS FOR (t:Task) REQUIRE t.id IS UNIQUE',
    'CREATE CONSTRAINT note_id IF NOT EXISTS FOR (n:Note) REQUIRE n.id IS UNIQUE',
    'CREATE CONSTRAINT digest_id IF NOT EXISTS FOR (d:Digest) REQUIRE d.id IS UNIQUE',
    'CREATE CONSTRAINT chat_id IF NOT EXISTS FOR (c:Chat) REQUIRE c.id IS UNIQUE',
    'CREATE CONSTRAINT message_id IF NOT EXISTS FOR (m:Message) REQUIRE m.id IS UNIQUE',
  ]

  const indexes = [
    'CREATE FULLTEXT INDEX person_search IF NOT EXISTS FOR (p:Person) ON EACH [p.name, p.email, p.notes]',
    'CREATE FULLTEXT INDEX project_search IF NOT EXISTS FOR (p:Project) ON EACH [p.name, p.description]',
    'CREATE FULLTEXT INDEX task_search IF NOT EXISTS FOR (t:Task) ON EACH [t.title, t.description]',
    // Vector index for semantic search over chat messages (requires OpenAI embeddings)
    // text-embedding-3-small = 1536 dimensions
    "CREATE VECTOR INDEX message_embedding IF NOT EXISTS FOR (m:Message) ON (m.embedding) OPTIONS {indexConfig: {`vector.dimensions`: 1536, `vector.similarity_function`: 'cosine'}}",
  ]

  for (const stmt of [...constraints, ...indexes]) {
    await runQuery(stmt)
  }
}

export async function seedDemoData() {
  await runQuery(`
    MERGE (alice:Person {id: 'person-1'})
    SET alice += {name: 'Alice Chen', email: 'alice@example.com', role: 'Product Manager', createdAt: datetime()}

    MERGE (bob:Person {id: 'person-2'})
    SET bob += {name: 'Bob Kim', email: 'bob@example.com', role: 'Engineer', createdAt: datetime()}

    MERGE (project:Project {id: 'project-1'})
    SET project += {name: 'Q1 Growth Initiative', description: 'Drive 20% user growth in Q1', status: 'active', createdAt: datetime()}

    MERGE (task1:Task {id: 'task-1'})
    SET task1 += {title: 'Define success metrics', description: 'Agree on KPIs for Q1 initiative', status: 'done', priority: 'high', createdAt: datetime()}

    MERGE (task2:Task {id: 'task-2'})
    SET task2 += {title: 'Build onboarding flow', description: 'Redesign first-run experience', status: 'in_progress', priority: 'high', createdAt: datetime()}

    MERGE (alice)-[:WORKS_ON]->(project)
    MERGE (bob)-[:WORKS_ON]->(project)
    MERGE (alice)-[:ASSIGNED_TO]->(task1)
    MERGE (bob)-[:ASSIGNED_TO]->(task2)
    MERGE (task1)-[:PART_OF]->(project)
    MERGE (task2)-[:PART_OF]->(project)
    MERGE (alice)-[:KNOWS]->(bob)
  `)
}
