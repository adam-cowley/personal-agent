import { runQuery } from '@/lib/neo4j/client'
import { randomUUID } from 'crypto'

export async function getWeeklyDigestData() {
  const [tasks, projects, people] = await Promise.all([
    runQuery(`
      MATCH (t:Task)
      WHERE t.updatedAt >= datetime() - duration('P7D') OR t.createdAt >= datetime() - duration('P7D')
      OPTIONAL MATCH (p:Person)-[:ASSIGNED_TO]->(t)
      OPTIONAL MATCH (t)-[:PART_OF]->(proj:Project)
      RETURN t {.id, .title, .status, .priority, .dueDate} AS task,
             collect(p.name) AS assignees, proj.name AS project
      ORDER BY t.updatedAt DESC
    `),
    runQuery(`
      MATCH (p:Project {status: 'active'})
      OPTIONAL MATCH (t:Task)-[:PART_OF]->(p)
      RETURN p {.id, .name, .status} AS project,
             count(t) AS totalTasks,
             count(CASE WHEN t.status = 'done' THEN t END) AS doneTasks,
             count(CASE WHEN t.status = 'in_progress' THEN t END) AS inProgressTasks
    `),
    runQuery(`
      MATCH (person:Person)
      OPTIONAL MATCH (person)-[:ASSIGNED_TO]->(t:Task {status: 'in_progress'})
      RETURN person {.id, .name, .role} AS person, count(t) AS activeTasks
      ORDER BY activeTasks DESC
    `),
  ])
  return { tasks, projects, people, generatedAt: new Date().toISOString() }
}

export async function getDailyDigestData() {
  const [overdue, today, inProgress] = await Promise.all([
    runQuery(`
      MATCH (t:Task)
      WHERE t.dueDate < date() AND t.status <> 'done'
      OPTIONAL MATCH (p:Person)-[:ASSIGNED_TO]->(t)
      RETURN t {.id, .title, .dueDate, .priority} AS task, collect(p.name) AS assignees
    `),
    runQuery(`
      MATCH (t:Task) WHERE t.dueDate = date()
      OPTIONAL MATCH (p:Person)-[:ASSIGNED_TO]->(t)
      RETURN t {.id, .title, .status, .priority} AS task, collect(p.name) AS assignees
    `),
    runQuery(`
      MATCH (t:Task {status: 'in_progress'})
      OPTIONAL MATCH (p:Person)-[:ASSIGNED_TO]->(t)
      RETURN t {.id, .title, .priority} AS task, collect(p.name) AS assignees
    `),
  ])
  return { overdue, today, inProgress, generatedAt: new Date().toISOString() }
}

export async function saveDigest(type: 'daily' | 'weekly', content: string) {
  const id = randomUUID()
  const rows = await runQuery(`
    CREATE (d:Digest {id: $id, type: $type, content: $content, createdAt: datetime()})
    RETURN d {.*} AS digest
  `, { id, type, content })
  return rows[0]
}
