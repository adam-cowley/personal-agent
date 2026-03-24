"use client"

import { useState, useEffect } from "react"
import { Box, Plus, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EntityDialog } from "@/components/entity/EntityDialog"
import { makeEntityDef, type ClientEntityConfig } from "@/entities/client-config"
import { getIcon } from "@/lib/spec/icon-map"

function displayName(item: Record<string, unknown>): string {
  return String(item.name ?? item.title ?? item.id ?? "Untitled")
}

function displaySub(item: Record<string, unknown>): string {
  return String(item.status ?? item.role ?? item.email ?? "")
}

interface EntityListPageProps {
  type: string
  label: string
  plural: string
  iconName?: string
}

export function EntityListPage(props: EntityListPageProps) {
  const { type, label, plural, iconName } = props
  const Icon = iconName ? getIcon(iconName) : Box

  const [items, setItems] = useState<Record<string, unknown>[]>([])
  const [config, setConfig] = useState<ClientEntityConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/entities/${type}`).then(async r => {
        if (!r.ok) throw new Error(await r.text())
        return r.json() as Promise<Record<string, unknown>[]>
      }),
      fetch("/api/spec").then(r => r.json()).then(data =>
        (data?.entities as ClientEntityConfig[])?.find(e => e.type.toLowerCase() === type.toLowerCase())
      ),
    ])
      .then(([data, cfg]) => { setItems(data); if (cfg) setConfig(cfg) })
      .catch(err => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false))
  }, [type])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Record<string, unknown> | undefined>()

  const entity = makeEntityDef(config ?? { type, label, plural, iconName: iconName ?? "Box", fields: [] })

  async function handleDelete(id: unknown) {
    if (!confirm(`Delete this ${label}?`)) return
    try {
      await fetch(`/api/entities/${type}/${id}`, { method: "DELETE" })
      setItems(prev => prev.filter(i => i.id !== id))
    } catch (err) {
      setError(String(err))
    }
  }

  function openCreate() { setEditing(undefined); setDialogOpen(true) }
  function openEdit(item: Record<string, unknown>) { setEditing(item); setDialogOpen(true) }

  function handleSaved(saved: Record<string, unknown>) {
    setItems(prev => {
      const idx = prev.findIndex(i => i.id === saved.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next }
      return [...prev, saved]
    })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
        <Icon className="size-5 text-muted-foreground" />
        <h1 className="font-semibold text-base flex-1">{plural}</h1>
        <Button size="sm" onClick={openCreate} className="gap-1.5">
          <Plus className="size-4" />
          New
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && <div className="p-6 text-muted-foreground text-sm">Loading…</div>}
        {error && <div className="p-4 text-destructive text-sm">{error}</div>}

        {!loading && items.length === 0 && !error && (
          <div className="p-6 text-muted-foreground text-sm">
            No {plural.toLowerCase()} yet.{" "}
            <button onClick={openCreate} className="underline">Create one.</button>
          </div>
        )}

        {items.map(item => (
          <div
            key={String(item.id)}
            className="flex items-center gap-3 px-4 py-3 border-b hover:bg-muted/40 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{displayName(item)}</p>
              {displaySub(item) && (
                <p className="text-xs text-muted-foreground truncate">{displaySub(item)}</p>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(item)} aria-label="Edit">
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive"
                onClick={() => handleDelete(item.id)} aria-label="Delete"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <EntityDialog
        entity={entity}
        initial={editing}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  )
}
