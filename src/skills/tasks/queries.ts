import { runQuery } from '@/lib/neo4j/client'
import { randomUUID } from 'crypto'

export async function listTasks(filter?: { status?: string; priority?: string; projectId?: string }) {
  const where: string[] = []
  const params: Record<string, unknown> = {}

  if (filter?.status) { where.push('t.status = $status'); params.status = filter.status }
  if (filter?.priority) { where.push('t.priority = $priority'); params.priority = filter.priority }
  if (filter?.projectId) { where.push('proj.id = $projectId'); params.projectId = filter.projectId }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''

  return runQuery(`
    MATCH (t:Task)
    OPTIONAL MATCH (t)-[:PART_OF]->(proj:Project)
    OPTIONAL MATCH (person:Person)-[:ASSIGNED_TO]->(t)
    ${whereClause}
    RETURN t {.id, .title, .status, .priority, .dueDate, .description} AS task,
           proj {.id, .name} AS project,
           collect(person {.id, .name}) AS assignees
    ORDER BY CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, t.createdAt
  `, params)
}

export async function createTask(data: {
  title: string
  description?: string
  status?: string
  priority?: string
  dueDate?: string
  projectId?: string
  assigneeId?: string
}) {
  const id = randomUUID()
  await runQuery(`
    CREATE (t:Task {
      id: $id, title: $title, description: $description,
      status: $status, priority: $priority, dueDate: $dueDate,
      createdAt: datetime()
    })
    WITH t
    CALL {
      WITH t
      MATCH (proj:Project {id: $projectId})
      MERGE (t)-[:PART_OF]->(proj)
      RETURN proj
    } IN TRANSACTIONS OF 1 ROW
    WITH t
    CALL {
      WITH t
      MATCH (person:Person {id: $assigneeId})
      MERGE (person)-[:ASSIGNED_TO]->(t)
      RETURN person
    } IN TRANSACTIONS OF 1 ROW
    RETURN t {.*} AS task
  `, {
    id,
    title: data.title,
    description: data.description ?? null,
    status: data.status ?? 'todo',
    priority: data.priority ?? 'medium',
    dueDate: data.dueDate ?? null,
    projectId: data.projectId ?? '__none__',
    assigneeId: data.assigneeId ?? '__none__',
  })
  return { id, ...data }
}

export async function updateTask(id: string, data: Record<string, unknown>) {
  const rows = await runQuery(`
    MATCH (t:Task {id: $id})
    SET t += $data, t.updatedAt = datetime()
    RETURN t {.*} AS task
  `, { id, data })
  return rows[0]
}

export async function assignTask(taskId: string, personId: string) {
  return runQuery(`
    MATCH (t:Task {id: $taskId}), (p:Person {id: $personId})
    MERGE (p)-[:ASSIGNED_TO]->(t)
    RETURN p.name AS assignee, t.title AS task
  `, { taskId, personId })
}

export async function getOverdueTasks() {
  return runQuery(`
    MATCH (t:Task)
    WHERE t.dueDate IS NOT NULL AND t.dueDate < date() AND t.status <> 'done'
    OPTIONAL MATCH (p:Person)-[:ASSIGNED_TO]->(t)
    RETURN t {.id, .title, .status, .dueDate} AS task, collect(p.name) AS assignees
    ORDER BY t.dueDate
  `)
}
