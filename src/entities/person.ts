import { Users } from "lucide-react"
import { randomUUID } from "crypto"
import { runQuery } from "@/lib/neo4j/client"
import type { EntityDef } from "./types"

interface Person extends Record<string, unknown> {
  id: string
  name: string
  email?: string
  role?: string
  mbti?: string
  notes?: string
}

export const personEntity: EntityDef<Person> = {
  type: "Person",
  label: "Person",
  plural: "People",
  icon: Users,
  description: "A professional contact — colleague, client, or collaborator",
  fields: [
    { key: "name",  label: "Name",  type: "text",     required: true, placeholder: "Full name" },
    { key: "email", label: "Email", type: "email",    placeholder: "email@example.com" },
    { key: "role",  label: "Role",  type: "text",     placeholder: "e.g. Product Manager" },
    { key: "mbti",  label: "Myers-Briggs Type", type: "mbti" },
    { key: "notes", label: "Notes", type: "textarea", placeholder: "Anything worth remembering…" },
  ],

  displayName: item => item.name,
  displaySub: item => item.role ?? item.email ?? "",

  async list() {
    const rows = await runQuery<{ person: Person }>(`
      MATCH (p:Person)
      WITH p ORDER BY p.name
      RETURN p {.*} AS person
    `)
    return rows.map(r => r.person)
  },

  async get(id) {
    const rows = await runQuery<{ person: Person }>(`
      MATCH (p:Person {id: $id}) RETURN p {.*} AS person
    `, { id })
    return rows[0]?.person ?? null
  },

  async create(data) {
    const id = randomUUID()
    const rows = await runQuery<{ person: Person }>(`
      CREATE (p:Person {id: $id, name: $name, email: $email, role: $role, mbti: $mbti, notes: $notes, createdAt: datetime()})
      RETURN p {.*} AS person
    `, { id, name: data.name ?? "", email: data.email ?? null, role: data.role ?? null, mbti: data.mbti ?? null, notes: data.notes ?? null })
    return rows[0].person
  },

  async update(id, data) {
    const rows = await runQuery<{ person: Person }>(`
      MATCH (p:Person {id: $id})
      SET p += $data, p.updatedAt = datetime()
      RETURN p {.*} AS person
    `, { id, data })
    return rows[0].person
  },

  async delete(id) {
    await runQuery(`MATCH (p:Person {id: $id}) DETACH DELETE p`, { id })
  },
}
