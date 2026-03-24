import { runQuery } from "@/lib/neo4j/client"

export interface AppConfig {
  name: string
  systemPrompt: string
}

const DEFAULTS: AppConfig = {
  name: "Elsie",
  systemPrompt: "",
}

export async function getConfig(): Promise<AppConfig> {
  try {
    const rows = await runQuery<{ name: string | null; systemPrompt: string | null }>(`
      MATCH (c:AppConfig {id: 'main'})
      RETURN c.name AS name, c.systemPrompt AS systemPrompt
    `)
    if (rows.length === 0) return DEFAULTS
    return {
      name: rows[0].name ?? DEFAULTS.name,
      systemPrompt: rows[0].systemPrompt ?? DEFAULTS.systemPrompt,
    }
  } catch {
    return DEFAULTS
  }
}

export async function setConfig(updates: Partial<AppConfig>): Promise<AppConfig> {
  const current = await getConfig()
  const next = { ...current, ...updates }
  await runQuery(`
    MERGE (c:AppConfig {id: 'main'})
    SET c.name = $name, c.systemPrompt = $systemPrompt, c.updatedAt = datetime()
  `, { name: next.name, systemPrompt: next.systemPrompt })
  return next
}
