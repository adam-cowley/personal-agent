import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { PROJECT_ROOT } from '../../memory/files';

/**
 * A workflow is plain data: an ordered list of tool calls.
 *
 *   workflows/<name>.json            approved: the agent can run these
 *   workflows/_proposed/<name>.json  drafted by the agent, waiting for a human
 *
 * Argument values can be templates, resolved when the workflow runs:
 *   "{{inputs.city}}"        a value the caller passes in
 *   "{{steps.0.now}}"        a field from the output of step 0
 */
export const WORKFLOWS_DIR = join(PROJECT_ROOT, 'workflows');
export const PROPOSED_DIR = join(WORKFLOWS_DIR, '_proposed');

export const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const workflowSpec = z.object({
  name: z.string().regex(NAME_RE).describe('kebab-case, e.g. city-time-report'),
  description: z.string().describe('One line: when should this workflow be used?'),
  inputs: z
    .array(z.object({ name: z.string().regex(/^[a-zA-Z0-9_]+$/), description: z.string(), type: z.enum(['string', 'number']).default('string') }))
    .default([]),
  steps: z
    .array(z.object({ tool: z.string(), args: z.record(z.string(), z.unknown()).default({}) }))
    .min(1)
    .describe('Tool calls in order. Use "{{inputs.x}}" and "{{steps.N.field}}" in args.'),
  traceIds: z.array(z.string()).min(1).describe('ids of the traces this is based on'),
});
export type WorkflowSpec = z.infer<typeof workflowSpec>;

const fileOf = (dir: string, name: string) => join(dir, `${name}.json`);

function listIn(dir: string): WorkflowSpec[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json') && NAME_RE.test(f.slice(0, -5)))
    .map((f) => workflowSpec.parse(JSON.parse(readFileSync(join(dir, f), 'utf8'))));
}

export const listApproved = () => listIn(WORKFLOWS_DIR);
export const listProposed = () => listIn(PROPOSED_DIR);

export function readWorkflow(name: string, proposed = false): WorkflowSpec | undefined {
  if (!NAME_RE.test(name)) return undefined;
  const file = fileOf(proposed ? PROPOSED_DIR : WORKFLOWS_DIR, name);
  return existsSync(file) ? workflowSpec.parse(JSON.parse(readFileSync(file, 'utf8'))) : undefined;
}

export function writeProposed(spec: WorkflowSpec) {
  if (existsSync(fileOf(WORKFLOWS_DIR, spec.name))) throw new Error(`Workflow "${spec.name}" already exists and is approved.`);
  mkdirSync(PROPOSED_DIR, { recursive: true });
  writeFileSync(fileOf(PROPOSED_DIR, spec.name), JSON.stringify(spec, null, 2) + '\n');
}

export function approveFile(name: string) {
  const spec = readWorkflow(name, true);
  if (!spec) throw new Error(`No proposed workflow "${name}".`);
  mkdirSync(WORKFLOWS_DIR, { recursive: true });
  writeFileSync(fileOf(WORKFLOWS_DIR, name), JSON.stringify(spec, null, 2) + '\n');
  rmSync(fileOf(PROPOSED_DIR, name));
}

export function rejectFile(name: string) {
  if (!readWorkflow(name, true)) throw new Error(`No proposed workflow "${name}".`);
  rmSync(fileOf(PROPOSED_DIR, name));
}

// ---- templates -------------------------------------------------------------

const WHOLE = /^\{\{\s*([^}]+?)\s*\}\}$/;
const EMBEDDED = /\{\{\s*([^}]+?)\s*\}\}/g;

function lookup(path: string, scope: Record<string, unknown>): unknown {
  return path.split('.').reduce<unknown>((v, key) => (v == null ? undefined : (v as Record<string, unknown>)[key]), scope);
}

/** Resolve templates in a value. A string that is exactly one template keeps the original type. */
export function resolve(value: unknown, scope: Record<string, unknown>): unknown {
  if (typeof value === 'string') {
    const whole = value.match(WHOLE);
    if (whole) return lookup(whole[1], scope);
    return value.replace(EMBEDDED, (_, p) => String(lookup(p, scope) ?? ''));
  }
  if (Array.isArray(value)) return value.map((v) => resolve(v, scope));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v, scope)]));
  return value;
}

/** Every template path used in a value, so a draft can be validated before it is saved. */
export function templatePaths(value: unknown): string[] {
  if (typeof value === 'string') return [...value.matchAll(EMBEDDED)].map((m) => m[1]);
  if (Array.isArray(value)) return value.flatMap(templatePaths);
  if (value && typeof value === 'object') return Object.values(value).flatMap(templatePaths);
  return [];
}
