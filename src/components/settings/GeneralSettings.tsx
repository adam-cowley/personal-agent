"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useConfig } from "@/components/ConfigProvider"

export function GeneralSettings() {
  const { config, reload } = useConfig()
  const [name, setName] = useState(config.name)
  const [systemPrompt, setSystemPrompt] = useState(config.systemPrompt)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Sync if config loads after mount
  useEffect(() => {
    setName(config.name)
    setSystemPrompt(config.systemPrompt)
  }, [config.name, config.systemPrompt])

  async function save() {
    setSaving(true)
    setSaved(false)
    try {
      await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, systemPrompt }),
      })
      reload()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const dirty = name !== config.name || systemPrompt !== config.systemPrompt

  return (
    <Card>
      <CardHeader>
        <CardTitle>General</CardTitle>
        <CardDescription>Project name and AI behaviour</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="app-name">Project name</Label>
          <Input
            id="app-name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Elsie"
            className="h-10"
          />
          <p className="text-xs text-muted-foreground">
            Shown in the header and used as the AI's name.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="system-prompt">System prompt</Label>
          <Textarea
            id="system-prompt"
            value={systemPrompt}
            onChange={e => setSystemPrompt(e.target.value)}
            placeholder={`You are {name}, a personal business coach and assistant…`}
            className="min-h-[120px] resize-none text-sm font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Overrides the default AI persona when no mode is active. Use <code className="bg-muted px-1 rounded">{"{name}"}</code> to insert the project name. Leave blank to use the built-in prompt.
          </p>
        </div>

        <Button
          onClick={save}
          disabled={saving || !dirty}
          size="sm"
        >
          {saving ? "Saving…" : saved ? "Saved" : "Save changes"}
        </Button>
      </CardContent>
    </Card>
  )
}
