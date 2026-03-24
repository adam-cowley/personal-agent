"use client"

import { useState } from "react"
import { Wand2, Check, ChevronRight, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { modes } from "@/modes/registry"
import type { Mode } from "@/modes/types"
import { MbtiPicker } from "@/components/MbtiPicker"

interface Person {
  id: string
  name: string
  role?: string
}

interface ModeSelectorProps {
  selectedModeId: string
  selectedPersonIds: string[]
  onModeChange(modeId: string, personIds: string[], context?: Record<string, unknown>): void
}

const CATEGORY_LABELS: Record<string, string> = {
  default: "Default",
  persona: "Personas",
  coach: "Coaching",
  panel: "Panels",
}

export function ModeSelector({ selectedModeId, selectedPersonIds, onModeChange }: ModeSelectorProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<"modes" | "people" | "mbti-quiz">("modes")
  const [pendingMode, setPendingMode] = useState<Mode | null>(null)
  const [pickedIds, setPickedIds] = useState<string[]>(selectedPersonIds)
  const [mbtiValue, setMbtiValue] = useState("")
  const [people, setPeople] = useState<Person[]>([])
  const [loadingPeople, setLoadingPeople] = useState(false)

  const selectedMode = modes.find(m => m.id === selectedModeId)

  async function fetchPeople() {
    setLoadingPeople(true)
    try {
      const res = await fetch("/api/entities/person")
      if (res.ok) setPeople(await res.json())
    } finally {
      setLoadingPeople(false)
    }
  }

  function selectMode(mode: Mode) {
    if (mode.id === "mbti-coach") {
      setPendingMode(mode)
      setMbtiValue("")
      setStep("mbti-quiz")
    } else if (mode.requiresPeople) {
      setPendingMode(mode)
      setPickedIds(mode.id === selectedModeId ? selectedPersonIds : [])
      setStep("people")
      fetchPeople()
    } else {
      onModeChange(mode.id, [])
      setOpen(false)
    }
  }

  function confirmMbti() {
    if (pendingMode) {
      onModeChange(pendingMode.id, [], { targetMbti: mbtiValue })
      setOpen(false)
    }
  }

  function confirmBoard() {
    if (pendingMode) {
      onModeChange(pendingMode.id, pickedIds)
      setOpen(false)
    }
  }

  function handleOpenChange(v: boolean) {
    setOpen(v)
    if (!v) setStep("modes")
  }

  const grouped = Object.entries(
    modes.reduce<Record<string, Mode[]>>((acc, m) => {
      const cat = m.category
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(m)
      return acc
    }, {})
  )

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className={cn("gap-1.5 h-7 px-2 text-xs font-medium", selectedModeId !== "default" && "text-primary")}
            aria-label="Select mode"
          />
        }
      >
        <Wand2 className="size-3.5" />
        {selectedMode?.label ?? "Elsie"}
      </SheetTrigger>

      <SheetContent side="bottom" className="h-[70vh] flex flex-col p-0">
        {step === "modes" && (
          <>
            <SheetHeader className="border-b px-4 py-3 shrink-0">
              <SheetTitle className="text-sm">Choose a mode</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto">
              {grouped.map(([cat, catModes]) => (
                <div key={cat}>
                  <p className="px-4 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {CATEGORY_LABELS[cat] ?? cat}
                  </p>
                  {catModes.map(mode => {
                    const Icon = mode.icon
                    const isActive = mode.id === selectedModeId
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => selectMode(mode)}
                        className={cn(
                          "w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors",
                          isActive && "bg-primary/5"
                        )}
                      >
                        <Icon className={cn("size-4 mt-0.5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm font-medium", isActive && "text-primary")}>{mode.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{mode.description}</p>
                          {mode.id === selectedModeId && selectedPersonIds.length > 0 && (
                            <p className="text-xs text-primary mt-1">{selectedPersonIds.length} people selected</p>
                          )}
                        </div>
                        {mode.requiresPeople
                          ? <ChevronRight className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                          : isActive
                            ? <Check className="size-4 text-primary shrink-0 mt-0.5" />
                            : null
                        }
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </>
        )}

        {step === "people" && pendingMode && (
          <>
            <SheetHeader className="border-b px-4 py-3 shrink-0 flex-row items-center gap-2">
              <button type="button" onClick={() => setStep("modes")} className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-4" />
              </button>
              <SheetTitle className="text-sm">Select board members</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto">
              {loadingPeople && (
                <p className="p-4 text-sm text-muted-foreground animate-pulse">Loading people…</p>
              )}
              {!loadingPeople && people.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">No people in your graph yet. Add some first.</p>
              )}
              {people.map(person => {
                const checked = pickedIds.includes(person.id)
                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => setPickedIds(prev => checked ? prev.filter(id => id !== person.id) : [...prev, person.id])}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors",
                      checked && "bg-primary/5"
                    )}
                  >
                    <div className={cn(
                      "size-4 rounded border shrink-0 flex items-center justify-center",
                      checked ? "bg-primary border-primary" : "border-muted-foreground/40"
                    )}>
                      {checked && <Check className="size-3 text-primary-foreground" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{person.name}</p>
                      {person.role && <p className="text-xs text-muted-foreground">{person.role}</p>}
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="border-t px-4 py-3 shrink-0">
              <Button
                className="w-full"
                disabled={pickedIds.length === 0}
                onClick={confirmBoard}
              >
                {pickedIds.length === 0 ? "Select at least one person" : `Assemble board (${pickedIds.length})`}
              </Button>
            </div>
          </>
        )}

        {step === "mbti-quiz" && pendingMode && (
          <>
            <SheetHeader className="border-b px-4 py-3 shrink-0 flex-row items-center gap-2">
              <button type="button" onClick={() => setStep("modes")} className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-4" />
              </button>
              <SheetTitle className="text-sm">Who are you communicating with?</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <p className="text-xs text-muted-foreground mb-4">
                Answer four questions to identify their Myers-Briggs type. The coach will tailor its advice accordingly.
              </p>
              <MbtiPicker value={mbtiValue} onChange={setMbtiValue} />
            </div>
            <div className="border-t px-4 py-3 shrink-0">
              <Button
                className="w-full"
                disabled={mbtiValue.length < 4}
                onClick={confirmMbti}
              >
                {mbtiValue.length < 4 ? "Answer all four questions" : `Start coaching for ${mbtiValue}`}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
