import { useCallback } from 'react'

const STORAGE_KEY = 'dbviewer-query-history'
const MAX_ENTRIES = 50

type HistoryStore = Record<string, string[]>

function loadStore(): HistoryStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as HistoryStore
  } catch {
    return {}
  }
}

function saveStore(store: HistoryStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

function normalizeSql(sql: string): string {
  return sql.trim().replace(/\s+/g, ' ')
}

export function useQueryHistory() {
  const getHistory = useCallback((connectionId: string): string[] => {
    return loadStore()[connectionId] ?? []
  }, [])

  const addToHistory = useCallback((connectionId: string, sql: string) => {
    const trimmed = sql.trim()
    if (!trimmed) return

    const store = loadStore()
    const existing = store[connectionId] ?? []
    const normalized = normalizeSql(trimmed)
    const deduped = existing.filter((entry) => normalizeSql(entry) !== normalized)
    store[connectionId] = [trimmed, ...deduped].slice(0, MAX_ENTRIES)
    saveStore(store)
  }, [])

  const clearHistory = useCallback((connectionId: string) => {
    const store = loadStore()
    delete store[connectionId]
    saveStore(store)
  }, [])

  return { getHistory, addToHistory, clearHistory }
}
