import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Flat-file memory. Everything the agent remembers by default lives in plain
 * text files under `memory/` so workshop attendees can open, read and edit them.
 *
 *   memory/long-term.md            durable facts, one bullet per fact
 *   memory/short-term/<thread>.md  rolling log of recent conversation turns
 *   memory/traces.jsonl            one JSON line per turn: steps, tool calls, usage
 */

/** `mastra dev` runs from a build dir, so find the project root rather than trusting cwd. */
function findProjectRoot(): string {
  let dir = process.cwd();
  for (;;) {
    const pkg = join(dir, 'package.json');
    if (existsSync(pkg)) {
      try {
        if (JSON.parse(readFileSync(pkg, 'utf8')).name === 'workshop') return dir;
      } catch {
        /* keep walking */
      }
    }
    const parent = dirname(dir);
    if (parent === dir) return process.cwd();
    dir = parent;
  }
}

export const MEMORY_DIR = resolve(process.env.MEMORY_DIR ?? join(findProjectRoot(), 'memory'));
export const LONG_TERM_FILE = join(MEMORY_DIR, 'long-term.md');
export const TRACES_FILE = join(MEMORY_DIR, 'traces.jsonl');

const safe = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, '_');
export const shortTermFile = (threadId: string) => join(MEMORY_DIR, 'short-term', `${safe(threadId)}.md`);

function ensure(file: string, initial = '') {
  mkdirSync(dirname(file), { recursive: true });
  if (!existsSync(file)) writeFileSync(file, initial);
}

// ---- long term -------------------------------------------------------------

export function readLongTerm(): string[] {
  if (!existsSync(LONG_TERM_FILE)) return [];
  return readFileSync(LONG_TERM_FILE, 'utf8')
    .split('\n')
    .filter((l) => l.startsWith('- '))
    .map((l) => l.slice(2));
}

export function appendLongTerm(fact: string) {
  ensure(LONG_TERM_FILE, '# Long-term memory\n\n');
  appendFileSync(LONG_TERM_FILE, `- [${new Date().toISOString().slice(0, 10)}] ${fact.replace(/\n/g, ' ')}\n`);
}

export function forgetLongTerm(needle: string): number {
  if (!existsSync(LONG_TERM_FILE)) return 0;
  const lines = readFileSync(LONG_TERM_FILE, 'utf8').split('\n');
  const kept = lines.filter((l) => !(l.startsWith('- ') && l.toLowerCase().includes(needle.toLowerCase())));
  writeFileSync(LONG_TERM_FILE, kept.join('\n'));
  return lines.length - kept.length;
}

// ---- short term ------------------------------------------------------------

export function appendShortTerm(threadId: string, user: string, assistant: string) {
  const file = shortTermFile(threadId);
  ensure(file, `# Short-term memory (thread ${threadId})\n`);
  appendFileSync(file, `\n## ${new Date().toISOString()}\n**user:** ${user}\n\n**assistant:** ${assistant}\n`);
}

/** The last `turns` exchanges for a thread, as raw markdown. */
export function readShortTerm(threadId: string, turns: number): string {
  const file = shortTermFile(threadId);
  if (!existsSync(file)) return '';
  const entries = readFileSync(file, 'utf8').split('\n## ').slice(1);
  return entries
    .slice(-turns)
    .map((e) => `## ${e}`)
    .join('\n')
    .trim();
}

// ---- traces ----------------------------------------------------------------

export function appendTrace(trace: unknown) {
  ensure(TRACES_FILE);
  appendFileSync(TRACES_FILE, JSON.stringify(trace) + '\n');
}

export function readTraces(limit: number): Record<string, unknown>[] {
  if (!existsSync(TRACES_FILE)) return [];
  return readFileSync(TRACES_FILE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .slice(-limit)
    .map((l) => JSON.parse(l));
}
