import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parseRoadData } from '../src/lib/mobility.ts'
import { parseTrafficObservation, deriveRoadTrafficState, buildRoadTrafficStates, DEFAULT_TRAFFIC_POLICY } from '../src/lib/traffic.ts'

// Synthetic records only: no measurements or speed limits are inferred from OSM.
const instant = '2026-10-20T12:00:00Z'
const now = Date.parse(instant)
const sample = (overrides = {}) => ({ roadId: 2190803, timestamp: instant, speedKmh: 40, volumeVehPerHour: 1200, source: 'observed', ...overrides })
const derive = (overrides = {}, limit = 50, time = now, policy = DEFAULT_TRAFFIC_POLICY) => deriveRoadTrafficState(2190803, limit, sample(overrides), time, policy)

test('observed and simulated records retain provenance through parsing and derivation', () => {
  for (const source of ['observed', 'simulated']) {
    const input = sample({ source })
    assert.deepEqual(parseTrafficObservation(input), input)
    const state = derive({ source })
    assert.equal(state.observation.source, source)
    assert.equal(state.observation.timestamp, instant)
    assert.equal(state.freshness, 'fresh')
    assert.equal(state.congestionLevel, 'free')
    assert.notEqual(state.observation, input)
  }
})

test('rejects malformed observations and invalid OSM identifiers', () => {
  for (const value of [null, [], {}, sample({ source: 'live' }), sample({ source: null })]) assert.throws(() => parseTrafficObservation(value))
  for (const roadId of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '2190803', null, undefined]) {
    assert.throws(() => parseTrafficObservation(sample({ roadId })))
    assert.throws(() => deriveRoadTrafficState(roadId, null, null, now))
  }
  assert.equal(parseTrafficObservation(sample({ roadId: Number.MAX_SAFE_INTEGER })).roadId, Number.MAX_SAFE_INTEGER)
})

test('rejects nonfinite, negative, nonnumeric and implausible speeds and volumes', () => {
  for (const field of ['speedKmh', 'volumeVehPerHour']) {
    for (const value of [-1, NaN, Infinity, -Infinity, '0', null, undefined]) assert.throws(() => parseTrafficObservation(sample({ [field]: value })))
  }
  assert.throws(() => parseTrafficObservation(sample({ speedKmh: 300.01 })))
  assert.throws(() => parseTrafficObservation(sample({ volumeVehPerHour: 100000.01 })))
  assert.equal(parseTrafficObservation(sample({ speedKmh: 300, volumeVehPerHour: 100000 })).speedKmh, 300)
  assert.equal(parseTrafficObservation(sample({ speedKmh: 0, volumeVehPerHour: 0 })).volumeVehPerHour, 0)
})

test('timestamps require explicit UTC and valid calendar dates without normalization', () => {
  for (const timestamp of ['', null, now, '2026-10-20', '2026-10-20T12:00:00', '2026-10-20T12:00:00+01:00', '2026-02-29T12:00:00Z', '2026-02-30T12:00:00Z', '2026-13-01T12:00:00Z', '2026-10-20T24:00:00Z', '2026-10-20T12:00:60Z']) assert.throws(() => parseTrafficObservation(sample({ timestamp })))
  for (const timestamp of ['2024-02-29T00:00:00Z', '2026-10-20T12:00:00.123Z']) assert.equal(parseTrafficObservation(sample({ timestamp })).timestamp, timestamp)
})

test('missing data remains unknown while actual zero speed is severe', () => {
  const missing = deriveRoadTrafficState(2190803, undefined, undefined, now)
  assert.deepEqual(missing, { roadId: 2190803, speedLimitKmh: null, observation: null, freshness: 'missing', congestionLevel: 'unknown' })
  assert.equal(deriveRoadTrafficState(2190803, 50, null, now).congestionLevel, 'unknown')
  for (const limit of [null, undefined]) {
    const state = deriveRoadTrafficState(2190803, limit, sample({ speedKmh: 0 }), now)
    assert.equal(state.congestionLevel, 'unknown'); assert.equal(state.observation.speedKmh, 0)
  }
  assert.equal(derive({ speedKmh: 0, volumeVehPerHour: 0 }).congestionLevel, 'severe')
})

test('every inclusive congestion boundary and neighboring interval', () => {
  for (const [speedKmh, expected] of [[0, 'severe'], [12.499, 'severe'], [12.5, 'heavy'], [12.501, 'heavy'], [24.999, 'heavy'], [25, 'moderate'], [25.001, 'moderate'], [39.999, 'moderate'], [40, 'free'], [40.001, 'free'], [50, 'free'], [60, 'free']]) assert.equal(derive({ speedKmh }).congestionLevel, expected, String(speedKmh))
  const policy = { ...DEFAULT_TRAFFIC_POLICY, freeRatio: 0.9, moderateRatio: 0.6, heavyRatio: 0.3 }
  for (const [speedKmh, expected] of [[14.99, 'severe'], [15, 'heavy'], [30, 'moderate'], [45, 'free']]) assert.equal(derive({ speedKmh }, 50, now, policy).congestionLevel, expected)
})

test('freshness boundaries are deterministic; stale and future data retain provenance but are unknown', () => {
  assert.equal(derive({}, 50, now + 300000).freshness, 'fresh')
  const stale = derive({ source: 'simulated' }, 50, now + 300001)
  assert.equal(stale.freshness, 'stale'); assert.equal(stale.congestionLevel, 'unknown'); assert.equal(stale.observation.source, 'simulated')
  assert.equal(derive({}, 50, now - 1).freshness, 'future')
  assert.equal(derive({}, 50, now - 1).congestionLevel, 'unknown')
  const policy = { ...DEFAULT_TRAFFIC_POLICY, maxAgeMs: 1000, futureToleranceMs: 100 }
  assert.equal(derive({}, 50, now - 100, policy).freshness, 'fresh')
  assert.equal(derive({}, 50, now - 101, policy).freshness, 'future')
  assert.equal(derive({}, 50, now + 1000, policy).freshness, 'fresh')
  assert.equal(derive({}, 50, now + 1001, policy).freshness, 'stale')
})

test('invalid limits, clocks, policies and mismatched observations are rejected', () => {
  for (const limit of [0, -1, NaN, Infinity, 301, '50']) assert.throws(() => derive({}, limit))
  for (const time of [NaN, Infinity, 'now', 8640000000000001]) assert.throws(() => derive({}, 50, time))
  for (const patch of [{ maxAgeMs: -1 }, { futureToleranceMs: Infinity }, { freeRatio: 1.1 }, { moderateRatio: 0 }, { heavyRatio: NaN }, { heavyRatio: 0.5 }, { moderateRatio: 0.8 }]) assert.throws(() => derive({}, 50, now, { ...DEFAULT_TRAFFIC_POLICY, ...patch }))
  assert.throws(() => derive({ roadId: 123 }), /match/)
  assert.throws(() => buildRoadTrafficStates([], [], NaN))
  assert.deepEqual(buildRoadTrafficStates([], [], now), [])
})

test('joins real fixture IDs exactly, preserves road order and leaves absent data unknown', async () => {
  const data = parseRoadData(JSON.parse(await readFile(new URL('../public/data/london-roads.json', import.meta.url), 'utf8')))
  const first = data.roads[0].id, second = data.roads[1].id
  const observations = [sample({ roadId: second, source: 'simulated', speedKmh: 10 }), sample({ roadId: first })]
  const states = buildRoadTrafficStates(data.roads, observations, now, new Map([[first, 50], [second, 50]]))
  assert.deepEqual(states.map(state => state.roadId), data.roads.map(road => road.id))
  assert.equal(states[0].observation.source, 'observed'); assert.equal(states[0].congestionLevel, 'free')
  assert.equal(states[1].observation.source, 'simulated'); assert.equal(states[1].congestionLevel, 'severe')
  assert.ok(states.slice(2).every(state => state.observation === null && state.speedLimitKmh === null && state.congestionLevel === 'unknown'))
  assert.ok(buildRoadTrafficStates(data.roads, [], now).every(state => state.congestionLevel === 'unknown'))
  assert.equal(buildRoadTrafficStates(data.roads, observations, now)[0].congestionLevel, 'unknown')
  assert.equal(observations[0].speedKmh, 10)
})

test('joins reject unknown IDs, duplicate roads, ambiguous observations and invalid limits', () => {
  const roads = [{ id: 2190803 }]
  assert.throws(() => buildRoadTrafficStates(roads, [sample({ roadId: 123 })], now), /unknown road/)
  assert.throws(() => buildRoadTrafficStates([...roads, ...roads], [], now), /Duplicate/)
  assert.throws(() => buildRoadTrafficStates(roads, [sample(), sample({ source: 'simulated' })], now), /Multiple/)
  assert.throws(() => buildRoadTrafficStates(roads, [], now, new Map([[123, 50]])), /unknown road/)
  assert.throws(() => buildRoadTrafficStates(roads, [], now, new Map([[2190803, 0]])))
})
