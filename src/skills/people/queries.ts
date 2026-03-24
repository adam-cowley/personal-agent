import { runQuery } from '@/lib/neo4j/client'
import { randomUUID } from 'crypto'

export async function listPeople() {
  return runQuery(`
    MATCH (p:Person)
    OPTIONAL MATCH (p)-[:WORKS_ON]->(proj:Project)
    OPTIONAL MATCH (p)-[:ASSIGNED_TO]->(t:Task {status: 'in_progress'})
    WITH p, collect(DISTINCT proj.name) AS projects, count(DISTINCT t) AS activeTasks
    ORDER BY p.name
    RETURN p {.id, .name, .email, .role, .notes} AS person, projects, activeTasks
  `)
}

export async function getPerson(id: string) {
  const rows = await runQuery(`
    MATCH (p:Person {id: $id})
    OPTIONAL MATCH (p)-[:WORKS_ON]->(proj:Project)
    OPTIONAL MATCH (p)-[:ASSIGNED_TO]->(t:Task)
    OPTIONAL MATCH (p)-[:KNOWS]->(knows:Person)
    RETURN p {.*} AS person,
           collect(DISTINCT proj {.id, .name, .status}) AS projects,
           collect(DISTINCT t {.id, .title, .status, .priority}) AS tasks,
           collect(DISTINCT knows {.id, .name}) AS connections
  `, { id })
  return rows[0] ?? null
}

export async function createPerson(data: {
  name: string
  email?: string
  role?: string
  notes?: string
}) {
  const id = randomUUID()
  const rows = await runQuery(`
    CREATE (p:Person {id: $id, name: $name, email: $email, role: $role, notes: $notes, createdAt: datetime()})
    RETURN p {.*} AS person
  `, { id, name: data.name, email: data.email ?? null, role: data.role ?? null, notes: data.notes ?? null })
  return rows[0]
}

export async function updatePerson(id: string, data: Record<string, unknown>) {
  const rows = await runQuery(`
    MATCH (p:Person {id: $id})
    SET p += $data, p.updatedAt = datetime()
    RETURN p {.*} AS person
  `, { id, data })
  return rows[0]
}

export async function searchPeople(query: string) {
  return runQuery(`
    CALL db.index.fulltext.queryNodes('person_search', $query) YIELD node AS p, score
    RETURN p {.id, .name, .email, .role} AS person, score
    ORDER BY score DESC LIMIT 10
  `, { query })
}

export async function connectPeople(fromId: string, toId: string, rel = 'KNOWS') {
  return runQuery(`
    MATCH (a:Person {id: $fromId}), (b:Person {id: $toId})
    MERGE (a)-[:${rel}]->(b)
    RETURN a.name AS from, b.name AS to
  `, { fromId, toId })
}
