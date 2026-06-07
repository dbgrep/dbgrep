import type { QueryResult } from '../types'
import ExportMenu from './ExportMenu'
import SortableResultTable from './SortableResultTable'
import './DataTable.css'

interface Props {
  title?: string
  exportFilename?: string
  result: QueryResult | null
  error: string | null
  loading: boolean
  onRefresh?: () => void
  onLoadMore?: () => void
  hasMore?: boolean
  resultViewToggle?: React.ReactNode
  sortResetKey?: string
}

export default function DataTable({
  title,
  exportFilename,
  result,
  error,
  loading,
  onRefresh,
  onLoadMore,
  hasMore,
  resultViewToggle,
  sortResetKey,
}: Props) {
  if (loading && !result) {
    return (
      <div className="data-table-container">
        <div className="data-table-loading">
          <span className="spinner" />
          Loading...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="data-table-container">
        <div className="data-table-error">{error}</div>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="data-table-container">
        <div className="data-table-empty">
          Select a table or run a query to see results
        </div>
      </div>
    )
  }

  return (
    <div className="data-table-container">
      <div className="data-table-header">
        <div className="header-left">
          {title && <h2 className="table-title">{title}</h2>}
          <span className="meta-info">
            {result.rowCount} row{result.rowCount !== 1 ? 's' : ''}
            {result.preview && result.limit != null && ` · preview (${result.limit}/page)`}
            {result.hasMore && ' · more available'}
            {' · '}
            {result.durationMs}ms
          </span>
        </div>
        <div className="header-actions">
          {resultViewToggle}
          <ExportMenu
            result={result}
            filename={exportFilename ?? title ?? 'query-results'}
            disabled={loading}
          />
          {onRefresh && (
            <button className="btn btn-secondary" onClick={onRefresh} disabled={loading}>
              {loading ? <span className="spinner" /> : '↻'} Refresh
            </button>
          )}
        </div>
      </div>

      <SortableResultTable
        columns={result.columns}
        rows={result.rows}
        resetKey={sortResetKey ?? `${result.rowCount}-${result.durationMs}`}
      />

      {hasMore && onLoadMore && (
        <div className="load-more">
          <button className="btn btn-secondary" onClick={onLoadMore} disabled={loading}>
            Load more
          </button>
        </div>
      )}
    </div>
  )
}
