"use client"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { AVAILABLE_MODELS } from "@/lib/models/types"
import { Cpu, Check } from "lucide-react"
import { cn } from "@/lib/utils"

const providerLabels: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google Gemini",
}

const modelsByProvider = AVAILABLE_MODELS.reduce<Record<string, typeof AVAILABLE_MODELS>>((acc, m) => {
  acc[m.provider] = acc[m.provider] ?? []
  acc[m.provider].push(m)
  return acc
}, {})

interface ModelPickerProps {
  value: string
  onChange: (model: string) => void
}

export function ModelPicker({ value, onChange }: ModelPickerProps) {
  const current = AVAILABLE_MODELS.find(m => m.model === value)

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="Select model"
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "size-11 shrink-0 text-muted-foreground hover:text-foreground"
            )}
          />
        }
      >
        <Cpu className="size-5" />
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-56 p-2">
        <p className="text-xs font-medium text-muted-foreground px-2 py-1">
          {current?.label ?? value}
        </p>
        <Separator className="my-1" />
        {Object.entries(modelsByProvider).map(([provider, models], i) => (
          <div key={provider}>
            {i > 0 && <Separator className="my-1" />}
            <p className="text-xs font-medium text-muted-foreground px-2 py-1">
              {providerLabels[provider] ?? provider}
            </p>
            {models.map(m => (
              <button
                key={m.model}
                type="button"
                onClick={() => onChange(m.model)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                  m.model === value && "bg-accent text-accent-foreground"
                )}
              >
                <Check className={cn("size-4 shrink-0", m.model === value ? "opacity-100" : "opacity-0")} />
                {m.label}
              </button>
            ))}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  )
}
