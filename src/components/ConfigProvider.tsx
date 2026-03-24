"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"

export interface AppConfig {
  name: string
  systemPrompt: string
}

const DEFAULTS: AppConfig = { name: "Elsie", systemPrompt: "" }

const ConfigContext = createContext<{
  config: AppConfig
  reload: () => void
}>({ config: DEFAULTS, reload: () => {} })

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(DEFAULTS)

  const reload = useCallback(() => {
    fetch("/api/config")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setConfig(data) })
      .catch(() => {})
  }, [])

  useEffect(() => { reload() }, [reload])

  return (
    <ConfigContext.Provider value={{ config, reload }}>
      {children}
    </ConfigContext.Provider>
  )
}

export function useConfig() {
  return useContext(ConfigContext)
}
