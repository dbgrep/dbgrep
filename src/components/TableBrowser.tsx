import { useEffect, useRef, useState } from 'react'
import type { ColumnInfo, QueryResult } from '../types'
import { generateId } from '../types'
import {
  TABLE_FILTER_OPERATORS,
  filterNeedsValue,
  formatFilterSummary,
  getActiveFilters,
  sameTableFilters,
  type TableFilter,
  type TableFilterOperator,
} from '../tableFilters'
import ExportMenu from './ExportMenu'
import SortableResultTable from './SortableResultTable'
import './TableBrowser.css'

interface Props {
  title?: string
  result: QueryResult | null
  error: string | null
  loading: boolean
  schema: ColumnInfo[] | null
  schemaLoading: boolean
  showSchema: boolean
  filters: TableFilter[]
  onFilterChange: (filters: TableFilter[]) => void
  onToggleSchema: () => void
  onRefresh?: () => void
  onLoadMore?: () => void
  hasMore?: boolean
}

function formatDefault(value: string | null): string {
  if (value === null) return '—'
  return value
}

function createFilter(columns: string[]): TableFilter {
  return {
    id: generateId(),
    column: columns[0] ?? '',
    operator: 'contains',
    value: '',
  }
}

export default function TableBrowser({
  title,
  result,
  error,
  loading,
  schema,
  schemaLoading,
  showSchema,
  filters,
  onFilterChange,
  onToggleSchema,
  onRefresh,
  onLoadMore,
  hasMore,
}: Props) {
  const [draftFilters, setDraftFilters] = useState<TableFilter[]>(filters)
  const [filtersExpanded, setFiltersExpanded] = useState(filters.length > 0)
  const skipFilterEffect = useRef(true)

  useEffect(() => {
    setDraftFilters((prev) => (sameTableFilters(prev, filters) ? prev : filters))
    if (filters.length > 0) {
      setFiltersExpanded(true)
    }
  }, [filters])

  useEffect(() => {
    if (skipFilterEffect.current) {
      skipFilterEffect.current = false
      return
    }
    const timer = window.setTimeout(() => {
      const activeDraft = getActiveFilters(draftFilters)
      if (!sameTableFilters(activeDraft, filters)) {
        onFilterChange(activeDraft)
      }
    }, 300)
    return () => window.clearTimeout(timer)
  }, [draftFilters, filters, onFilterChange])

  const activeFilterCount = getActiveFilters(filters).length
  const columns = result?.columns ?? []

  if (loading && !result) {
    return (
      <div className="table-browser">
        <div className="table-browser-loading">
          <span className="spinner" />
          Loading...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="table-browser">
        <div className="table-browser-error">{error}</div>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="table-browser">
        <div className="table-browser-empty">Select a table to see results</div>
      </div>
    )
  }

  const updateFilter = (id: string, patch: Partial<TableFilter>) => {
    setDraftFilters((prev) =>
      prev.map((filter) => (filter.id === id ? { ...filter, ...patch } : filter))
    )
  }

  const removeFilter = (id: string) => {
    setDraftFilters((prev) => prev.filter((filter) => filter.id !== id))
  }

  const addFilter = () => {
    setDraftFilters((prev) => [...prev, createFilter(columns)])
    setFiltersExpanded(true)
  }

  const clearFilters = () => {
    setDraftFilters([])
    setFiltersExpanded(false)
  }

  return (
    <div className={`table-browser${showSchema ? ' schema-open' : ''}`}>
      <div className="table-browser-main">
        <div className="table-browser-header">
          <div className="header-left">
            {title && <h2 className="table-title">{title}</h2>}
            <span className="meta-info">
              {result.rowCount} row{result.rowCount !== 1 ? 's' : ''}
              {result.preview && result.limit != null && ` · preview (${result.limit}/page)`}
              {result.hasMore && ' · more available'}
              {' · '}
              {result.durationMs}ms
              {activeFilterCount > 0 && ` · ${activeFilterCount} filter${activeFilterCount !== 1 ? 's' : ''}`}
            </span>
          </div>
          <div className="header-actions">
            <ExportMenu
              result={result}
              filename={title ?? 'table-export'}
              disabled={loading}
            />
            <button
              className={`btn btn-secondary${filtersExpanded ? ' active' : ''}`}
              onClick={() => setFiltersExpanded((open) => !open)}
              type="button"
            >
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </button>
            {activeFilterCount > 0 && (
              <button className="btn btn-secondary" onClick={clearFilters} type="button">
                Clear filters
              </button>
            )}
            <button
              className={`btn btn-secondary${showSchema ? ' active' : ''}`}
              onClick={onToggleSchema}
              type="button"
            >
              Schema
            </button>
            {onRefresh && (
              <button className="btn btn-secondary" onClick={onRefresh} disabled={loading} type="button">
                {loading ? <span className="spinner" /> : '↻'} Refresh
              </button>
            )}
          </div>
        </div>

        {filtersExpanded && (
          <div className="table-filters-panel">
            {draftFilters.length === 0 ? (
              <p className="table-filters-empty">No filters applied. Add a filter to narrow results.</p>
            ) : (
              <div className="table-filters-list">
                {draftFilters.map((filter) => {
                  const needsValue = filterNeedsValue(filter.operator)
                  return (
                    <div key={filter.id} className="table-filter-row">
                      <select
                        className="table-filter-select"
                        value={filter.column}
                        onChange={(e) => updateFilter(filter.id, { column: e.target.value })}
                        aria-label="Filter column"
                      >
                        {columns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                      <select
                        className="table-filter-select"
                        value={filter.operator}
                        onChange={(e) =>
                          updateFilter(filter.id, {
                            operator: e.target.value as TableFilterOperator,
                            value: filterNeedsValue(e.target.value as TableFilterOperator)
                              ? filter.value
                              : undefined,
                          })
                        }
                        aria-label="Filter operator"
                      >
                        {TABLE_FILTER_OPERATORS.map((op) => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                      </select>
                      {needsValue ? (
                        <input
                          type="text"
                          className="table-filter-value"
                          placeholder="Value…"
                          value={filter.value ?? ''}
                          onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                          aria-label="Filter value"
                        />
                      ) : (
                        <span className="table-filter-value-placeholder" aria-hidden="true" />
                      )}
                      <button
                        className="table-filter-remove"
                        onClick={() => removeFilter(filter.id)}
                        type="button"
                        aria-label={`Remove filter on ${filter.column}`}
                        title="Remove filter"
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            {activeFilterCount > 0 && (
              <div className="table-filters-summary">
                {getActiveFilters(draftFilters).map((filter) => (
                  <span key={filter.id} className="table-filter-chip">
                    {formatFilterSummary(filter)}
                  </span>
                ))}
              </div>
            )}
            <button className="btn btn-secondary table-filters-add" onClick={addFilter} type="button">
              + Add filter
            </button>
          </div>
        )}

        <SortableResultTable
          columns={result.columns}
          rows={result.rows}
          emptyMessage="No rows match the current filters"
          resetKey={`${title}-${result.rowCount}-${activeFilterCount}-${result.durationMs}`}
        />

        {hasMore && onLoadMore && (
          <div className="load-more">
            <button className="btn btn-secondary" onClick={onLoadMore} disabled={loading} type="button">
              Load more
            </button>
          </div>
        )}
      </div>

      {showSchema && (
        <aside className="schema-panel">
          <div className="schema-panel-header">
            <h3>Schema</h3>
            <button className="btn-icon" onClick={onToggleSchema} type="button" aria-label="Close schema panel">
              ×
            </button>
          </div>
          {schemaLoading ? (
            <div className="schema-panel-loading">
              <span className="spinner" />
              Loading schema...
            </div>
          ) : !schema || schema.length === 0 ? (
            <div className="schema-panel-empty">No schema information available</div>
          ) : (
            <div className="schema-panel-scroll">
              <table className="schema-table">
                <thead>
                  <tr>
                    <th>Column</th>
                    <th>Type</th>
                    <th>Null</th>
                    <th>Key</th>
                    <th>Default</th>
                  </tr>
                </thead>
                <tbody>
                  {schema.map((col) => (
                    <tr key={col.name}>
                      <td className="schema-col-name">{col.name}</td>
                      <td className="schema-col-type">{col.type}</td>
                      <td>{col.nullable ? 'YES' : 'NO'}</td>
                      <td>{col.primaryKey ? 'PK' : ''}</td>
                      <td className="schema-col-default">{formatDefault(col.defaultValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </aside>
      )}
    </div>
  )
}
