import { createStep, createWorkflow } from '@mastra/core/workflows';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { run, safely } from '../neo4j';
import type { Extension, InputProc } from '../types';
import { approveFile, listApproved, readWorkflow, rejectFile, resolve, templatePaths, workflowSpec, writeProposed } from './files';

/**
 * WORKFLOWS FROM TRACES (review-gated)
 *
 * Where a skill is advice the model may follow, a workflow is a fixed sequence of
 * tool calls that runs the same way every time, as a real Mastra workflow assembled
 * from stored data (never generated code).
 *
 * The agent drafts one with `propose_workflow` from the tool calls in its traces.
 * A human reviews it:
 *
 *   npm run ext -- workflows                list drafts
 *   npm run ext -- workflows show <name>    read one
 *   npm run ext -- workflows approve <name> make it runnable via run_workflow
 *   npm run ext -- workflows reject <name>
 *
 * Graph:  (:Workflow)-[:DERIVED_FROM]->(:Trace),  (:Workflow)-[:HAS_STEP]->(:WorkflowStep)
 */

/** Tools a workflow step may not call: the ones that create or run workflows and skills. */
const BLOCKED = new Set(['propose_workflow', 'run_workflow', 'propose_skill']);

type AnyTool = { execute?: (input: unknown, ctx: unknown) => Promise<unknown> };
type MastraLike = { getAgent: (id: string) => { listTools: () => Promise<Record<string, AnyTool>> } };

async function availableTools(mastra: MastraLike | undefined) {
  if (!mastra) throw new Error('No Mastra instance available to look up tools.');
  const tools = await mastra.getAgent('agent').listTools();
  return Object.fromEntries(Object.entries(tools).filter(([name]) => !BLOCKED.has(name)));
}

const injectWorkflows: InputProc = {
  id: 'neo4j-workflows',
  processInput({ messageList }) {
    const flows = listApproved();
    if (flows.length) {
      const line = (w: (typeof flows)[number]) =>
        `- ${w.name}(${w.inputs.map((i) => i.name).join(', ')}): ${w.description}`;
      messageList.addSystem(`Approved workflows you can run with run_workflow:\n${flows.map(line).join('\n')}`, 'neo4j-workflows');
    }
    return messageList;
  },
};

const tools = {
  propose_workflow: createTool({
    id: 'propose_workflow',
    description:
      'Draft a reusable workflow, a fixed sequence of tool calls, from a pattern in your traces. Call review_traces first and pass the trace ids. The draft is saved for human review and cannot be run until approved.',
    inputSchema: workflowSpec,
    execute: async (spec, { mastra }) => {
      const known = await availableTools(mastra as MastraLike | undefined);
      const inputNames = new Set(spec.inputs.map((i) => i.name));
      const problems: string[] = [];
      spec.steps.forEach((step, i) => {
        if (!(step.tool in known)) problems.push(`step ${i}: unknown or blocked tool "${step.tool}" (available: ${Object.keys(known).join(', ')})`);
        for (const p of templatePaths(step.args)) {
          const [root, idx] = p.split('.');
          if (root === 'inputs' && !inputNames.has(idx)) problems.push(`step ${i}: "{{${p}}}" is not a declared input`);
          else if (root === 'steps' && !(Number(idx) < i)) problems.push(`step ${i}: "{{${p}}}" must refer to an earlier step`);
          else if (root !== 'inputs' && root !== 'steps') problems.push(`step ${i}: "{{${p}}}" must start with inputs. or steps.`);
        }
      });
      if (problems.length) return { error: 'Draft not saved.', problems };

      writeProposed(spec);
      await safely(
        'neo4j-workflows',
        async () => {
          await run(
            `MERGE (w:Workflow {name: $name})
             SET w.description = $description, w.status = 'proposed', w.updatedAt = $at
             WITH w
             OPTIONAL MATCH (w)-[:HAS_STEP]->(old:WorkflowStep)
             DETACH DELETE old
             WITH DISTINCT w
             UNWIND range(0, size($steps) - 1) AS i
             CREATE (w)-[:HAS_STEP]->(:WorkflowStep {index: i, tool: $steps[i].tool, args: $steps[i].args})`,
            {
              name: spec.name,
              description: spec.description,
              at: new Date().toISOString(),
              steps: spec.steps.map((s) => ({ tool: s.tool, args: JSON.stringify(s.args) })),
            },
          );
          await run(
            `MATCH (w:Workflow {name: $name})
             UNWIND $traceIds AS tid
             MATCH (t:Trace {id: tid})
             MERGE (w)-[:DERIVED_FROM]->(t)`,
            { name: spec.name, traceIds: spec.traceIds },
          );
        },
        undefined,
      );
      return { saved: `workflows/_proposed/${spec.name}.json`, status: 'proposed — waiting for a human to approve it' };
    },
  }),

  run_workflow: createTool({
    id: 'run_workflow',
    description: 'Run an approved workflow by name with its inputs. Returns the output of every step.',
    inputSchema: z.object({ name: z.string(), inputs: z.record(z.string(), z.union([z.string(), z.number()])).default({}) }),
    execute: async ({ name, inputs }, { mastra }) => {
      const spec = readWorkflow(name);
      if (!spec) return { error: `No approved workflow named "${name}".` };
      const missing = spec.inputs.filter((i) => !(i.name in inputs)).map((i) => i.name);
      if (missing.length) return { error: `Missing inputs: ${missing.join(', ')}` };

      const known = await availableTools(mastra as MastraLike | undefined);
      const scope = { inputs, steps: [] as unknown[] };

      const steps = spec.steps.map((s, i) =>
        createStep({
          id: `step-${i}-${s.tool}`,
          inputSchema: z.any(),
          outputSchema: z.any(),
          execute: async () => {
            const tool = known[s.tool];
            if (!tool?.execute) throw new Error(`Tool "${s.tool}" is no longer available.`);
            const out = await tool.execute(resolve(s.args, scope), {});
            scope.steps[i] = out;
            return out;
          },
        }),
      );

      let wf = createWorkflow({ id: `wf-${spec.name}`, inputSchema: z.any(), outputSchema: z.any() });
      for (const step of steps) wf = wf.then(step) as typeof wf;
      wf.commit();

      const result = await (await wf.createRun()).start({ inputData: inputs });
      if (result.status !== 'success') return { error: `Workflow ${result.status}`, steps: scope.steps, detail: 'error' in result ? String(result.error) : undefined };
      return { steps: scope.steps };
    },
  }),
};

const setStatus = (name: string, status: 'approved' | 'rejected') =>
  safely('neo4j-workflows', () => run('MATCH (w:Workflow {name: $name}) SET w.status = $status, w.reviewedAt = $at', { name, status, at: new Date().toISOString() }), undefined);

export async function approveWorkflow(name: string) {
  approveFile(name);
  await setStatus(name, 'approved');
}
export async function rejectWorkflow(name: string) {
  rejectFile(name);
  await setStatus(name, 'rejected');
}

export const neo4jWorkflows: Extension = {
  id: 'neo4j-workflows',
  title: 'Workflows from traces (review-gated)',
  description: 'The agent turns repeated tool-call sequences from its traces into workflows; a human approves them before they can run.',
  requires: ['NEO4J_URI', 'NEO4J_USERNAME', 'NEO4J_PASSWORD'],
  inputProcessors: [injectWorkflows],
  tools,
  instructions:
    'You can turn repeated multi-step tool sequences into workflows. When you spot one, call review_traces, then propose_workflow with the trace ids: ordered tool steps whose args use {{inputs.x}} and {{steps.N.field}} templates. Proposed workflows are reviewed by a human; only run those listed as approved, via run_workflow.',
  setup: async () => {
    await run('CREATE CONSTRAINT workflow_name IF NOT EXISTS FOR (w:Workflow) REQUIRE w.name IS UNIQUE');
  },
};
