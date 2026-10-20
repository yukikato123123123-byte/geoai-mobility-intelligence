// Redact URL credentials and JWTs before reporting non-service Cesium failures.
export function safeCesiumMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown Cesium error'
  return message.replace(/https?:\/\/[^\s<>"']+/gi, '[service URL withheld]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[credential withheld]')
    .replace(/(?:access_token|accessToken|token|authorization)\s*[:=]\s*[^\s,;]+/gi, '[credential withheld]').slice(0, 300)
}

export type LayerStatus = 'unconfigured' | 'off' | 'loading' | 'streaming' | 'ready' | 'error'
export type LayerState = { status: LayerStatus; message: string }
export type IonLayerStates = { buildings: LayerState; terrain: LayerState }

// Never serialize service errors: they may contain signed URLs or access tokens.
export function safeIonError(error: unknown): string {
  const value = error as { statusCode?: unknown; name?: unknown; message?: unknown; error?: { statusCode?: unknown } } | null
  const reported = value?.statusCode ?? value?.error?.statusCode
  const match = typeof value?.message === 'string' ? value.message.match(/(?:status(?:\s*code)?|HTTP)\s*[:=]?\s*(4\d\d|5\d\d)\b/i) : null
  const status = typeof reported === 'number' ? reported : match ? Number(match[1]) : undefined
  if (status === 401) return 'HTTP 401: authentication rejected. Check token validity and allowed origins.'
  if (status === 403) return 'HTTP 403: access forbidden. Check assets:read scope, asset restrictions, account entitlement and allowed origins.'
  if (status === 404) return 'HTTP 404: asset unavailable to this token or account.'
  if (status === 429) return 'HTTP 429: service rate limit reached. Retry later.'
  if (status && status >= 400 && status <= 599) return `HTTP ${status}: service request failed.`
  if (value?.name === 'TimeoutError') return 'Service loading timed out after 25 seconds.'
  return 'Network or tile loading failed. Check connectivity and service access.'
}

type Options<T> = {
  configured: boolean
  load: () => Promise<T>
  attach: (resource: T, rendered: () => void, failed: (error: unknown) => void) => () => void
  release: (resource: T) => void
  update: (state: LayerState) => void
  diagnostic: (message: string) => void
  schedule?: typeof setTimeout
  cancel?: typeof clearTimeout
}

// One independently owned resource. Late loads are released, never attached.
export function createRemoteLayer<T>(options: Options<T>) {
  let generation = 0
  let disposed = false
  let enabled = false
  let resource: T | undefined
  let remove = () => {}
  let timer: ReturnType<typeof setTimeout> | undefined
  const schedule = options.schedule ?? setTimeout
  const cancel = options.cancel ?? clearTimeout
  function clear() {
    generation++
    cancel(timer); timer = undefined
    remove(); remove = () => {}
    if (resource !== undefined) options.release(resource)
    resource = undefined
  }
  function start() {
    clear()
    const current = generation
    options.update({ status: 'loading', message: 'Connecting to Cesium ion…' })
    function failed(error: unknown) {
      if (disposed || generation !== current) return
      const message = safeIonError(error)
      clear()
      options.diagnostic(message)
      options.update({ status: 'error', message })
    }
    timer = schedule(() => failed({ name: 'TimeoutError' }), 25000)
    // Catch synchronous factory errors as well as rejected promises.
    Promise.resolve().then(async () => {
      if (disposed || current !== generation) return
      const value = await options.load()
      if (disposed || current !== generation) { options.release(value); return }
      resource = value
      options.update({ status: 'streaming', message: 'Source connected · Waiting for rendered tiles…' })
      remove = options.attach(value, () => {
        if (disposed || current !== generation) return
        cancel(timer); timer = undefined
        options.update({ status: 'ready', message: 'Tiles rendering in the current view' })
      }, error => {
        // Do not mutate primitives or terrain during a Cesium tile callback.
        queueMicrotask(() => failed(error))
      })
    }).catch(failed)
  }
  return {
    setEnabled(value: boolean) {
      if (disposed || (enabled === value && value)) return
      enabled = value
      if (!options.configured) { clear(); options.update({ status: 'unconfigured', message: 'Cesium ion token not configured' }); return }
      if (value) start()
      else { clear(); options.update({ status: 'off', message: 'Layer is off' }) }
    },
    retry() { if (!disposed && enabled && options.configured) start() },
    dispose() { disposed = true; clear() },
  }
}
