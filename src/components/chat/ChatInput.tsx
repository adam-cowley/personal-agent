"use client"

import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ModelPicker } from "./ModelPicker"
import { ArrowUp, Loader2 } from "lucide-react"

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  selectedModel: string
  onModelChange: (model: string) => void
}

export function ChatInput({ onSend, disabled, selectedModel, onModelChange }: ChatInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function submit() {
    const value = ref.current?.value.trim()
    if (!value || disabled) return
    onSend(value)
    if (ref.current) ref.current.value = ""
  }

  return (
    <div className="flex items-end gap-2 border-t p-4 bg-background">
      <Textarea
        ref={ref}
        placeholder="Ask Elsie anything..."
        className="min-h-[52px] max-h-[160px] resize-none text-base"
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={1}
      />
      <Button
        size="icon"
        className="size-11 shrink-0 rounded-full"
        onClick={submit}
        disabled={disabled}
      >
        {disabled ? <Loader2 className="size-5 animate-spin" /> : <ArrowUp className="size-5" />}
      </Button>
      <ModelPicker value={selectedModel} onChange={onModelChange} />
    </div>
  )
}
