import { useState, useEffect, useCallback } from 'react'
import type { SavedConnection } from '../types'

const LEGACY_STORAGE_KEY = 'dbviewer-connections'

function migrateFromLocalStorage(): SavedConnection[] {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return []
    const connections = JSON.parse(raw) as SavedConnection[]
    localStorage.removeItem(LEGACY_STORAGE_KEY)
    return connections
  } catch {
    return []
  }
}

export function useSavedConnections() {
  const [connections, setConnections] = useState<SavedConnection[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      let data: SavedConnection[] = []

      if (window.storeApi) {
        const res = await window.storeApi.readConnections()
        if (res.success) {
          data = res.connections
        }
      }

      if (data.length === 0) {
        data = migrateFromLocalStorage()
        if (data.length > 0 && window.storeApi) {
          await window.storeApi.writeConnections(data)
        }
      }

      if (!cancelled) {
        setConnections(data)
        setLoaded(true)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!loaded || !window.storeApi) return
    window.storeApi.writeConnections(connections)
  }, [connections, loaded])

  const addConnection = useCallback((conn: SavedConnection) => {
    setConnections((prev) => [...prev, conn])
  }, [])

  const updateConnection = useCallback((id: string, patch: Partial<SavedConnection>) => {
    setConnections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
    )
  }, [])

  const removeConnection = useCallback((id: string) => {
    setConnections((prev) => prev.filter((c) => c.id !== id))
  }, [])

  return { connections, loaded, addConnection, updateConnection, removeConnection }
}
