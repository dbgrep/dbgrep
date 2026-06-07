import { useState, useCallback, type CSSProperties } from 'react'
import type { SavedConnection, ConnectionRuntime } from '../types'
import { CLIENT_ICONS } from '../types'
import {
  connectionMatchesQuery,
  schemaMatchesQuery,
  tableMatchesQuery,
} from '../connectionSearch'
import ContextMenu, { type ContextMenuItem } from './ContextMenu'
import HighlightText from './HighlightText'
import './DatabaseExplorer.css'

interface ContextMenuState {
  x: number
  y: number
  connectionId: string
}

interface Props {
  connections: SavedConnection[]
  runtime: Record<string, ConnectionRuntime>
  activeConnectionId: string | null
  expanded: Record<string, boolean>
  onToggleExpand: (key: string) => void
  onAddDatabase: () => void
  onEditConnection: (id: string) => void
  onSelectConnection: (id: string) => void
  onSelectTable: (connectionId: string, schema: string, table: string) => void
  onOpenQuery: (connectionId: string) => void
  onConnect: (id: string) => void
  onDisconnect: (id: string) => void
  onRemove: (id: string) => void
  onRefresh: (id: string) => void
  selectedTable: { connectionId: string; schema: string; table: string } | null
  queryActiveFor: string | null
  searchInputRef?: React.RefObject<HTMLInputElement | null>
}

function TreeNode({
  label,
  icon,
  count,
  depth,
  expanded,
  onToggle,
  onClick,
  active,
  children,
  actions,
  subtitle,
  onContextMenu,
}: {
  label: React.ReactNode
  icon?: string
  count?: number
  depth: number
  expanded?: boolean
  onToggle?: () => void
  onClick?: () => void
  active?: boolean
  children?: React.ReactNode
  actions?: React.ReactNode
  subtitle?: React.ReactNode
  onContextMenu?: (e: React.MouseEvent) => void
}) {
  const hasChildren = children !== undefined
  const showChevron = hasChildren || onToggle

  return (
    <div className="tree-node">
      <div
        className={`tree-row ${active ? 'active' : ''}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onContextMenu={onContextMenu}
      >
        {showChevron ? (
          <button className="tree-chevron" onClick={onToggle} type="button">
            {expanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className="tree-chevron-spacer" />
        )}
        <button className="tree-label" onClick={onClick ?? onToggle} type="button">
          {icon && <span className="tree-icon">{icon}</span>}
          <span className="tree-label-text">
            <span className="tree-text">{label}</span>
            {subtitle}
          </span>
          {count !== undefined && <span className="tree-count">({count})</span>}
        </button>
        {actions && <div className="tree-actions">{actions}</div>}
      </div>
      {expanded && children}
    </div>
  )
}

const TAG_PALETTE = [
  { bg: 'rgba(124, 58, 237, 0.14)', color: '#6d28d9', border: 'rgba(124, 58, 237, 0.22)' },
  { bg: 'rgba(37, 99, 235, 0.12)', color: '#1d4ed8', border: 'rgba(37, 99, 235, 0.2)' },
  { bg: 'rgba(13, 148, 136, 0.12)', color: '#0f766e', border: 'rgba(13, 148, 136, 0.2)' },
  { bg: 'rgba(217, 119, 6, 0.12)', color: '#b45309', border: 'rgba(217, 119, 6, 0.22)' },
  { bg: 'rgba(219, 39, 119, 0.12)', color: '#be185d', border: 'rgba(219, 39, 119, 0.2)' },
  { bg: 'rgba(79, 70, 229, 0.12)', color: '#4338ca', border: 'rgba(79, 70, 229, 0.2)' },
] as const

function tagPaletteIndex(tag: string): number {
  let hash = 0
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 31 + tag.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % TAG_PALETTE.length
}

function ConnectionTags({ tags, searchQuery }: { tags?: string[]; searchQuery: string }) {
  if (!tags?.length) return null
  return (
    <span className="conn-tags">
      {tags.map((tag) => {
        const palette = TAG_PALETTE[tagPaletteIndex(tag)]
        return (
          <span
            key={tag}
            className="conn-tag"
            style={
              {
                '--tag-bg': palette.bg,
                '--tag-color': palette.color,
                '--tag-border': palette.border,
              } as CSSProperties
            }
          >
            <HighlightText text={tag} query={searchQuery} />
          </span>
        )
      })}
    </span>
  )
}

export default function DatabaseExplorer({
  connections,
  runtime,
  activeConnectionId,
  expanded,
  onToggleExpand,
  onAddDatabase,
  onEditConnection,
  onSelectConnection,
  onSelectTable,
  onOpenQuery,
  onConnect,
  onDisconnect,
  onRemove,
  onRefresh,
  selectedTable,
  queryActiveFor,
  searchInputRef,
}: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  const openConnectionMenu = useCallback(
    (e: React.MouseEvent, connectionId: string) => {
      e.preventDefault()
      e.stopPropagation()
      setContextMenu({ x: e.clientX, y: e.clientY, connectionId })
    },
    []
  )

  const getConnectionMenuItems = useCallback(
    (conn: SavedConnection): ContextMenuItem[] => {
      const rt = runtime[conn.id]
      const isConnected = rt?.connected
      const isConnecting = rt?.connecting

      const items: ContextMenuItem[] = []

      if (isConnected) {
        items.push({
          id: 'query',
          label: 'Open Query Console',
          onClick: () => onOpenQuery(conn.id),
        })
        items.push({
          id: 'refresh',
          label: 'Refresh',
          disabled: isConnecting,
          onClick: () => onRefresh(conn.id),
        })
        items.push({
          id: 'disconnect',
          label: 'Disconnect',
          disabled: isConnecting,
          onClick: () => onDisconnect(conn.id),
        })
      } else {
        items.push({
          id: 'connect',
          label: 'Connect',
          disabled: isConnecting,
          onClick: () => onConnect(conn.id),
        })
      }

      items.push({ id: 'sep-1', label: '', onClick: () => {}, separator: true })
      items.push({
        id: 'edit',
        label: 'Edit…',
        onClick: () => onEditConnection(conn.id),
      })
      items.push({ id: 'sep-2', label: '', onClick: () => {}, separator: true })
      items.push({
        id: 'remove',
        label: 'Remove',
        danger: true,
        onClick: () => onRemove(conn.id),
      })

      return items
    },
    [runtime, onOpenQuery, onRefresh, onDisconnect, onConnect, onEditConnection, onRemove]
  )

  const filteredConnections = connections.filter((conn) =>
    connectionMatchesQuery(conn, searchQuery, runtime[conn.id])
  )

  const searching = searchQuery.trim().length > 0
  const contextConnection = contextMenu
    ? connections.find((c) => c.id === contextMenu.connectionId)
    : null

  return (
    <aside className="db-explorer">
      <div className="explorer-header">
        <span className="explorer-title">Database Explorer</span>
        <div className="explorer-toolbar">
          <button
            className="toolbar-btn"
            onClick={onAddDatabase}
            title="Add database"
            type="button"
          >
            +
          </button>
        </div>
      </div>

      {connections.length > 0 && (
        <div className="explorer-search">
          <input
            ref={searchInputRef}
            type="search"
            className="explorer-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search databases, tags, tables…"
            spellCheck={false}
          />
          {searchQuery && (
            <button
              className="explorer-search-clear"
              onClick={() => setSearchQuery('')}
              title="Clear search"
              type="button"
            >
              ✕
            </button>
          )}
        </div>
      )}

      <div className="explorer-tree">
        {connections.length === 0 && (
          <div className="explorer-empty">
            <p>No databases configured</p>
          </div>
        )}

        {connections.length > 0 && filteredConnections.length === 0 && (
          <div className="explorer-empty">
            <p>No matches for &ldquo;{searchQuery.trim()}&rdquo;</p>
          </div>
        )}

        {filteredConnections.map((conn) => {
          const rt = runtime[conn.id]
          const connKey = `conn:${conn.id}`
          const isExpanded = searching || (expanded[connKey] ?? false)
          const isConnected = rt?.connected
          const isActive = activeConnectionId === conn.id
          const isHovered = hoveredId === conn.id
          const displayLabel = conn.alias?.trim() || conn.name
          const showAliasHint = conn.alias?.trim() && conn.alias.trim() !== conn.name

          const visibleSchemas = (rt?.schemas ?? []).filter((schema) =>
            schemaMatchesQuery(schema.name, schema.tables, searchQuery)
          )

          return (
            <div
              key={conn.id}
              onMouseEnter={() => setHoveredId(conn.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <TreeNode
                label={<HighlightText text={displayLabel} query={searchQuery} />}
                icon={CLIENT_ICONS[conn.config.client]}
                depth={0}
                expanded={isExpanded}
                onToggle={() => {
                  if (!isConnected) {
                    onConnect(conn.id)
                  } else {
                    onToggleExpand(connKey)
                  }
                }}
                onClick={() => {
                  onSelectConnection(conn.id)
                  if (!isConnected) onConnect(conn.id)
                  else onToggleExpand(connKey)
                }}
                onContextMenu={(e) => openConnectionMenu(e, conn.id)}
                active={isActive}
                subtitle={
                  <>
                    {showAliasHint && (
                      <span className="conn-alias-hint">
                        <HighlightText text={conn.name} query={searchQuery} />
                      </span>
                    )}
                    <ConnectionTags tags={conn.tags} searchQuery={searchQuery} />
                  </>
                }
                actions={
                  (isHovered || isActive) && (
                    <>
                      <button
                        className="tree-action-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          onEditConnection(conn.id)
                        }}
                        title="Edit"
                        type="button"
                      >
                        ✎
                      </button>
                      {isConnected ? (
                        <button
                          className="tree-action-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            onRefresh(conn.id)
                          }}
                          title="Refresh"
                          type="button"
                        >
                          ↻
                        </button>
                      ) : (
                        <button
                          className="tree-action-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            onConnect(conn.id)
                          }}
                          title="Connect"
                          type="button"
                        >
                          ⚡
                        </button>
                      )}
                      {isConnected && (
                        <button
                          className="tree-action-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDisconnect(conn.id)
                          }}
                          title="Disconnect"
                          type="button"
                        >
                          ⊘
                        </button>
                      )}
                      <button
                        className="tree-action-btn danger"
                        onClick={(e) => {
                          e.stopPropagation()
                          onRemove(conn.id)
                        }}
                        title="Remove"
                        type="button"
                      >
                        ✕
                      </button>
                    </>
                  )
                }
              >
                {rt?.connecting && (
                  <div className="tree-status" style={{ paddingLeft: '24px' }}>
                    <span className="spinner" /> Connecting...
                  </div>
                )}
                {rt?.error && (
                  <div className="tree-error" style={{ paddingLeft: '24px' }}>
                    {rt.error}
                  </div>
                )}
                {isConnected && (
                  <>
                    <TreeNode
                      label="Query Console"
                      icon="⌘"
                      depth={1}
                      onClick={() => onOpenQuery(conn.id)}
                      active={queryActiveFor === conn.id}
                    />
                    {visibleSchemas.map((schema) => {
                      const schemaKey = `schema:${conn.id}:${schema.name}`
                      const tablesKey = `tables:${conn.id}:${schema.name}`
                      const schemaExpanded = searching || (expanded[schemaKey] ?? false)
                      const tablesExpanded = searching || (expanded[tablesKey] ?? false)
                      const visibleTables = schema.tables.filter((table) =>
                        tableMatchesQuery(table, searchQuery)
                      )

                      return (
                        <TreeNode
                          key={schema.name}
                          label={<HighlightText text={schema.name} query={searchQuery} />}
                          icon="◫"
                          depth={1}
                          expanded={schemaExpanded}
                          onToggle={() => onToggleExpand(schemaKey)}
                        >
                          <TreeNode
                            label="tables"
                            icon="▤"
                            count={visibleTables.length}
                            depth={2}
                            expanded={tablesExpanded}
                            onToggle={() => onToggleExpand(tablesKey)}
                          >
                            {visibleTables.map((table) => {
                              const isSelected =
                                selectedTable?.connectionId === conn.id &&
                                selectedTable?.schema === schema.name &&
                                selectedTable?.table === table

                              return (
                                <TreeNode
                                  key={table}
                                  label={<HighlightText text={table} query={searchQuery} />}
                                  icon="▥"
                                  depth={3}
                                  onClick={() =>
                                    onSelectTable(conn.id, schema.name, table)
                                  }
                                  active={isSelected}
                                />
                              )
                            })}
                          </TreeNode>
                        </TreeNode>
                      )
                    })}
                  </>
                )}
              </TreeNode>
            </div>
          )
        })}
      </div>

      {contextMenu && contextConnection && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getConnectionMenuItems(contextConnection)}
          onClose={closeContextMenu}
        />
      )}
    </aside>
  )
}
