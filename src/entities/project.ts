import { FolderKanban } from "lucide-react"
import { randomUUID } from "crypto"
import { runQuery } from "@/lib/neo4j/client"
import type { EntityDef } from "./types"

interface Project extends Record<string, unknown> {
  id: string
  name: string
  description?: string
  status: string
}

export const projectEntity: EntityDef<Project> = {
  type: "Project",
  label: "Project",
  plural: "Projects",
  icon: FolderKanban,
  description: "A time-boxed initiative or workstream with goals, members, and tasks",
  fields: [
    { key: "name",        label: "Name",        type: "text",     required: true, placeholder: "Project name" },
    { key: "description", label: "Description", type: "textarea", placeholder: "What is this project about?" },
    {
      key: "status", label: "Status", type: "select", required: true,
      options: [
        { value: "active",    label: "Active" },
        { value: "paused",    label: "Paused" },
        { value: "completed", label: "Completed" },
        { value: "cancelled", label: "Cancelled" },
      ],
    },
  ],

  displayName: item => item.name,
  displaySub: item => item.status,

  async list() {
    const rows = await runQuery<{ project: Project }>(`
      MATCH (p:Project) WITH p ORDER BY p.name RETURN p {.*} AS project
    `)
    return rows.map(r => r.project)
  },

  async get(id) {
    const rows = await runQuery<{ project: Project }>(`
      MATCH (p:Project {id: $id}) RETURN p {.*} AS project
    `, { id })
    return rows[0]?.project ?? null
  },

  async create(data) {
    const id = randomUUID()
    const rows = await runQuery<{ project: Project }>(`
      CREATE (p:Project {id: $id, name: $name, description: $description, status: $status, createdAt: datetime()})
      RETURN p {.*} AS project
    `, { id, name: data.name ?? "", description: data.description ?? null, status: data.status ?? "active" })
    return rows[0].project
  },

  async update(id, data) {
    const rows = await runQuery<{ project: Project }>(`
      MATCH (p:Project {id: $id})
      SET p += $data, p.updatedAt = datetime()
      RETURN p {.*} AS project
    `, { id, data })
    return rows[0].project
  },

  async delete(id) {
    await runQuery(`MATCH (p:Project {id: $id}) DETACH DELETE p`, { id })
  },
}
