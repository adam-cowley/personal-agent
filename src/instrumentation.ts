export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { setupSchema } = await import("@/lib/neo4j/schema")
    try {
      await setupSchema()
    } catch (err) {
      // Log but don't crash startup — Neo4j may not be available in all envs
      console.warn("[schema] Auto-setup failed:", err instanceof Error ? err.message : err)
    }
  }
}
