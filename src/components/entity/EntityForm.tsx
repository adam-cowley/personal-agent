"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { EntityDef, FieldDef } from "@/entities/types"
import { cn } from "@/lib/utils"
import { MbtiPicker } from "@/components/MbtiPicker"

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
    <Select value={value} onValueChange={v => onChange(v)}>
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
  if (field.type === "mbti") {
    return <MbtiPicker value={value} onChange={onChange} />
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

export function EntityForm({ entity, initial, onSuccess, onCancel }: EntityFormProps) {
  const isEdit = !!(initial?.id)

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
      // Strip empty optional fields
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

  return (
    <form onSubmit={submit} className="space-y-4">
      {entity.fields.map(field => (
        <div key={field.key} className="space-y-1.5">
          <Label htmlFor={field.key} className="text-sm font-medium">
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <FieldInput field={field} value={values[field.key]} onChange={v => set(field.key, v)} />
        </div>
      ))}

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
      )}

      <div className="flex gap-2 pt-2">
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
