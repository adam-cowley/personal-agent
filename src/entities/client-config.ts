/**
 * Client-safe entity configuration.
 * Loaded from /api/spec at runtime — no server imports (no Neo4j, no crypto).
 * Used for rendering forms and dialogs on the client side.
 */

import { getIcon } from "@/lib/spec/icon-map"
import type { LucideIcon } from "lucide-react"
import type { FieldDef, EntityDef, FieldGroup } from "./types"

export interface FieldGroup {
  label: string
  fields: string[]
}

export interface ClientEntityConfig {
  type: string
  label: string
  plural: string
  iconName: string
  fields: FieldDef[]
  groups?: FieldGroup[]
}

export function getClientIcon(iconName: string): LucideIcon {
  return getIcon(iconName)
}

/** Build a minimal EntityDef stub for EntityDialog — CRUD methods call the API, not Neo4j */
export function makeEntityDef(config: ClientEntityConfig): EntityDef<Record<string, unknown>> {
  return {
    type: config.type,
    label: config.label,
    plural: config.plural,
    icon: getIcon(config.iconName),
    description: "",
    fields: config.fields,
    groups: config.groups,
    displayName: item => String(item.name ?? item.title ?? item.id ?? ""),
    displaySub: item => String(item.status ?? item.role ?? ""),
    list: async () => [],
    get: async () => null,
    create: async () => ({}),
    update: async () => ({}),
    delete: async () => {},
  }
}
