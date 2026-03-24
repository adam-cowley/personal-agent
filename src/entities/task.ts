import { CheckSquare } from "lucide-react"
import { randomUUID } from "crypto"
import { runQuery } from "@/lib/neo4j/client"
import type { EntityDef } from "./types"

interface Task extends Record<string, unknown> {
  id: string
  title: string
  description?: string
  status: string
  priority: string
  dueDate?: string
  projectId?: string
}

export const taskEntity: EntityDef<Task> = {
  type: "Task",
  label: "Task",
  plural: "Tasks",
  icon: CheckSquare,
  description: "A discrete unit of work with a status, priority, and optional due date",
  fields: [
    { key: "title",       label: "Title",       type: "text",     required: true, placeholder: "What needs to be done?" },
    { key: "description", label: "Description", type: "textarea", placeholder: "Additional context…" },
    {
      key: "projectId", label: "Project", type: "relation",
      endpoint: "/api/entities/project", labelKey: "name", valueKey: "id",
    },
    {
      key: "status", label: "Status", type: "select", required: true,
      options: [
        { value: "todo",        label: "To Do" },
        { value: "in_progress", label: "In Progress" },
        { value: "blocked",     label: "Blocked" },
        { value: "done",        label: "Done" },
      ],
    },
    {
      key: "priority", label: "Priority", type: "select", required: true,
      options: [
        { value: "high",   label: "High" },
        { value: "medium", label: "Medium" },
        { value: "low",    label: "Low" },
      ],
    },
    { key: "dueDate", label: "Due Date", type: "date" },
  ],

  displayName: item => item.title,
  displaySub: item => `${item.status} · ${item.priority}`,

  async list() {
    const rows = await runQuery<{ task: Task }>(`
      MATCH (t:Task)
      OPTIONAL MATCH (t)-[:PART_OF]->(proj:Project)
      WITH t, proj ORDER BY CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, t.createdAt
      RETURN t {.*, projectId: proj.id} AS task
    `)
    return rows.map(r => r.task)
  },

  async get(id) {
    const rows = await runQuery<{ task: Task }>(`
      MATCH (t:Task {id: $id}) RETURN t {.*} AS task
    `, { id })
    return rows[0]?.task ?? null
  },

  async create(data) {
    const id = randomUUID()
    const projectId = (data.projectId as string | undefined) ?? null
    const rows = await runQuery<{ task: Task }>(`
      CREATE (t:Task {id: $id, title: $title, description: $description,
                      status: $status, priority: $priority, dueDate: $dueDate, createdAt: datetime()})
      WITH t
      OPTIONAL MATCH (proj:Project {id: $projectId}) WHERE $projectId IS NOT NULL
      FOREACH (_ IN CASE WHEN proj IS NOT NULL THEN [1] ELSE [] END |
        MERGE (t)-[:PART_OF]->(proj)
      )
      WITH t
      OPTIONAL MATCH (t)-[:PART_OF]->(p:Project)
      RETURN t {.*, projectId: p.id} AS task
    `, {
      id,
      title: data.title ?? "",
      description: data.description ?? null,
      status: data.status ?? "todo",
      priority: data.priority ?? "medium",
      dueDate: data.dueDate ?? null,
      projectId,
    })
    return rows[0].task
  },

  async update(id, data) {
    const projectId = (data.projectId as string | undefined) ?? null
    // Separate projectId from scalar fields — relationships need explicit Cypher
    const { projectId: _pid, ...scalarData } = data
    const rows = await runQuery<{ task: Task }>(`
      MATCH (t:Task {id: $id})
      SET t += $data, t.updatedAt = datetime()
      WITH t
      OPTIONAL MATCH (t)-[r:PART_OF]->(:Project) DELETE r
      WITH t
      OPTIONAL MATCH (proj:Project {id: $projectId}) WHERE $projectId IS NOT NULL
      FOREACH (_ IN CASE WHEN proj IS NOT NULL THEN [1] ELSE [] END |
        MERGE (t)-[:PART_OF]->(proj)
      )
      WITH t
      OPTIONAL MATCH (t)-[:PART_OF]->(p:Project)
      RETURN t {.*, projectId: p.id} AS task
    `, { id, data: scalarData, projectId })
    return rows[0].task
  },

  async delete(id) {
    await runQuery(`MATCH (t:Task {id: $id}) DETACH DELETE t`, { id })
  },
}
