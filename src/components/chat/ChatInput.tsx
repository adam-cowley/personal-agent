"use client"

import { useRef, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ArrowUp, Loader2, Mic, MicOff } from "lucide-react"
import { cn } from "@/lib/utils"

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
}

// Web Speech API type shim
interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onend: (() => void) | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onerror: ((e: any) => void) | null
}
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
}
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition
    webkitSpeechRecognition?: new () => SpeechRecognition
  }
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("")
  const [listening, setListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const recRef = useRef<SpeechRecognition | null>(null)
  const activeRef = useRef(false)
  const baseTextRef = useRef("") // text in box when recording started

  useEffect(() => {
    const supported = !!(window.SpeechRecognition ?? window.webkitSpeechRecognition)
    console.log("[voice] speechSupported:", supported, "SpeechRecognition:", !!window.SpeechRecognition, "webkitSpeechRecognition:", !!window.webkitSpeechRecognition)
    setSpeechSupported(supported)
  }, [])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function submit() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue("")
  }

  function startVoice() {
    const SpeechRec = window.SpeechRecognition ?? window.webkitSpeechRecognition
    console.log("[voice] startVoice, SpeechRec:", !!SpeechRec)
    if (!SpeechRec || activeRef.current) return

    const rec = new SpeechRec()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = "en-US"

    rec.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = Array.from(e.results)
        .map(r => r[0].transcript)
        .join("")
      console.log("[voice] onresult:", transcript)
      setValue(baseTextRef.current + transcript)
    }

    rec.onend = () => {
      console.log("[voice] onend, activeRef:", activeRef.current)
      if (activeRef.current) createAndStart()
    }

    rec.onerror = (e) => {
      console.log("[voice] onerror:", e.error)
      if (e.error === "not-allowed" || e.error === "service-not-available") {
        activeRef.current = false
        setListening(false)
      }
    }

    baseTextRef.current = value
    activeRef.current = true
    recRef.current = rec
    setListening(true)
    console.log("[voice] calling rec.start()")
    rec.start()
  }

  function createAndStart() {
    const SpeechRec = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SpeechRec) return
    const rec = new SpeechRec()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = "en-US"
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join("")
      setValue(baseTextRef.current + transcript)
    }
    rec.onend = () => { if (activeRef.current) createAndStart() }
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-available") {
        activeRef.current = false
        setListening(false)
      }
    }
    recRef.current = rec
    rec.start()
  }

  function stopVoice() {
    if (!activeRef.current) return
    console.log("[voice] stopVoice")
    activeRef.current = false
    recRef.current?.stop()
    recRef.current = null
    setListening(false)
  }

  return (
    <div className="flex items-end gap-2 border-t p-4 bg-background">
      <Textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Message…"
        className="min-h-[52px] max-h-[160px] resize-none text-base"
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={1}
      />
      {speechSupported && (
        <Button
          size="icon"
          variant="ghost"
          type="button"
          className={cn(
            "size-11 shrink-0 rounded-full transition-colors select-none",
            listening ? "bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90" : "text-muted-foreground"
          )}
          onMouseDown={startVoice}
          onMouseUp={stopVoice}
          onMouseLeave={stopVoice}
          onTouchStart={startVoice}
          onTouchEnd={stopVoice}
          disabled={disabled}
          aria-label={listening ? "Release to stop" : "Hold to speak"}
        >
          {listening ? <MicOff className="size-5" /> : <Mic className="size-5" />}
        </Button>
      )}
      <Button
        size="icon"
        className="size-11 shrink-0 rounded-full"
        onClick={submit}
        disabled={disabled}
      >
        {disabled ? <Loader2 className="size-5 animate-spin" /> : <ArrowUp className="size-5" />}
      </Button>
    </div>
  )
}
