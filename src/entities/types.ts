import type { LucideIcon } from "lucide-react"

export interface FieldDef {
  key: string
  label: string
  type: "text" | "email" | "textarea" | "select" | "date" | "mbti" | "relation"
  required?: boolean
  placeholder?: string
  options?: Array<{ value: string; label: string }>
  /** For type "relation" — API endpoint to fetch options from */
  endpoint?: string
  /** Key to use as the display label (default: "name") */
  labelKey?: string
  /** Key to use as the option value (default: "id") */
  valueKey?: string
}

export interface EntityDef<T extends Record<string, unknown> = Record<string, unknown>> {
  /** Matches Neo4j label. Used as URL slug and tool prefix. */
  type: string
  label: string
  plural: string
  icon: LucideIcon
  /** Shown in the system prompt so the AI knows what entities exist */
  description: string
  /** Ordered list of fields shown in create/edit forms */
  fields: FieldDef[]

  /** Extract the primary display string from an item */
  displayName: (item: T) => string
  /** Optional secondary display string (role, status, etc.) */
  displaySub?: (item: T) => string

  // ── CRUD operations ──────────────────────────────────────────────────────
  list(): Promise<T[]>
  get(id: string): Promise<T | null>
  create(data: Partial<T>): Promise<T>
  update(id: string, data: Partial<T>): Promise<T>
  delete(id: string): Promise<void>
}
