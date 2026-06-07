import { useState } from 'react'
import type { QueryResult } from '../types'
import {
  defaultExportFilename,
  serializeExport,
  type ExportFormat,
} from '../exportData'
import './ExportMenu.css'

interface Props {
  result: QueryResult
  filename: string
  disabled?: boolean
}

export default function ExportMenu({ result, filename, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  const canExport = result.columns.length > 0 && result.rows.length > 0

  const handleExport = async (format: ExportFormat) => {
    setOpen(false)
    setExporting(true)
    try {
      const content = serializeExport(result, format)
      await window.dbApi.saveExport({
        defaultName: defaultExportFilename(filename, format),
        format,
        content,
      })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="export-menu">
      <button
        className="btn btn-secondary"
        onClick={() => setOpen((value) => !value)}
        disabled={disabled || exporting || !canExport}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {exporting ? <span className="spinner" /> : '↓'} Export
      </button>
      {open && (
        <>
          <div className="export-backdrop" onClick={() => setOpen(false)} />
          <ul className="export-dropdown" role="menu">
            <li role="none">
              <button type="button" role="menuitem" onClick={() => handleExport('csv')}>
                CSV
              </button>
            </li>
            <li role="none">
              <button type="button" role="menuitem" onClick={() => handleExport('json')}>
                JSON
              </button>
            </li>
          </ul>
        </>
      )}
    </div>
  )
}
