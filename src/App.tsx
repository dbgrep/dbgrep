import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { useQueryHistory } from './hooks/useQueryHistory'
import DatabaseExplorer from './components/DatabaseExplorer'
import ConnectionDialog from './components/ConnectionDialog'
import TableBrowser from './components/TableBrowser'
import QueryEditor, { type QueryEditorHandle } from './components/QueryEditor'
import TabBar from './components/TabBar'
import ShortcutsPanel, { ShortcutsButton } from './components/ShortcutsPanel'
import GitHubButton from './components/GitHubButton'
import { GITHUB_REPO_URL } from './constants'
import { appIcons } from './assets/icons'
import { openExternalUrl } from './utils/openExternal'
import { useSavedConnections } from './hooks/useSavedConnections'
import { usePersistedSession } from './hooks/usePersistedSession'
import {
  useKeyboardShortcuts,
  useElectronCloseTabShortcut,
} from './hooks/useKeyboardShortcuts'
import type {
  ConnectionConfig,
  ConnectionRuntime,
  QueryResult,
  Tab,
  TableTabState,
  QueryTabState,
  AutocompleteCatalog,
} from './types'
import {
  configToPayload,
  generateId,
  newQueryTabId,
  tableTabId,
  QUERY_PAGE_SIZE,
} from './types'
import { sameTableFilters, type TableFilter } from './tableFilters'
import './App.css'

const PAGE_SIZE = QUERY_PAGE_SIZE

const emptyTableState = (): TableTabState => ({
  result: null,
  error: null,
  loading: false,
  offset: 0,
  schema: null,
  schemaLoading: false,
  filters: [],
  showSchema: false,
})

const emptyQueryState = (): QueryTabState => ({
  sql: 'SELECT 1;',
  result: null,
  error: null,
  loading: false,
  offset: 0,
  lastExecutedSql: null,
})

function formatQueryTabLabel(sql: string, fallback: string): string {
  const line = sql.replace(/\s+/g, ' ').trim()
  return line || fallback
}

export default function App() {
  const { connections, loaded: connectionsLoaded, addConnection, updateConnection, removeConnection } =
    useSavedConnections()
  const {
    initialSession,
    loaded: sessionLoaded,
    persistenceEnabled,
    enablePersistence,
    persist,
  } = usePersistedSession()
  const { getHistory, addToHistory } = useQueryHistory()
  const [runtime, setRuntime] = useState<Record<string, ConnectionRuntime>>({})
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [tableStates, setTableStates] = useState<Record<string, TableTabState>>({})
  const [queryStates, setQueryStates] = useState<Record<string, QueryTabState>>({})
  const columnCacheRef = useRef<Record<string, string[]>>({})
  const queryGenerationRef = useRef<Record<string, number>>({})
  const [showDialog, setShowDialog] = useState(false)
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null)
  const [dialogLoading, setDialogLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [showShortcutsPanel, setShowShortcutsPanel] = useState(false)

  const queryEditorRef = useRef<QueryEditorHandle>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const shortcutsButtonRef = useRef<HTMLButtonElement>(null)
  const sessionRestoredRef = useRef(false)

  const updateRuntime = useCallback(
    (id: string, patch: Partial<ConnectionRuntime>) => {
      setRuntime((prev) => ({
        ...prev,
        [id]: {
          ...(prev[id] ?? { connected: false, connecting: false, schemas: [] }),
          ...patch,
        },
      }))
    },
    []
  )

  const loadMetadata = useCallback(async (id: string) => {
    const schemasRes = await window.dbApi.listSchemas(id)
    if (!schemasRes.success) throw new Error(schemasRes.error ?? 'Failed to load schemas')

    const schemas = []
    for (const name of schemasRes.schemas ?? []) {
      const tablesRes = await window.dbApi.listTables(id, name)
      schemas.push({
        name,
        tables: tablesRes.tables ?? [],
        loaded: true,
      })
    }
    return schemas
  }, [])

  const closeTabsForConnection = useCallback((connectionId: string) => {
    setTabs((prev) => {
      const remaining = prev.filter((t) => t.connectionId !== connectionId)
      setActiveTabId((current) => {
        const closed = prev.find((t) => t.id === current)
        if (closed?.connectionId === connectionId) {
          return remaining.length > 0 ? remaining[remaining.length - 1].id : null
        }
        return current
      })
      return remaining
    })
    setTableStates((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(next)) {
        if (key.startsWith(`table:${connectionId}:`)) {
          delete next[key]
        }
      }
      return next
    })
    setQueryStates((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(next)) {
        if (key.startsWith(`query:${connectionId}:`)) {
          delete next[key]
        }
      }
      return next
    })
  }, [])

  const handleConnect = useCallback(
    async (id: string) => {
      const saved = connections.find((c) => c.id === id)
      if (!saved) return

      updateRuntime(id, { connecting: true, error: undefined })
      setStatusMessage(null)

      const res = await window.dbApi.connect(id, configToPayload(saved.config))
      if (!res.success) {
        updateRuntime(id, {
          connecting: false,
          connected: false,
          error: res.error ?? 'Connection failed',
        })
        return
      }

      try {
        const schemas = await loadMetadata(id)
        updateRuntime(id, { connecting: false, connected: true, schemas, error: undefined })
        setExpanded((prev) => {
          const next = { ...prev, [`conn:${id}`]: true }
          const first = schemas[0]
          if (first) {
            next[`schema:${id}:${first.name}`] = true
            next[`tables:${id}:${first.name}`] = true
          }
          return next
        })
      } catch (err) {
        await window.dbApi.disconnect(id)
        updateRuntime(id, {
          connecting: false,
          connected: false,
          error: (err as Error).message,
        })
      }
    },
    [connections, loadMetadata, updateRuntime]
  )

  const handleDisconnect = useCallback(
    async (id: string) => {
      await window.dbApi.disconnect(id)
      updateRuntime(id, { connected: false, schemas: [], error: undefined })
      closeTabsForConnection(id)
      if (activeConnectionId === id) {
        setActiveConnectionId(null)
      }
    },
    [activeConnectionId, closeTabsForConnection, updateRuntime]
  )

  const handleRefresh = useCallback(
    async (id: string) => {
      if (!runtime[id]?.connected) {
        await handleConnect(id)
        return
      }
      try {
        const schemas = await loadMetadata(id)
        updateRuntime(id, { schemas })
      } catch (err) {
        setStatusMessage((err as Error).message)
      }
    },
    [runtime, handleConnect, loadMetadata, updateRuntime]
  )

  const handleAddDatabase = useCallback(
    async (
      name: string,
      config: ConnectionConfig,
      meta: { alias: string; tags: string[] }
    ) => {
      setDialogLoading(true)
      const id = generateId()
      addConnection({
        id,
        name,
        alias: meta.alias || undefined,
        tags: meta.tags.length ? meta.tags : undefined,
        config,
      })

      const res = await window.dbApi.connect(id, configToPayload(config))
      if (!res.success) {
        setStatusMessage(res.error ?? 'Connection failed')
        setDialogLoading(false)
        return
      }

      try {
        const schemas = await loadMetadata(id)
        updateRuntime(id, { connected: true, schemas })
        setActiveConnectionId(id)
        setExpanded((prev) => {
          const next = {
            ...prev,
            [`conn:${id}`]: true,
          }
          const first = schemas[0]
          if (first) {
            next[`schema:${id}:${first.name}`] = true
            next[`tables:${id}:${first.name}`] = true
          }
          return next
        })
        const tabId = newQueryTabId(id)
        setTabs((prev) => [
          ...prev,
          { id: tabId, type: 'query', connectionId: id, label: 'Query 1' },
        ])
        setQueryStates((prev) => ({ ...prev, [tabId]: emptyQueryState() }))
        setActiveTabId(tabId)
        setShowDialog(false)
        setEditingConnectionId(null)
      } catch (err) {
        await window.dbApi.disconnect(id)
        setStatusMessage((err as Error).message)
      }
      setDialogLoading(false)
    },
    [addConnection, loadMetadata, updateRuntime]
  )

  const handleEditDatabase = useCallback(
    async (
      name: string,
      config: ConnectionConfig,
      meta: { alias: string; tags: string[] }
    ) => {
      if (!editingConnectionId) return

      setDialogLoading(true)
      const id = editingConnectionId
      const wasConnected = runtime[id]?.connected

      if (wasConnected) {
        await window.dbApi.disconnect(id)
        updateRuntime(id, { connected: false, schemas: [], error: undefined })
      }

      updateConnection(id, {
        name,
        alias: meta.alias || undefined,
        tags: meta.tags.length ? meta.tags : undefined,
        config,
      })

      const res = await window.dbApi.connect(id, configToPayload(config))
      if (!res.success) {
        setStatusMessage(res.error ?? 'Connection failed')
        setDialogLoading(false)
        return
      }

      try {
        const schemas = await loadMetadata(id)
        updateRuntime(id, { connected: true, schemas, error: undefined })
        setShowDialog(false)
        setEditingConnectionId(null)
      } catch (err) {
        await window.dbApi.disconnect(id)
        updateRuntime(id, { connected: false, schemas: [], error: (err as Error).message })
        setStatusMessage((err as Error).message)
      }
      setDialogLoading(false)
    },
    [editingConnectionId, runtime, updateConnection, loadMetadata, updateRuntime]
  )

  const handleOpenAddDialog = useCallback(() => {
    setEditingConnectionId(null)
    setShowDialog(true)
  }, [])

  const handleOpenEditDialog = useCallback((id: string) => {
    setEditingConnectionId(id)
    setShowDialog(true)
  }, [])

  const handleRemove = useCallback(
    async (id: string) => {
      await window.dbApi.disconnect(id)
      removeConnection(id)
      setRuntime((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      closeTabsForConnection(id)
      if (activeConnectionId === id) {
        setActiveConnectionId(null)
      }
    },
    [activeConnectionId, closeTabsForConnection, removeConnection]
  )

  const loadTableData = useCallback(
    async (
      tabId: string,
      connectionId: string,
      schema: string,
      table: string,
      offset = 0,
      append = false,
      filters: TableFilter[] = []
    ) => {
      setTableStates((prev) => ({
        ...prev,
        [tabId]: {
          ...(prev[tabId] ?? emptyTableState()),
          loading: true,
          error: null,
        },
      }))

      const res = await window.dbApi.getTableData(
        connectionId,
        table,
        schema,
        PAGE_SIZE,
        offset,
        filters
      )

      setTableStates((prev) => {
        const current = prev[tabId] ?? emptyTableState()
        if (res.success && res.data) {
          const result: QueryResult = append && current.result
            ? {
                ...res.data,
                rows: [...current.result.rows, ...res.data.rows],
                rowCount: current.result.rowCount + res.data.rowCount,
                hasMore: res.data.hasMore,
              }
            : res.data

          return {
            ...prev,
            [tabId]: {
              ...current,
              result,
              error: null,
              loading: false,
              offset,
              filters,
            },
          }
        }

        return {
          ...prev,
          [tabId]: {
            ...current,
            error: res.error ?? 'Failed to load table data',
            loading: false,
            result: append ? current.result : null,
          },
        }
      })
    },
    []
  )

  const loadTableSchema = useCallback(
    async (tabId: string, connectionId: string, schema: string, table: string) => {
      setTableStates((prev) => ({
        ...prev,
        [tabId]: {
          ...(prev[tabId] ?? emptyTableState()),
          schemaLoading: true,
        },
      }))

      const res = await window.dbApi.getTableSchema(connectionId, table, schema)

      setTableStates((prev) => ({
        ...prev,
        [tabId]: {
          ...(prev[tabId] ?? emptyTableState()),
          schema: res.success ? (res.columns ?? null) : null,
          schemaLoading: false,
        },
      }))
    },
    []
  )

  const handleTableFilterChange = useCallback(
    (tabId: string, connectionId: string, schema: string, table: string, filters: TableFilter[]) => {
      let shouldLoad = false
      setTableStates((prev) => {
        const current = prev[tabId] ?? emptyTableState()
        if (sameTableFilters(filters, current.filters)) return prev
        shouldLoad = true
        return {
          ...prev,
          [tabId]: { ...current, filters },
        }
      })
      if (shouldLoad) {
        loadTableData(tabId, connectionId, schema, table, 0, false, filters)
      }
    },
    [loadTableData]
  )

  const handleToggleTableSchema = useCallback((tabId: string) => {
    setTableStates((prev) => {
      const current = prev[tabId] ?? emptyTableState()
      return {
        ...prev,
        [tabId]: { ...current, showSchema: !current.showSchema },
      }
    })
  }, [])

  const openOrActivateTab = useCallback((tab: Tab) => {
    setTabs((prev) => (prev.some((t) => t.id === tab.id) ? prev : [...prev, tab]))
    setActiveTabId(tab.id)
    setActiveConnectionId(tab.connectionId)
  }, [])

  const handleSelectTable = useCallback(
    (connectionId: string, schema: string, table: string) => {
      const id = tableTabId(connectionId, schema, table)
      const isNew = !tabs.some((t) => t.id === id)

      openOrActivateTab({
        id,
        type: 'table',
        connectionId,
        schema,
        table,
      })

      if (isNew) {
        loadTableData(id, connectionId, schema, table, 0, false)
        loadTableSchema(id, connectionId, schema, table)
      }
    },
    [tabs, openOrActivateTab, loadTableData, loadTableSchema]
  )

  const handleOpenQuery = useCallback(
    (connectionId: string) => {
      const tabId = newQueryTabId(connectionId)
      const queryCount =
        tabs.filter((t) => t.type === 'query' && t.connectionId === connectionId).length + 1
      openOrActivateTab({
        id: tabId,
        type: 'query',
        connectionId,
        label: `Query ${queryCount}`,
      })
      setQueryStates((prev) => ({ ...prev, [tabId]: emptyQueryState() }))
    },
    [tabs, openOrActivateTab]
  )

  const handleCloseTab = useCallback(
    (tabId: string) => {
      setTabs((prev) => {
        const index = prev.findIndex((t) => t.id === tabId)
        const remaining = prev.filter((t) => t.id !== tabId)
        setActiveTabId((current) => {
          if (current !== tabId) return current
          if (remaining.length === 0) return null
          const nextIndex = Math.min(index, remaining.length - 1)
          return remaining[nextIndex].id
        })
        return remaining
      })
      setTableStates((prev) => {
        const next = { ...prev }
        delete next[tabId]
        return next
      })
      setQueryStates((prev) => {
        const next = { ...prev }
        delete next[tabId]
        return next
      })
    },
    []
  )

  const handleCloseAllTabs = useCallback(() => {
    setTabs([])
    setActiveTabId(null)
    setTableStates({})
    setQueryStates({})
  }, [])

  const handleCloseActiveTab = useCallback(() => {
    if (showDialog) {
      setShowDialog(false)
      setEditingConnectionId(null)
      return
    }
    if (showShortcutsPanel) {
      setShowShortcutsPanel(false)
      return
    }
    if (activeTabId) {
      handleCloseTab(activeTabId)
    }
  }, [showDialog, showShortcutsPanel, activeTabId, handleCloseTab])

  const handleSelectTab = useCallback(
    (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId)
      if (!tab) return
      setActiveTabId(tabId)
      setActiveConnectionId(tab.connectionId)
    },
    [tabs]
  )

  const handleSqlChange = useCallback((tabId: string, sql: string) => {
    setQueryStates((prev) => ({
      ...prev,
      [tabId]: { ...(prev[tabId] ?? emptyQueryState()), sql },
    }))
  }, [])

  const handleExecuteQuery = useCallback(
    async (sql: string) => {
      const activeTab = tabs.find((t) => t.id === activeTabId)
      if (!activeTab || activeTab.type !== 'query') return

      const tabId = activeTab.id
      const gen = (queryGenerationRef.current[tabId] ?? 0) + 1
      queryGenerationRef.current[tabId] = gen

      setQueryStates((prev) => ({
        ...prev,
        [tabId]: {
          ...(prev[tabId] ?? emptyQueryState()),
          sql,
          loading: true,
          error: null,
          offset: 0,
          lastExecutedSql: sql,
        },
      }))

      const res = await window.dbApi.executeQuery(
        activeTab.connectionId,
        sql,
        QUERY_PAGE_SIZE,
        0
      )

      if (queryGenerationRef.current[tabId] !== gen) return

      if (res.success && res.data) {
        addToHistory(activeTab.connectionId, sql)
        setQueryStates((prev) => ({
          ...prev,
          [tabId]: {
            ...(prev[tabId] ?? emptyQueryState()),
            sql,
            result: res.data ?? null,
            error: null,
            loading: false,
            offset: 0,
            lastExecutedSql: sql,
          },
        }))
      } else {
        setQueryStates((prev) => ({
          ...prev,
          [tabId]: {
            ...(prev[tabId] ?? emptyQueryState()),
            sql,
            error: res.error ?? 'Query failed',
            loading: false,
            lastExecutedSql: sql,
          },
        }))
      }
    },
    [tabs, activeTabId, addToHistory]
  )

  const handleLoadMoreQuery = useCallback(async () => {
    const activeTab = tabs.find((t) => t.id === activeTabId)
    if (!activeTab || activeTab.type !== 'query') return

    const tabId = activeTab.id
    const state = queryStates[tabId]
    const sql = state?.lastExecutedSql
    if (!sql || !state?.result?.hasMore) return

    const nextOffset = state.offset + QUERY_PAGE_SIZE
    const gen = (queryGenerationRef.current[tabId] ?? 0) + 1
    queryGenerationRef.current[tabId] = gen

    setQueryStates((prev) => ({
      ...prev,
      [tabId]: { ...(prev[tabId] ?? emptyQueryState()), loading: true },
    }))

    const res = await window.dbApi.executeQuery(
      activeTab.connectionId,
      sql,
      QUERY_PAGE_SIZE,
      nextOffset
    )

    if (queryGenerationRef.current[tabId] !== gen) return

    if (res.success && res.data) {
      setQueryStates((prev) => {
        const current = prev[tabId] ?? emptyQueryState()
        const merged: QueryResult = {
          ...res.data!,
          rows: [...(current.result?.rows ?? []), ...res.data!.rows],
          rowCount: (current.result?.rowCount ?? 0) + res.data!.rowCount,
        }
        return {
          ...prev,
          [tabId]: {
            ...current,
            result: merged,
            error: null,
            loading: false,
            offset: nextOffset,
          },
        }
      })
    } else {
      setQueryStates((prev) => ({
        ...prev,
        [tabId]: {
          ...(prev[tabId] ?? emptyQueryState()),
          error: res.error ?? 'Failed to load more rows',
          loading: false,
        },
      }))
    }
  }, [tabs, activeTabId, queryStates])

  const handleCancelQuery = useCallback(async () => {
    const activeTab = tabs.find((t) => t.id === activeTabId)
    if (!activeTab || activeTab.type !== 'query') return

    const tabId = activeTab.id
    queryGenerationRef.current[tabId] = (queryGenerationRef.current[tabId] ?? 0) + 1

    await window.dbApi.cancelQuery(activeTab.connectionId)

    setQueryStates((prev) => ({
      ...prev,
      [tabId]: {
        ...(prev[tabId] ?? emptyQueryState()),
        loading: false,
        error: 'Query cancelled',
      },
    }))
  }, [tabs, activeTabId])

  const getColumnsForAutocomplete = useCallback(
    async (connectionId: string, schema: string, table: string): Promise<string[]> => {
      const cacheKey = `${connectionId}:${schema}.${table}`
      if (columnCacheRef.current[cacheKey]) {
        return columnCacheRef.current[cacheKey]
      }
      const res = await window.dbApi.getTableSchema(connectionId, table, schema)
      if (res.success && res.columns) {
        const names = res.columns.map((c) => c.name)
        columnCacheRef.current[cacheKey] = names
        return names
      }
      return []
    },
    []
  )

  const toggleExpand = useCallback((key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const getTabLabel = useCallback(
    (tab: Tab) => {
      if (tab.type === 'query') {
        const sql = queryStates[tab.id]?.sql ?? ''
        return formatQueryTabLabel(sql, tab.label)
      }
      return `${tab.schema}.${tab.table}`
    },
    [queryStates]
  )

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null
  const activeConnection = connections.find(
    (c) => c.id === (activeTab?.connectionId ?? activeConnectionId)
  )

  const shortcutHandlers = useMemo(
    () => ({
      onCloseTab: handleCloseActiveTab,
      onCloseAllTabs: () => {
        if (showDialog) {
          setShowDialog(false)
          setEditingConnectionId(null)
        }
        setShowShortcutsPanel(false)
        handleCloseAllTabs()
      },
      onNewQueryTab: () => {
        const connId = activeTab?.connectionId ?? activeConnectionId
        if (!connId || !runtime[connId]?.connected) return
        handleOpenQuery(connId)
      },
      onNewDatabase: handleOpenAddDialog,
      onNextTab: () => {
        if (tabs.length === 0) return
        const idx = tabs.findIndex((t) => t.id === activeTabId)
        const next = tabs[(idx + 1) % tabs.length]
        handleSelectTab(next.id)
      },
      onPrevTab: () => {
        if (tabs.length === 0) return
        const idx = tabs.findIndex((t) => t.id === activeTabId)
        const prev = tabs[(idx - 1 + tabs.length) % tabs.length]
        handleSelectTab(prev.id)
      },
      onSwitchTab: (index: number) => {
        const tab = tabs[index]
        if (tab) handleSelectTab(tab.id)
      },
      onFocusSearch: () => {
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      },
      onRunQuery: () => {
        if (activeTab?.type === 'query') {
          queryEditorRef.current?.run()
        }
      },
      onRefresh: () => {
        if (activeTab?.type === 'table') {
          const state = tableStates[activeTab.id]
          loadTableData(
            activeTab.id,
            activeTab.connectionId,
            activeTab.schema,
            activeTab.table,
            0,
            false,
            state?.filters ?? []
          )
        } else {
          const connId = activeTab?.connectionId ?? activeConnectionId
          if (connId) handleRefresh(connId)
        }
      },
      onToggleShortcuts: () => setShowShortcutsPanel((open) => !open),
      onEscape: () => {
        if (showDialog) {
          setShowDialog(false)
          setEditingConnectionId(null)
        } else if (showShortcutsPanel) {
          setShowShortcutsPanel(false)
        }
      },
      modalOpen: showDialog,
    }),
    [
      handleCloseActiveTab,
      handleCloseAllTabs,
      handleOpenAddDialog,
      handleOpenQuery,
      handleSelectTab,
      handleRefresh,
      activeTab,
      activeConnectionId,
      activeTabId,
      runtime,
      tabs,
      showDialog,
      showShortcutsPanel,
      loadTableData,
      tableStates,
    ]
  )

  useKeyboardShortcuts(shortcutHandlers)
  useElectronCloseTabShortcut(handleCloseActiveTab)

  useEffect(() => {
    if (!connectionsLoaded || !sessionLoaded || sessionRestoredRef.current) return
    sessionRestoredRef.current = true

    async function restore() {
      const session = initialSession
      if (!session || session.tabs.length === 0) {
        enablePersistence()
        return
      }

      const validConnectionIds = new Set(connections.map((c) => c.id))
      const validTabs = session.tabs.filter((t) => validConnectionIds.has(t.connectionId))

      if (validTabs.length === 0) {
        enablePersistence()
        return
      }

      const validTabIds = new Set(validTabs.map((t) => t.id))
      const restoredActiveTabId =
        session.activeTabId && validTabIds.has(session.activeTabId)
          ? session.activeTabId
          : validTabs[validTabs.length - 1].id

      const restoredActiveTab = validTabs.find((t) => t.id === restoredActiveTabId)!
      const restoredActiveConnectionId = validConnectionIds.has(session.activeConnectionId ?? '')
        ? session.activeConnectionId
        : restoredActiveTab.connectionId

      setTabs(validTabs)
      setActiveTabId(restoredActiveTabId)
      setActiveConnectionId(restoredActiveConnectionId ?? restoredActiveTab.connectionId)
      setExpanded(session.expanded ?? {})

      const restoredQueryStates: Record<string, QueryTabState> = {}
      for (const tab of validTabs) {
        if (tab.type === 'query') {
          restoredQueryStates[tab.id] = {
            ...emptyQueryState(),
            sql: session.querySql[tab.id] ?? emptyQueryState().sql,
          }
        }
      }
      setQueryStates(restoredQueryStates)

      const connectionIds = [...new Set(validTabs.map((t) => t.connectionId))]
      for (const connId of connectionIds) {
        await handleConnect(connId)
      }

      for (const tab of validTabs) {
        if (tab.type === 'table') {
          loadTableData(tab.id, tab.connectionId, tab.schema, tab.table, 0, false)
          loadTableSchema(tab.id, tab.connectionId, tab.schema, tab.table)
        }
      }

      enablePersistence()
    }

    void restore()
  }, [
    connectionsLoaded,
    sessionLoaded,
    initialSession,
    connections,
    handleConnect,
    loadTableData,
    loadTableSchema,
    enablePersistence,
  ])

  useEffect(() => {
    if (!persistenceEnabled) return

    const timer = setTimeout(() => {
      persist({
        tabs,
        activeTabId,
        activeConnectionId,
        querySql: Object.fromEntries(
          tabs
            .filter((t) => t.type === 'query')
            .map((t) => [t.id, queryStates[t.id]?.sql ?? 'SELECT 1;'])
        ),
        expanded,
      })
    }, 300)

    return () => clearTimeout(timer)
  }, [
    tabs,
    activeTabId,
    activeConnectionId,
    queryStates,
    expanded,
    persistenceEnabled,
    persist,
  ])

  const selectedTable =
    activeTab?.type === 'table'
      ? {
          connectionId: activeTab.connectionId,
          schema: activeTab.schema,
          table: activeTab.table,
        }
      : null

  const activeTableState =
    activeTab?.type === 'table'
      ? (tableStates[activeTab.id] ?? emptyTableState())
      : null

  const activeQueryState =
    activeTab?.type === 'query'
      ? (queryStates[activeTab.id] ?? emptyQueryState())
      : null

  const autocompleteCatalog: AutocompleteCatalog = useMemo(() => {
    const connId = activeTab?.connectionId ?? activeConnectionId
    if (!connId) return { schemas: [] }
    const schemas = runtime[connId]?.schemas ?? []
    return {
      schemas: schemas.map((s) => ({ name: s.name, tables: s.tables })),
    }
  }, [activeTab?.connectionId, activeConnectionId, runtime])

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-right">
          {statusMessage && (
            <div className="status-message badge badge-error">{statusMessage}</div>
          )}
          <GitHubButton />
          <ShortcutsButton
            buttonRef={shortcutsButtonRef}
            expanded={showShortcutsPanel}
            onClick={() => setShowShortcutsPanel((open) => !open)}
          />
          <ShortcutsPanel
            open={showShortcutsPanel}
            onClose={() => setShowShortcutsPanel(false)}
            anchorRef={shortcutsButtonRef}
          />
        </div>
      </header>

      <div className="app-body">
        <DatabaseExplorer
          connections={connections}
          runtime={runtime}
          activeConnectionId={activeConnectionId}
          expanded={expanded}
          onToggleExpand={toggleExpand}
          onAddDatabase={handleOpenAddDialog}
          onEditConnection={handleOpenEditDialog}
          onSelectConnection={setActiveConnectionId}
          onSelectTable={handleSelectTable}
          onOpenQuery={handleOpenQuery}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onRemove={handleRemove}
          onRefresh={handleRefresh}
          selectedTable={selectedTable}
          queryActiveFor={
            activeTab?.type === 'query' ? activeTab.connectionId : null
          }
          searchInputRef={searchInputRef}
        />

        <main className="main-content">
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            getLabel={getTabLabel}
            onSelect={handleSelectTab}
            onClose={handleCloseTab}
          />

          {!activeTab && (
            <div className="welcome">
              <div className="welcome-brand">
                <div className="welcome-logo" aria-hidden="true">
                  <img src={appIcons.png256} alt="" width={40} height={40} />
                </div>
                <span className="welcome-title">DBGrep</span>
              </div>
              <p className="welcome-desc">
                Add a database connection to browse tables or open a query console.
              </p>
              <button
                className="btn btn-primary welcome-add-btn"
                onClick={handleOpenAddDialog}
                type="button"
              >
                + Add Database
              </button>
              <div className="welcome-supported">
                PostgreSQL · MySQL · SQLite · SQL Server
              </div>
              <p className="welcome-github">
                Found a bug or want to help?{' '}
                <button
                  type="button"
                  className="welcome-github-link"
                  onClick={() => openExternalUrl(GITHUB_REPO_URL)}
                >
                  Contribute or share feedback on GitHub
                </button>
              </p>
            </div>
          )}

          {activeTab?.type === 'query' && activeConnection && activeQueryState && (
            <QueryEditor
              ref={queryEditorRef}
              sql={activeQueryState.sql}
              result={activeQueryState.result}
              error={activeQueryState.error}
              loading={activeQueryState.loading}
              connectionId={activeTab.connectionId}
              dbClient={activeConnection.config.client}
              lastExecutedSql={activeQueryState.lastExecutedSql}
              catalog={autocompleteCatalog}
              history={getHistory(activeTab.connectionId)}
              getColumns={(schema, table) =>
                getColumnsForAutocomplete(activeTab.connectionId, schema, table)
              }
              onSqlChange={(sql) => handleSqlChange(activeTab.id, sql)}
              onExecute={handleExecuteQuery}
              onCancel={handleCancelQuery}
              onLoadMore={
                activeQueryState.result?.hasMore ? handleLoadMoreQuery : undefined
              }
              hasMore={!!activeQueryState.result?.hasMore}
            />
          )}

          {activeTab?.type === 'table' && activeConnection && activeTableState && (
            <TableBrowser
              title={`${activeTab.schema}.${activeTab.table}`}
              result={activeTableState.result}
              error={activeTableState.error}
              loading={activeTableState.loading}
              schema={activeTableState.schema}
              schemaLoading={activeTableState.schemaLoading}
              showSchema={activeTableState.showSchema}
              filters={activeTableState.filters}
              onFilterChange={(filters) =>
                handleTableFilterChange(
                  activeTab.id,
                  activeTab.connectionId,
                  activeTab.schema,
                  activeTab.table,
                  filters
                )
              }
              onToggleSchema={() => handleToggleTableSchema(activeTab.id)}
              onRefresh={() =>
                loadTableData(
                  activeTab.id,
                  activeTab.connectionId,
                  activeTab.schema,
                  activeTab.table,
                  0,
                  false,
                  activeTableState.filters
                )
              }
              onLoadMore={
                activeTableState.result?.hasMore
                  ? () =>
                      loadTableData(
                        activeTab.id,
                        activeTab.connectionId,
                        activeTab.schema,
                        activeTab.table,
                        activeTableState.offset + PAGE_SIZE,
                        true,
                        activeTableState.filters
                      )
                  : undefined
              }
              hasMore={!!activeTableState.result?.hasMore}
            />
          )}
        </main>
      </div>

      {showDialog && (
        <ConnectionDialog
          editing={!!editingConnectionId}
          onSave={editingConnectionId ? handleEditDatabase : handleAddDatabase}
          onClose={() => {
            setShowDialog(false)
            setEditingConnectionId(null)
          }}
          loading={dialogLoading}
          initialName={
            editingConnectionId
              ? connections.find((c) => c.id === editingConnectionId)?.name
              : undefined
          }
          initialAlias={
            editingConnectionId
              ? connections.find((c) => c.id === editingConnectionId)?.alias ?? ''
              : undefined
          }
          initialTags={
            editingConnectionId
              ? connections.find((c) => c.id === editingConnectionId)?.tags ?? []
              : undefined
          }
          initialConfig={
            editingConnectionId
              ? connections.find((c) => c.id === editingConnectionId)?.config
              : undefined
          }
        />
      )}
    </div>
  )
}
