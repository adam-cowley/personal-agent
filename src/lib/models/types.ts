export type Provider = "anthropic" | "openai" | "gemini"

export interface ModelConfig {
  provider: Provider
  model: string
  /** Display label shown in the UI */
  label: string
}

/** All models available across providers */
export const AVAILABLE_MODELS: ModelConfig[] = [
  // OpenAI
  { provider: "openai", model: "gpt-5-mini",  label: "GPT-5 Mini" },
  { provider: "openai", model: "gpt-5-nano",  label: "GPT-5 Nano" },
  // Anthropic
  { provider: "anthropic", model: "claude-opus-4-6",    label: "Claude Opus 4.6" },
  { provider: "anthropic", model: "claude-sonnet-4-6",  label: "Claude Sonnet 4.6" },
  { provider: "anthropic", model: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  // Gemini
  { provider: "gemini", model: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
]

export const DEFAULT_MODEL: ModelConfig = {
  provider: "openai",
  model: "gpt-5-mini",
  label: "GPT-5 Mini",
}
