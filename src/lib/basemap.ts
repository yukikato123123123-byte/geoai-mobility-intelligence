export type BasemapMode = 'osm' | 'grid'
type EventSource<T extends unknown[]> = { addEventListener: (listener: (...args: T) => void) => () => void }
export type BasemapState = { mode: BasemapMode; status: string; error: string }
type Options<Layer> = {
  create: (mode: BasemapMode) => Layer
  replace: (layer: Layer, previous?: Layer) => void
  errors: (layer: Layer) => EventSource<[unknown]>
  progress: EventSource<[number]>
  frame: EventSource<[]>
  tilesLoaded: () => boolean
  update: (state: BasemapState) => void
  log: (message: string, cause: unknown) => void
  schedule?: typeof setTimeout
  cancel?: typeof clearTimeout
}

// Owns one basemap layer, never the viewer or dashboard overlay entities.
export function createBasemapController<Layer>(options: Options<Layer>) {
  const schedule = options.schedule ?? setTimeout
  const cancel = options.cancel ?? clearTimeout
  let disposed = false
  let visible = true
  let completed = false
  let armTimeout = () => {}
  let generation = 0
  let layer: Layer | undefined
  let removers: (() => void)[] = []
  let timer: ReturnType<typeof setTimeout> | undefined
  let state: BasemapState = { mode: 'grid', status: '', error: '' }
  function stop() {
    generation++
    cancel(timer)
    timer = undefined
    removers.forEach(remove => remove())
    removers = []
  }
  function select(mode: BasemapMode, reason = '') {
    if (disposed) return
    stop()
    const current = generation
    let failed = false
    let pending = false
    completed = false
    armTimeout = () => {}
    state = { mode, status: mode === 'grid' ? 'Local grid · No geographic basemap' : 'Loading OpenStreetMap tiles…', error: reason }
    const next = options.create(mode)
    function fallback(cause: unknown, message: string) {
      if (disposed || current !== generation || failed) return
      failed = true
      options.log(message, cause)
      // Cesium may be iterating tile imagery when it raises the error event.
      // Replace the layer after that stack unwinds, and ignore stale errors.
      queueMicrotask(() => {
        if (!disposed && current === generation) select('grid', `${message} Local grid is active.`)
      })
    }
    if (mode === 'osm') {
      removers.push(options.errors(next).addEventListener(cause => {
        const detail = cause && typeof cause === 'object' && 'message' in cause ? String(cause.message) : String(cause)
        fallback(cause, `OpenStreetMap imagery failed: ${detail}`)
      }))
      removers.push(options.progress.addEventListener(count => {
        if (count <= 0) return
        pending = true
        // A later camera move can need new tiles even after the first view loaded.
        if (completed) {
          completed = false
          armTimeout()
          state = { mode, status: 'Loading OpenStreetMap tiles…', error: '' }
          options.update(state)
        }
      }))
      removers.push(options.frame.addEventListener(() => {
        if (!failed && pending && options.tilesLoaded()) {
          completed = true
          cancel(timer)
          timer = undefined
          if (state.status !== 'Basemap Tiles Loaded') {
            state = { mode, status: 'Basemap Tiles Loaded', error: '' }
            options.update(state)
          }
        }
      }))
      armTimeout = () => {
        cancel(timer)
        if (visible && !completed) timer = schedule(() => fallback(new Error('OSM tile loading exceeded 20000 ms'), 'OpenStreetMap imagery timed out after 20 seconds.'), 20000)
      }
      armTimeout()
    }
    options.replace(next, layer)
    layer = next
    options.update(state)
  }
  return {
    select,
    setVisible(value: boolean) {
      if (disposed || value === visible) return
      visible = value
      cancel(timer)
      timer = undefined
      if (visible) armTimeout()
    },
    dispose() { disposed = true; stop() },
  }
}
