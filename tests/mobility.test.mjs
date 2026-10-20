import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parseCoordinate, parseRoadData, parseRouteResponse, requestRoute } from '../src/lib/mobility.ts'
// Synthetic service payloads for validation only; never bundled or displayed as real routes.
const valid = () => ({ code: 'Ok', routes: [{ distance: 1250, duration: 180, geometry: { type: 'LineString', coordinates: [[-0.1281, 51.5076], [-0.1246, 51.5008]] } }], waypoints: [{ location: [-0.1281, 51.5076], distance: 3 }, { location: [-0.1246, 51.5008], distance: 4 }] })
test('valid route retains service distance, duration, geometry and snapped points', () => {
  const route = parseRouteResponse(valid())
  assert.equal(route.distance, 1250); assert.equal(route.duration, 180); assert.equal(route.coordinates.length, 2); assert.equal(route.dataVersion, null)
})
test('rejects malformed, empty, excessive and nonfinite route data', () => {
  for (const value of [null, {}, { code: 'Ok', routes: [] }]) assert.throws(() => parseRouteResponse(value), /invalid route/)
  for (const bad of [-1, NaN, Infinity, '180', null]) {
    const value = valid(); value.routes[0].duration = bad
    assert.throws(() => parseRouteResponse(value), /invalid route/)
  }
  for (const coordinates of [[], [[0, 0]], [[181, 0], [0, 0]], [[0, NaN], [0, 0]], [[0, 91], [0, 0]], [[0, 0, 0], [0, 0]], new Array(10001).fill([0, 0])]) {
    const value = valid(); value.routes[0].geometry.coordinates = coordinates
    assert.throws(() => parseRouteResponse(value), /invalid route/)
  }
  const value = valid(); value.waypoints[0].distance = 200
  assert.throws(() => parseRouteResponse(value), /invalid route/)
})
test('service errors use safe local messages', () => {
  assert.throws(() => parseRouteResponse({ code: 'NoRoute', message: '<script>untrusted</script>' }), /No driving route/)
  assert.throws(() => parseRouteResponse({ code: 'NoSegment' }), /within 100 m/)
})
test('coordinates reject blanks, extra fields, out-of-area and swapped axes', () => {
  assert.deepEqual(parseCoordinate('-0.1281, 51.5076'), [-0.1281, 51.5076])
  for (const text of ['', ',', '0,', '0,0', '51.5076,-0.1281', '-0.1281,51.5076,0', 'NaN,51.5', '0x0,51.5']) assert.throws(() => parseCoordinate(text))
})
test('requests only driving GeoJSON with bounded snapping and passes cancellation', async () => {
  const controller = new AbortController()
  const route = await requestRoute([-0.1281, 51.5076], [-0.1246, 51.5008], controller.signal, async (url, options) => {
    assert.match(String(url), /routed-car\/route\/v1\/driving/); assert.match(String(url), /geometries=geojson/); assert.match(String(url), /radiuses=100;100/)
    assert.equal(options.signal, controller.signal)
    return new Response(JSON.stringify(valid()))
  })
  assert.equal(route.duration, 180)
})
test('HTTP, rate limit, invalid JSON, no-route, network and aborted errors', async () => {
  const origin = [-0.1281, 51.5076], destination = [-0.1246, 51.5008]
  for (const [response, message] of [[new Response('', { status: 503 }), /HTTP 503/], [new Response('', { status: 429 }), /rate limit/], [new Response('not json'), /invalid route/], [new Response(JSON.stringify({ code: 'NoRoute' }), { status: 400 }), /No driving route/]]) {
    await assert.rejects(requestRoute(origin, destination, new AbortController().signal, async () => response), message)
  }
  await assert.rejects(requestRoute(origin, destination, new AbortController().signal, async () => { throw new TypeError('fetch failed') }), /Routing Service Unavailable/)
  const controller = new AbortController(); controller.abort()
  await assert.rejects(requestRoute(origin, destination, controller.signal, async (_url, options) => { options.signal.throwIfAborted() }), { name: 'AbortError' })
  await assert.rejects(requestRoute(origin, origin, controller.signal), /different origin/)
})
test('actual local road fixture is bounded, nonempty and valid', async () => {
  const data = parseRoadData(JSON.parse(await readFile(new URL('../public/data/london-roads.json', import.meta.url), 'utf8')))
  assert.ok(data.roads.length > 0 && data.roads.length <= 1500)
  assert.ok(data.roads.reduce((n, road) => n + road.coordinates.length, 0) <= 30000)
  assert.ok(data.osmTimestamp)
})
test('road parser supports empty state and rejects malformed or duplicate ways', () => {
  const fixture = { retrievedAt: '2026-10-19T00:00:00Z', roads: [] }
  assert.equal(parseRoadData(fixture).roads.length, 0)
  assert.throws(() => parseRoadData({ ...fixture, roads: [{ id: 1, highway: 'service', name: '', coordinates: [] }] }))
  const road = { id: 1, highway: 'service', name: '', coordinates: [[-0.128, 51.507], [-0.129, 51.508]] }
  assert.throws(() => parseRoadData({ ...fixture, roads: [road, road] }))
})
test('rejects plausible-looking routes unrelated to the requested endpoints', async () => {
  const payload = valid(); payload.waypoints[0].location = [10, 50]
  await assert.rejects(requestRoute([-0.1281, 51.5076], [-0.1246, 51.5008], new AbortController().signal, async () => new Response(JSON.stringify(payload))), /invalid route/)
  const disconnected = valid(); disconnected.routes[0].geometry.coordinates[0] = [10, 50]
  await assert.rejects(requestRoute([-0.1281, 51.5076], [-0.1246, 51.5008], new AbortController().signal, async () => new Response(JSON.stringify(disconnected))), /invalid route/)
})
