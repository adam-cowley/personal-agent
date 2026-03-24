"use client"

export const THEMES = [
  { id: "default", label: "Default",  color: "#18181b" },
  { id: "ocean",   label: "Ocean",    color: "#1e40af" },
  { id: "sunset",  label: "Sunset",   color: "#c2410c" },
  { id: "forest",  label: "Forest",   color: "#15803d" },
  { id: "candy",   label: "Candy",    color: "#7c3aed" },
] as const

export type ThemeId = typeof THEMES[number]["id"]

const STORAGE_KEY = "elsie-theme"
const THEME_CLASSES = THEMES.map(t => `theme-${t.id}`).filter(c => c !== "theme-default")

export function getTheme(): ThemeId {
  if (typeof window === "undefined") return "default"
  return (localStorage.getItem(STORAGE_KEY) as ThemeId) ?? "default"
}

export function setTheme(id: ThemeId) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, id)
  // Remove all theme classes then apply the new one
  document.documentElement.classList.remove(...THEME_CLASSES)
  if (id !== "default") document.documentElement.classList.add(`theme-${id}`)
}

export function initTheme() {
  setTheme(getTheme())
}
