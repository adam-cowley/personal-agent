"use client"

import { useState } from "react"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Option {
  id: string
  label: string
  description?: string
}

interface ChoiceFormProps {
  question: string
  options: Option[]
  multiple: boolean
  onSubmit(answer: string): void
}

export function ChoiceForm({ question, options, multiple, onSubmit }: ChoiceFormProps) {
  const [selected, setSelected] = useState<string[]>([])

  function toggle(id: string) {
    if (multiple) {
      setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    } else {
      setSelected([id])
    }
  }

  function submit() {
    if (selected.length === 0) return
    const labels = selected.map(id => options.find(o => o.id === id)?.label ?? id)
    onSubmit(multiple ? labels.join(", ") : labels[0])
  }

  return (
    <div className="mx-4 my-2 rounded-2xl border bg-background shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/30">
        <p className="text-sm font-medium">{question}</p>
        {multiple && <p className="text-xs text-muted-foreground mt-0.5">Select all that apply</p>}
      </div>
      <div className="divide-y">
        {options.map(opt => {
          const active = selected.includes(opt.id)
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggle(opt.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                active ? "bg-primary/8" : "hover:bg-muted/50"
              )}
            >
              <div className={cn(
                "shrink-0 flex items-center justify-center transition-colors",
                multiple
                  ? "size-4 rounded border"
                  : "size-4 rounded-full border-2",
                active
                  ? multiple ? "bg-primary border-primary" : "border-primary"
                  : "border-muted-foreground/40"
              )}>
                {active && multiple && <Check className="size-3 text-primary-foreground" />}
                {active && !multiple && <div className="size-2 rounded-full bg-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium", active && "text-primary")}>{opt.label}</p>
                {opt.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                )}
              </div>
            </button>
          )
        })}
      </div>
      <div className="px-4 py-3 border-t bg-muted/20">
        <Button
          size="sm"
          className="w-full"
          disabled={selected.length === 0}
          onClick={submit}
        >
          {selected.length === 0 ? "Choose an option" : multiple ? `Confirm (${selected.length} selected)` : "Confirm"}
        </Button>
      </div>
    </div>
  )
}
