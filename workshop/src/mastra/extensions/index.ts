import { enabledIds, type ExtensionId } from './registry';
import type { Extension } from './types';
import { neo4jContextTraces } from './neo4j-context-traces';
import { neo4jLongTerm } from './neo4j-long-term';
import { neo4jShortTerm } from './neo4j-short-term';
import { neo4jSkills } from './neo4j-skills';

/** Every extension in the workshop, in the order attendees enable them. */
export const ALL_EXTENSIONS: Record<ExtensionId, Extension> = {
  'neo4j-short-term': neo4jShortTerm,
  'neo4j-long-term': neo4jLongTerm,
  'neo4j-context-traces': neo4jContextTraces,
  'neo4j-skills': neo4jSkills,
};

/** The extensions currently switched on via the EXTENSIONS env var. */
export function activeExtensions(): Extension[] {
  const ids = enabledIds();
  const missing = ids.flatMap((id) => (ALL_EXTENSIONS[id].requires ?? []).filter((v) => !process.env[v]).map((v) => `${id}: ${v}`));
  if (missing.length) throw new Error(`Missing environment variables for enabled extensions:\n  ${missing.join('\n  ')}`);
  if (ids.includes('neo4j-skills') && !ids.includes('neo4j-context-traces')) {
    throw new Error('neo4j-skills builds skills from traces: also enable neo4j-context-traces.');
  }
  return ids.map((id) => ALL_EXTENSIONS[id]);
}
