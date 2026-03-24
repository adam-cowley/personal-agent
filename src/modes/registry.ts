import { defaultMode } from "./builtin/default"
import { steveJobsMode, socraticMode, devilsAdvocateMode } from "./builtin/personas"
import { mbtiCoachMode } from "./builtin/mbti-coach"
import { boardMode } from "./builtin/board"
import type { Mode } from "./types"

export const modes: Mode[] = [
  defaultMode,
  steveJobsMode,
  socraticMode,
  devilsAdvocateMode,
  mbtiCoachMode,
  boardMode,
]

export function getMode(id: string): Mode | undefined {
  return modes.find(m => m.id === id)
}

export const DEFAULT_MODE_ID = "default"
