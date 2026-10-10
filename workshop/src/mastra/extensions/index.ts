import { enabledIds, type ExtensionId } from './registry';
import type { Extension } from './types';
import { neo4jContextTraces } from './neo4j-context-traces';
import { neo4jLongTerm } from './neo4j-long-term';
import { neo4jShortTerm } from './neo4j-short-term';

/** Every extension in the workshop, in the order attendees enable them. */
export const ALL_EXTENSIONS: Record<ExtensionId, Extension> = {
  'neo4j-short-term': neo4jShortTerm,
  'neo4j-long-term': neo4jLongTerm,
  'neo4j-context-traces': neo4jContextTraces,
};

/** The extensions currently switched on via the EXTENSIONS env var. */
export function activeExtensions(): Extension[] {
  const ids = enabledIds();
  const missing = ids.flatMap((id) => (ALL_EXTENSIONS[id].requires ?? []).filter((v) => !process.env[v]).map((v) => `${id}: ${v}`));
  if (missing.length) throw new Error(`Missing environment variables for enabled extensions:\n  ${missing.join('\n  ')}`);
  return ids.map((id) => ALL_EXTENSIONS[id]);
}
