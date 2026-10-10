import neo4j, { type Driver } from 'neo4j-driver';

let driver: Driver | undefined;

/** Lazily-created shared driver. Reads NEO4J_URI / NEO4J_USERNAME / NEO4J_PASSWORD / NEO4J_DATABASE. */
export function getDriver(): Driver {
  if (!driver) {
    const { NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD } = process.env;
    if (!NEO4J_URI || !NEO4J_USERNAME || !NEO4J_PASSWORD) {
      throw new Error('Set NEO4J_URI, NEO4J_USERNAME and NEO4J_PASSWORD in .env to use the Neo4j extensions.');
    }
    driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD));
  }
  return driver;
}

export async function run<T = Record<string, unknown>>(cypher: string, params: Record<string, unknown> = {}): Promise<T[]> {
  const session = getDriver().session({ database: process.env.NEO4J_DATABASE || undefined });
  try {
    const res = await session.run(cypher, params);
    return res.records.map((r) => r.toObject() as T);
  } finally {
    await session.close();
  }
}

/** Convert Neo4j integers/dates in a result to plain JS so they serialise cleanly. */
export const toPlain = <T>(v: T): T => JSON.parse(JSON.stringify(v, (_, x) => (neo4j.isInt(x) ? x.toNumber() : x)));

/**
 * Memory must never take the agent down: if Neo4j is unreachable, log and carry on
 * (the flat files are still written).
 */
export async function safely<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[${label}] Neo4j unavailable: ${(err as Error).message}`);
    return fallback;
  }
}

export async function closeDriver() {
  await driver?.close();
  driver = undefined;
}
