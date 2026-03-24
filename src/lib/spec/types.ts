// ── Graph Spec ────────────────────────────────────────────────────────────────

export interface PropertyDef {
  type: string
  nullable?: boolean
  unique?: boolean
  size?: number
  default?: string | number | boolean
}

export interface IndexDef {
  type: string
  label?: string
  labels?: string[]
  properties: string[]
  options?: Record<string, unknown>
}

export interface ConstraintDef {
  type: string
  label?: string
  properties: string[]
  options?: Record<string, unknown>
}

export interface FieldUiDef {
  key: string
  label: string
  type: "text" | "email" | "textarea" | "select" | "enum" | "date" | "relation"
  required?: boolean
  placeholder?: string
  /** Map form: { value: { label, description? } } — preferred in YAML */
  options?: Record<string, { label: string; description?: string }> | Array<{ value: string; label: string; description?: string }>
  // For type "relation"
  endpoint?: string
  labelKey?: string
  valueKey?: string
  /** References a relationship id in graph.yaml relationships section */
  relationship?: string
}

export interface FieldGroupDef {
  label: string
  fields: string[]
}

export interface NodeUiDef {
  label: string
  plural: string
  /** Product-specific extension (prefixed _ to distinguish from standard spec fields) */
  _icon: string
  displayName: string
  displaySub?: string
  /** Tab groups — fields listed here are shown in named tabs; rest appear above */
  _groups?: FieldGroupDef[]
  fields: FieldUiDef[]
}

export interface NodeExtensions {
  reasoningHint?: string
  ui?: NodeUiDef
  [key: string]: unknown
}

export interface NodeSpec {
  labels: string[]
  properties: Record<string, PropertyDef>
  constraints?: Record<string, ConstraintDef>
  indexes?: Record<string, IndexDef>
  extensions?: NodeExtensions
}

export interface RelationshipExtensions {
  outMinCardinality?: number | string
  outMaxCardinality?: number | string
  inMinCardinality?: number | string
  inMaxCardinality?: number | string
  [key: string]: unknown
}

export interface RelationshipSpec {
  type: string
  from: string
  to: string
  properties?: Record<string, PropertyDef>
  constraints?: Record<string, ConstraintDef>
  indexes?: Record<string, IndexDef>
  extensions?: RelationshipExtensions
}

export interface GraphSpec {
  version: string
  nodes: Record<string, NodeSpec>
  relationships: Record<string, RelationshipSpec>
}

// ── Persona Spec ──────────────────────────────────────────────────────────────

export type PersonaCategory = "default" | "persona" | "coach" | "panel"

export interface PersonaSpec {
  id: string
  name: string
  description: string
  category: PersonaCategory
  mbti?: string | null
  enneagram?: string | null
  provider: "anthropic" | "openai" | "gemini"
  model: string
  welcomeMessage: string
  instructions: string
  /** If true, UI will show the MBTI picker before activating */
  requiresMbtiTarget?: boolean
}
