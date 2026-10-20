import test from 'node:test'
import assert from 'node:assert/strict'
import { createRemoteLayer, safeIonError, safeCesiumMessage } from '../src/lib/remoteLayer.ts'
const flush = () => new Promise(resolve => setImmediate(resolve))
function setup(configured = true) {
  const timers = new Map(), states = [], released = [], logs = []
  let resolve, reject, callbacks, attached = 0, detached = 0, loads = 0
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  const layer = createRemoteLayer({ configured,
    load: () => { loads++; return promise },
    attach(resource, rendered, failed) { attached++; callbacks = { rendered, failed }; return () => { detached++ } },
    release: value => released.push(value), update: value => states.push(value), diagnostic: value => logs.push(value),
    schedule(fn) { timers.set(1, fn); return 1 }, cancel(id) { timers.delete(id) },
  })
  return { layer, states, released, logs, timers, resolve, reject,
    timeout() { [...timers.values()].forEach(fn => fn()) },
    get callbacks() { return callbacks }, get counts() { return { attached, detached, loads } },
  }
}

test('metadata connection is streaming; readiness waits for rendered content', async () => {
  const h = setup(); h.layer.setEnabled(true); await flush()
  assert.equal(h.states.at(-1).status, 'loading')
  h.resolve({}); await flush(); assert.equal(h.states.at(-1).status, 'streaming')
  h.callbacks.rendered(); assert.equal(h.states.at(-1).status, 'ready'); assert.equal(h.timers.size, 0)
  h.layer.setEnabled(true); assert.equal(h.counts.loads, 1)
  h.layer.dispose(); assert.equal(h.counts.detached, 1); assert.equal(h.released.length, 1)
})
test('disable during loading releases late results without attaching', async () => {
  const h = setup(); h.layer.setEnabled(true); await flush(); h.layer.setEnabled(false)
  const value = {}; h.resolve(value); await flush()
  assert.equal(h.counts.attached, 0); assert.deepEqual(h.released, [value]); assert.equal(h.states.at(-1).status, 'off')
})
test('provider errors are safe and resources detach before retry', async () => {
  const h = setup(); h.layer.setEnabled(true); h.resolve({}); await flush()
  h.callbacks.failed({ statusCode: 403, message: 'Credential-bearing URL must not be echoed' }); await flush()
  assert.equal(h.states.at(-1).status, 'error'); assert.match(h.logs[0], /HTTP 403/)
  assert.equal(h.logs[0].includes('Credential-bearing'), false); assert.equal(h.counts.detached, 1)
  h.layer.retry(); await flush(); assert.equal(h.counts.attached, 2)
  h.layer.dispose()
})
test('timeout releases late resources and cleanup cancels callbacks', async () => {
  const h = setup(); h.layer.setEnabled(true); await flush(); h.timeout()
  assert.match(h.states.at(-1).message, /25 seconds/)
  h.resolve({}); await flush(); assert.equal(h.counts.attached, 0); assert.equal(h.released.length, 1)
  h.layer.dispose(); assert.equal(h.timers.size, 0)
})
test('unconfigured sources never issue requests', async () => {
  const h = setup(false); h.layer.setEnabled(true); h.layer.retry(); await flush()
  assert.equal(h.states.at(-1).status, 'unconfigured'); assert.equal(h.counts.loads, 0)
})
test('two sources operate independently', async () => {
  const buildings = setup(), terrain = setup()
  buildings.layer.setEnabled(true); terrain.layer.setEnabled(true)
  buildings.reject({ statusCode: 401 }); terrain.resolve({}); await flush(); terrain.callbacks.rendered()
  assert.equal(buildings.states.at(-1).status, 'error'); assert.equal(terrain.states.at(-1).status, 'ready')
  buildings.layer.dispose(); terrain.layer.dispose()
})
test('unmount detaches resources and ignores stale callbacks', async () => {
  const h = setup(); h.layer.setEnabled(true); h.resolve({}); await flush()
  h.layer.dispose(); const count = h.states.length
  h.callbacks.rendered(); h.callbacks.failed({ statusCode: 403 }); await flush(); h.layer.retry()
  assert.equal(h.states.length, count); assert.equal(h.timers.size, 0); assert.equal(h.counts.detached, 1)
})
test('safe diagnostics never echo signed URLs, JWTs, response messages or stack traces', () => {
  const sample = 'eyJtest.header.signature'
  const error = new Error(`Failed https://example.test/asset?access_token=${sample} ${sample}`)
  assert.equal(safeCesiumMessage(error).includes(sample), false)
  assert.equal(safeIonError(error).includes('example.test'), false)
  for (const statusCode of [401, 403, 404, 429, 500]) assert.match(safeIonError({ statusCode, message: sample }), new RegExp(`HTTP ${statusCode}`))
})

test('runtime tile failures preserve HTTP diagnostics without returning error text', () => {
  assert.match(safeIonError({ error: { statusCode: 403 } }), /HTTP 403/)
  assert.match(safeIonError({ message: 'Request failed. Status Code: 401. https://example.test/private' }), /HTTP 401/)
  assert.equal(safeIonError({ message: 'Request failed. Status Code: 401. https://example.test/private' }).includes('example.test'), false)
})

test('immediate unmount does not start a queued service request', async () => {
  const h = setup(); h.layer.setEnabled(true); h.layer.dispose(); await flush()
  assert.equal(h.counts.loads, 0); assert.equal(h.timers.size, 0)
})
