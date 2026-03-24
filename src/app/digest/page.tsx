import { AppShell } from "@/components/layout/AppShell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { runQuery } from "@/lib/neo4j/client"

async function getRecentDigests() {
  try {
    return await runQuery<{ digest: { id: string; type: string; content: string; createdAt: string } }>(`
      MATCH (d:Digest)
      RETURN d {.id, .type, .content, createdAt: toString(d.createdAt)} AS digest
      ORDER BY d.createdAt DESC LIMIT 5
    `)
  } catch {
    return []
  }
}

export default async function DigestPage() {
  const digests = await getRecentDigests()

  return (
    <AppShell>
      <div className="p-4 space-y-3 overflow-y-auto h-full">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Digests
        </h2>
        <p className="text-sm text-muted-foreground">
          Ask Elsie to &quot;generate a daily digest&quot; or &quot;weekly summary&quot;.
        </p>
        {digests.length === 0 ? (
          <p className="text-base text-muted-foreground py-8 text-center">
            No digests yet.
          </p>
        ) : (
          digests.map(({ digest }) => (
            <Card key={digest.id}>
              <CardHeader className="flex-row items-center gap-3 space-y-0">
                <Badge variant={digest.type === "daily" ? "default" : "secondary"} className="capitalize">
                  {digest.type}
                </Badge>
                <CardTitle className="text-sm text-muted-foreground font-normal ml-auto">
                  {new Date(digest.createdAt).toLocaleDateString()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-base whitespace-pre-wrap">{digest.content}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </AppShell>
  )
}
