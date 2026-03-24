import { runQuery } from '@/lib/neo4j/client'
import { randomUUID } from 'crypto'

export async function listProjects() {
  return runQuery(`
    MATCH (p:Project)
    OPTIONAL MATCH (person:Person)-[:WORKS_ON]->(p)
    OPTIONAL MATCH (t:Task)-[:PART_OF]->(p)
    WITH p, collect(DISTINCT person {.id, .name}) AS members,
         count(DISTINCT t) AS taskCount,
         count(DISTINCT CASE WHEN t.status = 'done' THEN t END) AS doneTasks
    ORDER BY p.name
    RETURN p {.id, .name, .description, .status} AS project, members, taskCount, doneTasks
  `)
}

export async function getProject(id: string) {
  const rows = await runQuery(`
    MATCH (p:Project {id: $id})
    OPTIONAL MATCH (person:Person)-[:WORKS_ON]->(p)
    OPTIONAL MATCH (t:Task)-[:PART_OF]->(p)
    OPTIONAL MATCH (t)<-[:ASSIGNED_TO]-(assignee:Person)
    RETURN p {.*} AS project,
           collect(DISTINCT person {.id, .name, .role}) AS members,
           collect(DISTINCT t {.id, .title, .status, .priority, assignee: assignee.name}) AS tasks
  `, { id })
  return rows[0] ?? null
}

export async function createProject(data: {
  name: string
  description?: string
  status?: string
}) {
  const id = randomUUID()
  const rows = await runQuery(`
    CREATE (p:Project {id: $id, name: $name, description: $description, status: $status, createdAt: datetime()})
    RETURN p {.*} AS project
  `, { id, name: data.name, description: data.description ?? null, status: data.status ?? 'active' })
  return rows[0]
}

export async function updateProject(id: string, data: Record<string, unknown>) {
  const rows = await runQuery(`
    MATCH (p:Project {id: $id})
    SET p += $data, p.updatedAt = datetime()
    RETURN p {.*} AS project
  `, { id, data })
  return rows[0]
}

export async function addMemberToProject(personId: string, projectId: string) {
  return runQuery(`
    MATCH (person:Person {id: $personId}), (project:Project {id: $projectId})
    MERGE (person)-[:WORKS_ON]->(project)
    RETURN person.name AS person, project.name AS project
  `, { personId, projectId })
}
