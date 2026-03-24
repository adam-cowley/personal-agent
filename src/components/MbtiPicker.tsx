"use client"

import { cn } from "@/lib/utils"

const DICHOTOMIES = [
  {
    dimension: "Energy",
    question: "How does this person prefer to engage with the world?",
    left:  { code: "E", label: "Extraversion", desc: "Energised by people & activity" },
    right: { code: "I", label: "Introversion", desc: "Energised by solitude & reflection" },
  },
  {
    dimension: "Information",
    question: "How does this person take in information?",
    left:  { code: "S", label: "Sensing",   desc: "Focuses on concrete facts & details" },
    right: { code: "N", label: "Intuition", desc: "Focuses on patterns & possibilities" },
  },
  {
    dimension: "Decisions",
    question: "How does this person make decisions?",
    left:  { code: "T", label: "Thinking", desc: "Decides by logic & objective analysis" },
    right: { code: "F", label: "Feeling",  desc: "Decides by values & impact on people" },
  },
  {
    dimension: "Structure",
    question: "How does this person prefer to live and work?",
    left:  { code: "J", label: "Judging",    desc: "Prefers plans, structure & closure" },
    right: { code: "P", label: "Perceiving", desc: "Prefers flexibility & staying open" },
  },
]

// Parse an MBTI string like "ENFP" into a 4-char array of selected codes
function parseSelections(mbti: string): (string | null)[] {
  const upper = mbti.toUpperCase()
  return DICHOTOMIES.map(({ left, right }) => {
    if (upper.includes(left.code)) return left.code
    if (upper.includes(right.code)) return right.code
    return null
  })
}

interface MbtiPickerProps {
  value?: string
  onChange: (mbti: string) => void
}

export function MbtiPicker({ value, onChange }: MbtiPickerProps) {
  const selections = parseSelections(value ?? "")

  function toggle(dimIndex: number, code: string) {
    const next = [...selections]
    next[dimIndex] = code
    onChange(next.map(c => c ?? "").join(""))
  }

  const complete = selections.every(Boolean)
  const mbtiCode = complete ? selections.join("") : null

  return (
    <div className="space-y-3">
      {DICHOTOMIES.map(({ dimension, question, left, right }, i) => {
        const sel = selections[i]
        return (
          <div key={dimension}>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">{question}</p>
            <div className="grid grid-cols-2 gap-2">
              {[left, right].map(opt => {
                const active = sel === opt.code
                return (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => toggle(i, opt.code)}
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
                      {opt.code} · {opt.label}
                    </span>
                    <span className="text-xs text-muted-foreground leading-snug">{opt.desc}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      {mbtiCode && (
        <div className="mt-1 rounded-lg bg-primary/8 border border-primary/30 px-3 py-2 flex items-center gap-2">
          <span className="text-base font-bold text-primary tracking-widest">{mbtiCode}</span>
          <span className="text-xs text-muted-foreground">selected</span>
        </div>
      )}
    </div>
  )
}
