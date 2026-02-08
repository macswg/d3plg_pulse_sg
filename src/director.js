const HEALTH_CHECK_TIMEOUT_MS = 3000

function timeoutSignal(ms) {
  if (typeof AbortSignal?.timeout === 'function') return AbortSignal.timeout(ms)
  const c = new AbortController()
  setTimeout(() => c.abort(), ms)
  return c.signal
}

export async function resolveDirector() {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/54807899-5982-4adb-ae81-4cf49afd3b87',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'director.js:resolveDirector',message:'resolveDirector entered',data:{},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
  // #endregion
  const urlParams = new URLSearchParams(window.location.search)
  const { hostname, protocol } = window.location

  const fromUrl = urlParams.get('director')?.trim()
  if (fromUrl) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/54807899-5982-4adb-ae81-4cf49afd3b87',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'director.js:fromUrl',message:'returning from URL param',data:{fromUrl},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
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
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/54807899-5982-4adb-ae81-4cf49afd3b87',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'director.js:preferred ok',message:'health check OK',data:{host},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
        // #endregion
        return host
      }
    } catch (_) {
      // Preferred not reachable (timeout, CORS, network), fall back to localhost
    }
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/54807899-5982-4adb-ae81-4cf49afd3b87',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'director.js:preferred fallback',message:'returning localhost:80 after preferred',data:{},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    return 'localhost:80'
  }

  if (protocol === 'file:' || !hostname) return 'localhost:80'
  return hostname === 'localhost' || hostname === '127.0.0.1' ? 'localhost:80' : `${hostname}:80`
}
