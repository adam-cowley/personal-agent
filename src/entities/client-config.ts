/**
 * Client-safe entity configuration — no server imports (no Neo4j, no crypto).
 * Used for rendering forms and dialogs on the client side.
 */

import { Users, FolderKanban, CheckSquare, Box } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { FieldDef, EntityDef } from "./types"

export interface ClientEntityConfig {
  type: string
  label: string
  plural: string
  icon: LucideIcon
  fields: FieldDef[]
}

const personFields: FieldDef[] = [
  { key: "name",  label: "Name",  type: "text",     required: true, placeholder: "Full name" },
  { key: "email", label: "Email", type: "email",    placeholder: "email@example.com" },
  { key: "role",  label: "Role",  type: "text",     placeholder: "e.g. Product Manager" },
  { key: "mbti",  label: "Myers-Briggs Type", type: "mbti" },
  { key: "notes", label: "Notes", type: "textarea", placeholder: "Anything worth remembering…" },
]

const projectFields: FieldDef[] = [
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
]

const taskFields: FieldDef[] = [
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
]

const CLIENT_ENTITIES: ClientEntityConfig[] = [
  { type: "person",  label: "Person",  plural: "People",   icon: Users,        fields: personFields },
  { type: "project", label: "Project", plural: "Projects", icon: FolderKanban, fields: projectFields },
  { type: "task",    label: "Task",    plural: "Tasks",    icon: CheckSquare,  fields: taskFields },
]

export function getClientEntity(type: string): ClientEntityConfig | undefined {
  return CLIENT_ENTITIES.find(e => e.type.toLowerCase() === type.toLowerCase())
}

/** Build a minimal EntityDef stub for EntityDialog — CRUD methods call the API, not Neo4j */
export function makeEntityDef(config: ClientEntityConfig): EntityDef<Record<string, unknown>> {
  return {
    type: config.type,
    label: config.label,
    plural: config.plural,
    icon: config.icon,
    description: "",
    fields: config.fields,
    displayName: item => String(item.name ?? item.title ?? item.id ?? ""),
    displaySub: item => String(item.status ?? item.role ?? ""),
    list: async () => [],
    get: async () => null,
    create: async () => ({}),
    update: async () => ({}),
    delete: async () => {},
  }
}
