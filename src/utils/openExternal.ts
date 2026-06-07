export function openExternalUrl(url: string): void {
  if (window.appApi?.openExternal) {
    void window.appApi.openExternal(url)
    return
  }

  window.open(url, '_blank', 'noopener,noreferrer')
}
