/**
 * YAML spec loaders — server-only (uses fs).
 * Cached after first load; restart dev server to pick up changes.
 */

import "server-only"
import { readFileSync, readdirSync } from "fs"
import { join } from "path"
import yaml from "js-yaml"
import type { GraphSpec, PersonaSpec } from "./types"

const CONFIG_DIR = join(process.cwd(), "config")

let _graphSpec: GraphSpec | null = null
let _personaSpecs: PersonaSpec[] | null = null

export function loadGraphSpec(): GraphSpec {
  if (_graphSpec) return _graphSpec
  const raw = readFileSync(join(CONFIG_DIR, "graph.yaml"), "utf-8")
  _graphSpec = yaml.load(raw) as GraphSpec
  return _graphSpec
}

export function loadPersonaSpecs(): PersonaSpec[] {
  if (_personaSpecs) return _personaSpecs
  const dir = join(CONFIG_DIR, "personas")
  const files = readdirSync(dir).filter(f => f.endsWith(".yaml") || f.endsWith(".yml"))
  _personaSpecs = files.map(f => {
    const raw = readFileSync(join(dir, f), "utf-8")
    return yaml.load(raw) as PersonaSpec
  })
  // Keep default first, then alphabetical
  _personaSpecs.sort((a, b) => {
    if (a.category === "default") return -1
    if (b.category === "default") return 1
    return a.name.localeCompare(b.name)
  })
  return _personaSpecs
}

export function loadPersonaSpec(id: string): PersonaSpec | undefined {
  return loadPersonaSpecs().find(p => p.id === id)
}

/** Reset cache — useful in tests or hot-reload scenarios */
export function resetSpecCache() {
  _graphSpec = null
  _personaSpecs = null
}
