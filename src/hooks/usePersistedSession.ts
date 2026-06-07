import { useState, useEffect, useCallback } from 'react'
import type { SessionState } from '../types'

const EMPTY_SESSION: SessionState = {
  tabs: [],
  activeTabId: null,
  activeConnectionId: null,
  querySql: {},
  expanded: {},
}

export function usePersistedSession() {
  const [initialSession, setInitialSession] = useState<SessionState | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [persistenceEnabled, setPersistenceEnabled] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!window.storeApi) {
        if (!cancelled) {
          setInitialSession(EMPTY_SESSION)
          setLoaded(true)
          setPersistenceEnabled(true)
        }
        return
      }

      const res = await window.storeApi.readSession()
      if (!cancelled) {
        setInitialSession(res.success && res.session ? res.session : EMPTY_SESSION)
        setLoaded(true)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const enablePersistence = useCallback(() => {
    setPersistenceEnabled(true)
  }, [])

  const persist = useCallback((session: SessionState) => {
    if (!window.storeApi) return
    window.storeApi.writeSession(session)
  }, [])

  return { initialSession, loaded, persistenceEnabled, enablePersistence, persist }
}
