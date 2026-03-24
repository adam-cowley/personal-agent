"use client"

import { useEffect, useState, useTransition } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import type { EntityDef, FieldDef } from "@/entities/types"
import { cn } from "@/lib/utils"

interface EntityFormProps {
  entity: EntityDef
  /** Existing data for edit mode — omit for create */
  initial?: Record<string, unknown>
  onSuccess: (item: Record<string, unknown>) => void
  onCancel: () => void
}

function RelationInput({ field, value, onChange }: {
  field: FieldDef
  value: string
  onChange: (v: string) => void
}) {
  const [options, setOptions] = useState<Array<{ value: string; label: string }>>([])
  useEffect(() => {
    if (!field.endpoint) return
    fetch(field.endpoint)
      .then(r => r.json())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((items: any[]) => setOptions(
        items.map(item => ({
          value: String(item[field.valueKey ?? "id"] ?? ""),
          label: String(item[field.labelKey ?? "name"] ?? ""),
        }))
      ))
      .catch(() => {/* ignore */})
  }, [field.endpoint, field.valueKey, field.labelKey])

  return (
    <Select value={value ?? ""} onValueChange={v => onChange(v ?? "")}>
      <SelectTrigger className="w-full h-10 text-base">
        <SelectValue placeholder={`Select ${field.label.toLowerCase()}…`} />
      </SelectTrigger>
      <SelectContent>
        {options.map(opt => (
          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function FieldInput({ field, value, onChange }: {
  field: FieldDef
  value: string
  onChange: (v: string) => void
}) {
  if (field.type === "enum" && field.options) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {field.options.map(opt => {
          const active = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(active ? "" : opt.value)}
              className={cn(
                "flex flex-col items-start rounded-lg border px-3 py-2.5 text-left transition-all",
                active
                  ? "border-primary bg-primary/8 ring-1 ring-primary"
                  : "border-border hover:border-muted-foreground/40 hover:bg-muted/40"
              )}
            >
              <span className={cn(
                "text-sm font-semibold leading-none mb-1",
                active ? "text-primary" : "text-foreground"
              )}>
                {opt.value} · {opt.label}
              </span>
              {opt.description && (
                <span className="text-xs text-muted-foreground leading-snug">{opt.description}</span>
              )}
            </button>
          )
        })}
      </div>
    )
  }
  if (field.type === "relation") {
    return <RelationInput field={field} value={value} onChange={onChange} />
  }
  if (field.type === "textarea") {
    return (
      <Textarea
        id={field.key}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder}
        className="min-h-[80px] resize-none text-base"
        required={field.required}
      />
    )
  }
  if (field.type === "select" && field.options) {
    return (
      <Select value={value} onValueChange={v => v && onChange(v)}>
        <SelectTrigger className="w-full h-10 text-base">
          <SelectValue placeholder={`Select ${field.label.toLowerCase()}…`} />
        </SelectTrigger>
        <SelectContent>
          {field.options.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }
  return (
    <Input
      id={field.key}
      type={field.type === "email" ? "email" : field.type === "date" ? "date" : "text"}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={field.placeholder}
      className="h-10 text-base"
      required={field.required}
    />
  )
}

function FieldRow({ field, value, onChange }: {
  field: FieldDef
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={field.key} className="text-sm font-medium">
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <FieldInput field={field} value={value} onChange={onChange} />
    </div>
  )
}

export function EntityForm({ entity, initial, onSuccess, onCancel }: EntityFormProps) {
  const isEdit = !!(initial?.id)
  const groups = entity.groups ?? []

  // Build controlled state from field defs + initial values
  const [values, setValues] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {}
    for (const f of entity.fields) {
      defaults[f.key] = initial ? String(initial[f.key] ?? "") : ""
    }
    return defaults
  })

  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function set(key: string, value: string) {
    setValues(prev => ({ ...prev, [key]: value }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const payload: Record<string, string> = {}
      for (const f of entity.fields) {
        if (values[f.key] !== "" || f.required) payload[f.key] = values[f.key]
      }

      try {
        const url = isEdit
          ? `/api/entities/${entity.type.toLowerCase()}/${initial!.id}`
          : `/api/entities/${entity.type.toLowerCase()}`
        const res = await fetch(url, {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error ?? `HTTP ${res.status}`)
        }
        onSuccess(await res.json())
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    })
  }

  // Split fields: grouped keys vs header (ungrouped) fields
  const groupedKeys = new Set(groups.flatMap(g => g.fields))
  const headerFields = entity.fields.filter(f => !groupedKeys.has(f.key))
  const hasTabs = groups.length > 0

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {/* Header fields — always visible */}
      {headerFields.length > 0 && (
        <div className="space-y-4">
          {headerFields.map(field => (
            <FieldRow key={field.key} field={field} value={values[field.key]} onChange={v => set(field.key, v)} />
          ))}
        </div>
      )}

      {/* Tab groups */}
      {hasTabs && (
        <Tabs defaultValue={groups[0].label}>
          <TabsList className="w-full">
            {groups.map(g => (
              <TabsTrigger key={g.label} value={g.label} className="flex-1">
                {g.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {groups.map(g => {
            const tabFields = g.fields
              .map(key => entity.fields.find(f => f.key === key))
              .filter((f): f is FieldDef => !!f)
            return (
              <TabsContent key={g.label} value={g.label} className="space-y-4 pt-3">
                {tabFields.map(field => (
                  <FieldRow key={field.key} field={field} value={values[field.key]} onChange={v => set(field.key, v)} />
                ))}
              </TabsContent>
            )
          })}
        </Tabs>
      )}

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? "Saving…" : isEdit ? "Save changes" : `Create ${entity.label}`}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
