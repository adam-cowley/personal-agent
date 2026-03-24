import type { Skill, SkillTool } from "./types"
import { peopleSkill } from "@/skills/people"
import { projectsSkill } from "@/skills/projects"
import { tasksSkill } from "@/skills/tasks"
import { digestSkill } from "@/skills/digest"
import { interactionsSkill } from "@/skills/interactions"

const skills: Skill[] = [
  peopleSkill,
  projectsSkill,
  tasksSkill,
  digestSkill,
  interactionsSkill,
]

/** All Claude tool definitions from all registered skills */
export function getAllToolDefinitions() {
  return skills.flatMap(s => s.tools.map(t => t.definition))
}

/** All skill tools (definition + handler) from all registered skills */
export function getAllSkillTools(): SkillTool[] {
  return skills.flatMap(s => s.tools)
}

/** Look up a handler by tool name across all skills */
export function getToolHandler(toolName: string): SkillTool["handler"] | null {
  for (const skill of skills) {
    const tool = skill.tools.find(t => t.definition.name === toolName)
    if (tool) return tool.handler
  }
  return null
}

export { skills }
