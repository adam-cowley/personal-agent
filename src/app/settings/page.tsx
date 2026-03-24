import { AppShell } from "@/components/layout/AppShell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ThemePicker } from "@/components/ThemePicker"
import { GeneralSettings } from "@/components/settings/GeneralSettings"

function apiKeyStatus(val: string | undefined) {
  if (!val) return "missing"
  if (val.includes("=")) return "invalid (doubled key name)"
  return "configured"
}

function apiKeyVariant(val: string | undefined): "default" | "destructive" | "secondary" {
  if (!val) return "destructive"
  if (val.includes("=")) return "destructive"
  return "default"
}

export default function SettingsPage() {
  const neo4jUri = process.env.NEO4J_URI || "bolt://localhost:7687"
  const openaiKey = process.env.OPENAI_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const geminiKey = process.env.GEMINI_API_KEY

  const apis = [
    { label: "OpenAI", key: openaiKey },
    { label: "Anthropic", key: anthropicKey },
    { label: "Gemini", key: geminiKey },
  ]

  return (
    <AppShell>
      <div className="p-4 space-y-4 overflow-y-auto h-full">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Settings
        </h2>

        <GeneralSettings />

        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Choose a colour theme</CardDescription>
          </CardHeader>
          <CardContent>
            <ThemePicker />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API Keys</CardTitle>
            <CardDescription>Set these in <code className="font-mono text-xs">.env.local</code></CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {apis.map(({ label, key }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-base">{label}</span>
                <Badge variant={apiKeyVariant(key)}>
                  {apiKeyStatus(key)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Neo4j</CardTitle>
            <CardDescription>Graph database connection</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-base">URI</span>
              <Badge variant="outline" className="font-mono text-xs">{neo4jUri}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-base">Credentials</span>
              <Badge variant={process.env.NEO4J_USER ? "default" : "secondary"}>
                {process.env.NEO4J_USER ? "configured" : "using defaults"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Database</CardTitle>
            <CardDescription>One-time setup commands</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-muted-foreground">
            <p className="text-base">Run <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">npm run db:setup</code> to initialize the Neo4j schema.</p>
            <p className="text-base">Run <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">npm run db:seed</code> to load demo data.</p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
