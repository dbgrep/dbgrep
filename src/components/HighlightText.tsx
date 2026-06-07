interface Props {
  text: string
  query: string
  className?: string
}

export default function HighlightText({ text, query, className }: Props) {
  const q = query.trim()
  if (!q) {
    return <span className={className}>{text}</span>
  }

  const lowerText = text.toLowerCase()
  const lowerQ = q.toLowerCase()
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let key = 0
  let searchFrom = 0

  while (searchFrom < text.length) {
    const idx = lowerText.indexOf(lowerQ, searchFrom)
    if (idx === -1) {
      if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex))
      }
      break
    }
    if (idx > lastIndex) {
      parts.push(text.slice(lastIndex, idx))
    }
    parts.push(
      <mark key={key++} className="search-highlight">
        {text.slice(idx, idx + q.length)}
      </mark>
    )
    lastIndex = idx + q.length
    searchFrom = lastIndex
  }

  if (parts.length === 0) {
    return <span className={className}>{text}</span>
  }

  return <span className={className}>{parts}</span>
}
