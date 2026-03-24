import type { ModelConfig } from "@/lib/models/types"

/**
 * A Skill is a domain-specific capability that Elsie can use.
 *
 * Each skill exposes one or more tool definitions and handler functions.
 * Skills are self-contained modules — add a new file in src/skills/ and register
 * it in the registry to extend Elsie's capabilities.
 *
 * To create a new skill:
 * 1. Create src/skills/<name>/index.ts exporting a Skill object
 * 2. Add Neo4j queries in src/skills/<name>/queries.ts
 * 3. Register in src/lib/skills/registry.ts
 */

export interface ToolDefinition {
  name: string
  description: string
  input_schema: {
    type: "object"
    properties: Record<string, unknown>
    required?: string[]
  }
}

export interface SkillTool {
  definition: ToolDefinition
  /** Handles a tool_use block — receives parsed input, returns string result */
  handler: (input: Record<string, unknown>) => Promise<string>
}

export interface Skill {
  name: string
  description: string
  tools: SkillTool[]
  /**
   * Optional: override the model used when this skill calls Claude internally
   * (e.g. the digest skill which calls Claude to summarize).
   * If omitted, the session model is used.
   */
  model?: ModelConfig
}
