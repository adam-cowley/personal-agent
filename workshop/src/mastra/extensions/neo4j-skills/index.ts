import type { InputProc, Extension } from '../types';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { run, safely } from '../neo4j';
import { NAME_RE, approveFile, listApproved, readSkill, rejectFile, writeProposed } from './files';

/**
 * SKILLS FROM TRACES (review-gated)
 *
 * The agent looks at how it solved things before (`review_traces`), then drafts a
 * reusable skill with `propose_skill`. Drafts are NOT usable until a human approves:
 *
 *   npm run ext -- skills                list drafts
 *   npm run ext -- skills show <name>    read one
 *   npm run ext -- skills approve <name> move it into skills/ (agent can now load it)
 *   npm run ext -- skills reject <name>  discard it
 *
 * Provenance lives in the graph:  (:Skill)-[:DERIVED_FROM]->(:Trace)
 * with Skill.status = 'proposed' | 'approved' | 'rejected'.
 */
const injectSkills: InputProc = {
  id: 'neo4j-skills',
  processInput({ messageList }) {
    const skills = listApproved();
    if (skills.length) {
      messageList.addSystem(
        `Approved skills you can load with load_skill when a request matches:\n${skills.map((s) => `- ${s.name}: ${s.description}`).join('\n')}`,
        'neo4j-skills',
      );
    }
    return messageList;
  },
};

const tools = {
  load_skill: createTool({
    id: 'load_skill',
    description: 'Load the full instructions of an approved skill by name, then follow them.',
    inputSchema: z.object({ name: z.string() }),
    execute: async ({ name }) => readSkill(name) ?? { error: `No approved skill named "${name}".` },
  }),

  propose_skill: createTool({
    id: 'propose_skill',
    description:
      'Draft a reusable skill from how you solved something before. Call review_traces first and pass the trace ids it returned. The draft is saved for human review and cannot be used until approved.',
    inputSchema: z.object({
      name: z.string().regex(NAME_RE).describe('kebab-case, e.g. timezone-lookup'),
      description: z.string().describe('One line: when should this skill be used?'),
      instructions: z.string().describe('Markdown steps to follow, naming the tools to call and what to pass them.'),
      traceIds: z.array(z.string()).min(1).describe('ids of the traces this skill is based on'),
    }),
    execute: async (skill) => {
      writeProposed(skill);
      await safely(
        'neo4j-skills',
        () =>
          run(
            `MERGE (s:Skill {name: $name})
             SET s.description = $description, s.status = 'proposed', s.updatedAt = $at
             WITH s
             UNWIND $traceIds AS tid
             MATCH (t:Trace {id: tid})
             MERGE (s)-[:DERIVED_FROM]->(t)`,
            { name: skill.name, description: skill.description, traceIds: skill.traceIds, at: new Date().toISOString() },
          ),
        undefined,
      );
      return { saved: `skills/_proposed/${skill.name}/SKILL.md`, status: 'proposed — waiting for a human to approve it' };
    },
  }),
};

const setStatus = (name: string, status: 'approved' | 'rejected') =>
  safely('neo4j-skills', () => run('MATCH (s:Skill {name: $name}) SET s.status = $status, s.reviewedAt = $at', { name, status, at: new Date().toISOString() }), undefined);

export async function approveSkill(name: string) {
  approveFile(name);
  await setStatus(name, 'approved');
}
export async function rejectSkill(name: string) {
  rejectFile(name);
  await setStatus(name, 'rejected');
}

export const neo4jSkills: Extension = {
  id: 'neo4j-skills',
  title: 'Skills from traces (review-gated)',
  description: 'The agent drafts reusable skills from its traces; a human approves them before the agent can use them.',
  requires: ['NEO4J_URI', 'NEO4J_USERNAME', 'NEO4J_PASSWORD'],
  inputProcessors: [injectSkills],
  tools,
  instructions:
    'You can learn reusable skills. When you notice you solved something before in a way worth repeating, call review_traces, then propose_skill with the trace ids. Proposed skills are reviewed by a human; do not claim a skill is active until it appears in your approved skills list. Use load_skill when a listed skill fits the request.',
  setup: async () => {
    await run('CREATE CONSTRAINT skill_name IF NOT EXISTS FOR (s:Skill) REQUIRE s.name IS UNIQUE');
  },
};
