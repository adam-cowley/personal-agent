/**
 * Generates a vector embedding for a text string using OpenAI text-embedding-3-small.
 * Returns null if OPENAI_API_KEY is not set or the request fails.
 */
export async function embed(text: string): Promise<number[] | null> {
  if (!process.env.OPENAI_API_KEY) return null
  try {
    const OpenAI = (await import("openai")).default
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const res = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: text.slice(0, 8191), // model token limit
    })
    return res.data[0].embedding
  } catch {
    return null
  }
}
