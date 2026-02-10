const HEALTH_CHECK_TIMEOUT_MS = 3000

function timeoutSignal(ms) {
  if (typeof AbortSignal?.timeout === 'function') return AbortSignal.timeout(ms)
  const c = new AbortController()
  setTimeout(() => c.abort(), ms)
  return c.signal
}

export async function resolveDirector() {
  const urlParams = new URLSearchParams(window.location.search)
  const { hostname, protocol } = window.location

  const fromUrl = urlParams.get('director')?.trim()
  if (fromUrl) {
    return fromUrl.replace(/^https?:\/\//i, '').trim()
  }

  const preferred = (import.meta.env.VITE_DIRECTOR ?? '').trim()
  if (preferred) {
    try {
      const host = preferred.replace(/^https?:\/\//i, '').trim()
      const res = await fetch(`http://${host}/api/session/status/health`, {
        signal: timeoutSignal(HEALTH_CHECK_TIMEOUT_MS),
      })
      if (res.ok) {
        return host
      }
    } catch (_) {
      // Preferred not reachable (timeout, CORS, network), fall back to localhost
    }
    return 'localhost:80'
  }

  if (protocol === 'file:' || !hostname) return 'localhost:80'
  return hostname === 'localhost' || hostname === '127.0.0.1' ? 'localhost:80' : `${hostname}:80`
}
