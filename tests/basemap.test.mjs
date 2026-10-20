import test from 'node:test'
import assert from 'node:assert/strict'
import { createBasemapController } from '../src/lib/basemap.ts'

function event() {
  const listeners = new Set()
  return { addEventListener(fn) { listeners.add(fn); return () => listeners.delete(fn) }, emit(...args) { [...listeners].forEach(fn => fn(...args)) }, get size() { return listeners.size } }
}
function setup() {
  const progress = event(), frame = event(), timers = new Map(), layers = [], states = [], logs = []
  let loaded = false, nextTimer = 0
  const controller = createBasemapController({
    create(mode) { return { mode, error: event(), destroyed: false } },
    replace(next, previous) { if (previous) { previous.destroyed = true; layers.splice(layers.indexOf(previous), 1) } layers.push(next) },
    errors: layer => layer.error, progress, frame, tilesLoaded: () => loaded,
    update: state => states.push(state), log: (...args) => logs.push(args),
    schedule(fn) { timers.set(++nextTimer, fn); return nextTimer }, cancel(id) { timers.delete(id) },
  })
  return { controller, progress, frame, timers, layers, states, logs, loaded(value) { loaded = value }, timeout() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(fn => fn()) } }
}

test('successful imagery requires actual tile activity and a completed rendered frame', () => {
  const h = setup(); h.controller.select('osm')
  h.loaded(true); h.frame.emit() // Initial empty globe is not proof of imagery loading.
  assert.equal(h.states.at(-1).status, 'Loading OpenStreetMap tiles…')
  h.progress.emit(4); h.loaded(false); h.frame.emit()
  assert.equal(h.timers.size, 1)
  h.progress.emit(0); h.loaded(true); h.frame.emit()
  assert.equal(h.states.at(-1).status, 'Basemap Tiles Loaded')
  assert.equal(h.timers.size, 0)
  h.controller.dispose()
})

test('external errors retain the cause and recover once to a local layer', async () => {
  const h = setup(); h.controller.select('osm')
  const osm = h.layers[0], cause = { message: 'Failed tile X: 1 Y: 0 Level: 1', error: new Error('network failure') }
  osm.error.emit(cause); osm.error.emit(cause)
  assert.equal(h.layers[0], osm) // Do not mutate Cesium during its tile callback.
  await Promise.resolve()
  assert.equal(h.layers.length, 1); assert.equal(h.layers[0].mode, 'grid')
  assert.equal(osm.destroyed, true); assert.equal(osm.error.size, 0)
  assert.equal(h.logs.length, 1); assert.equal(h.logs[0][1], cause)
  assert.match(h.states.at(-1).error, /Failed tile/)
  assert.equal(h.timers.size, 0)
  h.controller.dispose()
})

test('timeout recovers without a provider error and stale completion cannot clear the reason', async () => {
  const h = setup(); h.controller.select('osm'); h.timeout(); await Promise.resolve()
  h.progress.emit(0); h.loaded(true); h.frame.emit()
  assert.equal(h.layers[0].mode, 'grid')
  assert.match(h.states.at(-1).error, /timed out after 20 seconds/)
  h.controller.dispose()
})

test('grid works without tile activity; reconnect and repeated switches own only one layer', () => {
  const h = setup(); h.controller.select('grid')
  assert.equal(h.timers.size, 0); assert.equal(h.frame.size, 0)
  assert.match(h.states.at(-1).status, /Local grid/)
  for (let i = 0; i < 5; i++) { h.controller.select('osm'); h.controller.select('grid') }
  h.controller.select('osm'); h.progress.emit(2); h.loaded(true); h.frame.emit()
  assert.equal(h.layers.length, 1)
  assert.equal(h.states.at(-1).error, '')
  assert.equal(h.states.at(-1).status, 'Basemap Tiles Loaded')
  h.controller.dispose()
})

test('cleanup cancels timers, listeners, queued recovery and ignores subsequent actions', async () => {
  const h = setup(); h.controller.select('osm')
  const old = h.layers[0]; old.error.emit(new Error('offline'))
  const count = h.states.length
  h.controller.dispose(); await Promise.resolve(); h.timeout(); h.frame.emit(); h.progress.emit(0); h.controller.select('grid')
  assert.equal(h.states.length, count); assert.equal(h.layers[0], old)
  assert.equal(h.frame.size, 0); assert.equal(h.progress.size, 0); assert.equal(old.error.size, 0); assert.equal(h.timers.size, 0)
})

test('manual switching invalidates queued automatic recovery', async () => {
  const h = setup(); h.controller.select('osm'); h.layers[0].error.emit(new Error('offline'))
  h.controller.select('osm'); const current = h.layers[0]
  await Promise.resolve(); assert.equal(h.layers[0], current); assert.equal(h.layers[0].mode, 'osm')
  h.controller.dispose()
})

test('hidden imagery does not time out; showing it resumes the deadline', async () => {
  const h = setup(); h.controller.select('osm'); h.controller.setVisible(false)
  assert.equal(h.timers.size, 0)
  h.timeout(); await Promise.resolve()
  assert.equal(h.layers[0].mode, 'osm')
  h.controller.setVisible(true); assert.equal(h.timers.size, 1)
  h.timeout(); await Promise.resolve(); assert.equal(h.layers[0].mode, 'grid')
  h.controller.dispose()
})

test('new tiles after a camera move get a fresh deadline after initial success', async () => {
  const h = setup(); h.controller.select('osm'); h.progress.emit(2); h.loaded(true); h.frame.emit()
  assert.equal(h.timers.size, 0)
  h.loaded(false); h.progress.emit(3)
  assert.equal(h.timers.size, 1)
  h.timeout(); await Promise.resolve()
  assert.equal(h.layers[0].mode, 'grid'); assert.match(h.states.at(-1).error, /timed out/)
  h.controller.dispose()
})
