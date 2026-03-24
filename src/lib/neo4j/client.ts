import neo4j, { Driver, Session, isDate, isDateTime, isLocalDateTime, isLocalTime, isTime, isDuration, isInt, isPoint } from 'neo4j-driver'

let driver: Driver | null = null

export function getDriver(): Driver {
  if (!driver) {
    const uri = process.env.NEO4J_URI || 'bolt://localhost:7687'
    const user = process.env.NEO4J_USER || 'neo4j'
    const password = process.env.NEO4J_PASSWORD || 'password'
    driver = neo4j.driver(uri, neo4j.auth.basic(user, password))
  }
  return driver
}

/** Recursively convert Neo4j proprietary types to plain JS values (results → client) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deserialize(val: unknown): any {
  if (val === null || val === undefined) return val
  if (isInt(val)) return val.toNumber()
  if (isDateTime(val) || isLocalDateTime(val)) return val.toString()
  if (isDate(val)) return val.toString()
  if (isTime(val) || isLocalTime(val)) return val.toString()
  if (isDuration(val)) return val.toString()
  if (isPoint(val)) return { x: val.x, y: val.y, z: val.z, srid: val.srid }
  if (Array.isArray(val)) return val.map(deserialize)
  if (typeof val === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      out[k] = deserialize(v)
    }
    return out
  }
  return val
}

/** Recursively convert plain JS values to Neo4j-safe types (params → driver) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeParams(val: unknown): any {
  if (val === null || val === undefined) return val
  if (typeof val === 'number' && Number.isInteger(val)) return neo4j.int(val)
  if (Array.isArray(val)) return val.map(serializeParams)
  if (typeof val === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      out[k] = serializeParams(v)
    }
    return out
  }
  return val
}

export async function runQuery<T = Record<string, unknown>>(
  cypher: string,
  params: Record<string, unknown> = {}
): Promise<T[]> {
  const session: Session = getDriver().session({ database: process.env.NEO4J_DATABASE || 'neo4j' })
  try {
    const result = await session.run(cypher, serializeParams(params))
    return result.records.map(r => deserialize(r.toObject()) as T)
  } finally {
    await session.close()
  }
}

export async function closeDriver() {
  if (driver) {
    await driver.close()
    driver = null
  }
}
