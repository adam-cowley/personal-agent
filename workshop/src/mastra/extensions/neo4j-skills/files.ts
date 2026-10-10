import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROJECT_ROOT } from '../../memory/files';

/**
 * Skills are folders containing a SKILL.md:
 *
 *   skills/<name>/SKILL.md             approved: the agent can see and load these
 *   skills/_proposed/<name>/SKILL.md   drafted by the agent, waiting for a human
 */
export const SKILLS_DIR = join(PROJECT_ROOT, 'skills');
export const PROPOSED_DIR = join(SKILLS_DIR, '_proposed');

export const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const fileOf = (dir: string, name: string) => join(dir, name, 'SKILL.md');
const field = (md: string, key: string) => md.match(new RegExp(`^${key}: (.*)$`, 'm'))?.[1] ?? '';

function listIn(dir: string) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && NAME_RE.test(d.name) && existsSync(fileOf(dir, d.name)))
    .map((d) => ({ name: d.name, description: field(readFileSync(fileOf(dir, d.name), 'utf8'), 'description') }));
}

export const listApproved = () => listIn(SKILLS_DIR);
export const listProposed = () => listIn(PROPOSED_DIR);

export function readSkill(name: string, proposed = false): string | undefined {
  if (!NAME_RE.test(name)) return undefined;
  const file = fileOf(proposed ? PROPOSED_DIR : SKILLS_DIR, name);
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined;
}

export function writeProposed(skill: { name: string; description: string; instructions: string; traceIds: string[] }) {
  if (existsSync(fileOf(SKILLS_DIR, skill.name))) throw new Error(`Skill "${skill.name}" already exists and is approved.`);
  const file = fileOf(PROPOSED_DIR, skill.name);
  mkdirSync(join(PROPOSED_DIR, skill.name), { recursive: true });
  writeFileSync(
    file,
    `---\nname: ${skill.name}\ndescription: ${skill.description.replace(/\n/g, ' ')}\nstatus: proposed\nderivedFrom: ${skill.traceIds.join(', ')}\n---\n\n${skill.instructions.trim()}\n`,
  );
}

export function approveFile(name: string) {
  if (!readSkill(name, true)) throw new Error(`No proposed skill "${name}".`);
  const md = readFileSync(fileOf(PROPOSED_DIR, name), 'utf8').replace(/^status: proposed$/m, 'status: approved');
  mkdirSync(join(SKILLS_DIR, name), { recursive: true });
  writeFileSync(fileOf(SKILLS_DIR, name), md);
  rmSync(join(PROPOSED_DIR, name), { recursive: true });
}

export function rejectFile(name: string) {
  if (!readSkill(name, true)) throw new Error(`No proposed skill "${name}".`);
  rmSync(join(PROPOSED_DIR, name), { recursive: true });
}

