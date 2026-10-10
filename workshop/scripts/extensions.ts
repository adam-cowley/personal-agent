/**
 * Workshop helper:
 *   npm run ext                      list extensions and whether they're on
 *   npm run ext -- enable <id>       switch an extension on (edits .env)
 *   npm run ext -- disable <id>      switch it off
 *   npm run ext -- setup             create Neo4j constraints/indexes for enabled extensions
 *   npm run ext -- check             test the Neo4j connection
 *   npm run ext -- skills [show|approve|reject <name>]      review skills the agent proposed
 *   npm run ext -- workflows [show|approve|reject <name>]   review workflows the agent proposed
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { ALL_EXTENSIONS, activeExtensions } from '../src/mastra/extensions';
import { EXTENSION_IDS, enabledIds, type ExtensionId } from '../src/mastra/extensions/registry';
import { closeDriver, getDriver } from '../src/mastra/extensions/neo4j';
import { approveSkill, rejectSkill } from '../src/mastra/extensions/neo4j-skills';
import { listProposed, readSkill } from '../src/mastra/extensions/neo4j-skills/files';
import { approveWorkflow, rejectWorkflow } from '../src/mastra/extensions/neo4j-workflows';
import { listProposed as listProposedWf, readWorkflow } from '../src/mastra/extensions/neo4j-workflows/files';

const ENV_FILE = '.env';

function writeEnabled(ids: ExtensionId[]) {
  const line = `EXTENSIONS=${ids.join(',')}`;
  const text = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8') : '';
  const next = /^EXTENSIONS=.*$/m.test(text) ? text.replace(/^EXTENSIONS=.*$/m, line) : `${text}${text.endsWith('\n') || !text ? '' : '\n'}${line}\n`;
  writeFileSync(ENV_FILE, next);
}

function resolveId(input?: string): ExtensionId {
  // Accept "short-term" as shorthand for "neo4j-short-term".
  const id = [input, `neo4j-${input}`].find((c) => (EXTENSION_IDS as readonly string[]).includes(c ?? ''));
  if (!id) throw new Error(`Pick one of: ${EXTENSION_IDS.join(', ')}`);
  return id as ExtensionId;
}

async function main() {
  const [cmd = 'list', arg] = process.argv.slice(2);
  switch (cmd) {
    case 'list': {
      const on = enabledIds();
      for (const id of EXTENSION_IDS) {
        const e = ALL_EXTENSIONS[id];
        console.log(`${on.includes(id) ? '[x]' : '[ ]'} ${id.padEnd(22)} ${e.description}`);
      }
      return;
    }
    case 'enable':
    case 'disable': {
      const id = resolveId(arg);
      const on = new Set(enabledIds());
      cmd === 'enable' ? on.add(id) : on.delete(id);
      writeEnabled(EXTENSION_IDS.filter((x) => on.has(x)));
      console.log(`${cmd === 'enable' ? 'Enabled' : 'Disabled'} ${id}. Restart the dev server to pick it up.`);
      if (cmd === 'enable') console.log('Run `npm run ext -- setup` once to create its Neo4j constraints.');
      return;
    }
    case 'setup': {
      for (const e of activeExtensions()) {
        console.log(`Setting up ${e.id}…`);
        await e.setup?.();
      }
      console.log('Done.');
      return;
    }
    case 'check': {
      await getDriver().verifyConnectivity();
      console.log('Connected to Neo4j.');
      return;
    }
    case 'skills': {
      const [sub, name] = process.argv.slice(3);
      if (!sub) {
        const drafts = listProposed();
        console.log(drafts.length ? drafts.map((d) => `${d.name}: ${d.description}`).join('\n') : 'No proposed skills.');
      } else if (sub === 'show') {
        console.log(readSkill(name, true) ?? `No proposed skill "${name}".`);
      } else if (sub === 'approve') {
        await approveSkill(name);
        console.log(`Approved ${name}. The agent can load it from the next turn.`);
      } else if (sub === 'reject') {
        await rejectSkill(name);
        console.log(`Rejected ${name}.`);
      } else throw new Error('Usage: skills [show|approve|reject <name>]');
      return;
    }
    case 'workflows': {
      const [sub, name] = process.argv.slice(3);
      if (!sub) {
        const drafts = listProposedWf();
        console.log(drafts.length ? drafts.map((d) => `${d.name}: ${d.description} (${d.steps.map((s) => s.tool).join(' -> ')})`).join('\n') : 'No proposed workflows.');
      } else if (sub === 'show') {
        const w = readWorkflow(name, true);
        console.log(w ? JSON.stringify(w, null, 2) : `No proposed workflow "${name}".`);
      } else if (sub === 'approve') {
        await approveWorkflow(name);
        console.log(`Approved ${name}. The agent can run it from the next turn.`);
      } else if (sub === 'reject') {
        await rejectWorkflow(name);
        console.log(`Rejected ${name}.`);
      } else throw new Error('Usage: workflows [show|approve|reject <name>]');
      return;
    }
    default:
      throw new Error(`Unknown command "${cmd}". Try: list | enable <id> | disable <id> | setup | check | skills | workflows`);
  }
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => closeDriver());
