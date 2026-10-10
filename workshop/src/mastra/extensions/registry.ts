/**
 * Which extensions are switched on. Set in `.env`:
 *
 *   EXTENSIONS=neo4j-short-term,neo4j-long-term,neo4j-context-traces
 *
 * or use `npm run ext -- enable neo4j-short-term`.
 *
 * This file only holds the ids so that core code can ask "is X on?" without
 * importing the extensions themselves (and, with them, the Neo4j driver).
 */
export const EXTENSION_IDS = ['neo4j-short-term', 'neo4j-long-term', 'neo4j-context-traces', 'neo4j-skills', 'neo4j-workflows'] as const;
export type ExtensionId = (typeof EXTENSION_IDS)[number];

export function enabledIds(): ExtensionId[] {
  const requested = (process.env.EXTENSIONS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const unknown = requested.filter((id) => !(EXTENSION_IDS as readonly string[]).includes(id));
  if (unknown.length) {
    throw new Error(`Unknown extension(s) in EXTENSIONS: ${unknown.join(', ')}. Available: ${EXTENSION_IDS.join(', ')}`);
  }
  return requested as ExtensionId[];
}

export const isEnabled = (id: ExtensionId) => enabledIds().includes(id);
