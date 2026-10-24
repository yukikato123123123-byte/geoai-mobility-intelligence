import { record } from './mobility.ts'
import type { Road } from './mobility.ts'

export type TrafficObservation = {
  roadId: number
  timestamp: string
  speedKmh: number
  volumeVehPerHour: number
  source: 'observed' | 'simulated'
}
export type CongestionLevel = 'free' | 'moderate' | 'heavy' | 'severe' | 'unknown'
export type RoadTrafficState = {
  roadId: number
  speedLimitKmh: number | null
  observation: TrafficObservation | null
  freshness: 'missing' | 'fresh' | 'stale' | 'future'
  congestionLevel: CongestionLevel
}
export type TrafficPolicy = {
  maxAgeMs: number
  futureToleranceMs: number
  freeRatio: number
  moderateRatio: number
  heavyRatio: number
}
// Inclusive lower bounds: >=80% free, >=50% moderate, >=25% heavy; below severe.
export const DEFAULT_TRAFFIC_POLICY: Readonly<TrafficPolicy> = Object.freeze({
  maxAgeMs: 5 * 60 * 1000, futureToleranceMs: 0,
  freeRatio: 0.8, moderateRatio: 0.5, heavyRatio: 0.25,
})

function roadId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw new Error('Invalid traffic road ID: expected a positive safe integer OSM way ID.')
  return value
}
function bounded(value: unknown, max: number, label: string, positive = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || (positive ? value <= 0 : value < 0) || value > max) throw new Error(`Invalid traffic ${label}.`)
  return value
}
function timestamp(value: unknown): string {
  // Require an unambiguous UTC instant and reject Date.parse calendar normalization.
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) throw new Error('Invalid traffic timestamp: expected ISO UTC seconds or milliseconds.')
  const milliseconds = Date.parse(value)
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value.replace(/Z$/, value.includes('.') ? 'Z' : '.000Z')) throw new Error('Invalid traffic timestamp: invalid calendar date.')
  return value
}

/** Boundary validation for external records. Limits are plausibility guards, not measurements. */
export function parseTrafficObservation(value: unknown): TrafficObservation {
  if (!record(value) || (value.source !== 'observed' && value.source !== 'simulated')) throw new Error('Invalid traffic observation or source.')
  return {
    roadId: roadId(value.roadId), timestamp: timestamp(value.timestamp),
    speedKmh: bounded(value.speedKmh, 300, 'speed'),
    volumeVehPerHour: bounded(value.volumeVehPerHour, 100000, 'volume'), source: value.source,
  }
}

function validatePolicy(policy: TrafficPolicy) {
  bounded(policy.maxAgeMs, Number.MAX_SAFE_INTEGER, 'maximum age')
  bounded(policy.futureToleranceMs, Number.MAX_SAFE_INTEGER, 'future tolerance')
  bounded(policy.freeRatio, 1, 'free threshold', true)
  bounded(policy.moderateRatio, 1, 'moderate threshold', true)
  bounded(policy.heavyRatio, 1, 'heavy threshold', true)
  if (!(policy.heavyRatio < policy.moderateRatio && policy.moderateRatio < policy.freeRatio)) throw new Error('Traffic thresholds must increase: heavy < moderate < free.')
}

function validateEvaluation(nowMs: number, policy: TrafficPolicy) {
  if (!Number.isFinite(nowMs) || Math.abs(nowMs) > 8640000000000000) throw new Error('Invalid traffic evaluation time.')
  validatePolicy(policy)
}

/** No clock reads: callers supply epoch milliseconds, even for historical/simulated analysis. */
export function deriveRoadTrafficState(
  id: number, speedLimitKmh: number | null | undefined, observation: TrafficObservation | null | undefined,
  nowMs: number, policy: TrafficPolicy = DEFAULT_TRAFFIC_POLICY,
): RoadTrafficState {
  roadId(id)
  validateEvaluation(nowMs, policy)
  const limit = speedLimitKmh == null ? null : bounded(speedLimitKmh, 300, 'speed limit', true)
  const parsed = observation == null ? null : parseTrafficObservation(observation)
  if (parsed && parsed.roadId !== id) throw new Error('Traffic observation does not match the road ID.')
  const age = parsed ? nowMs - Date.parse(parsed.timestamp) : null
  const freshness: RoadTrafficState['freshness'] = age === null ? 'missing' : age < -policy.futureToleranceMs ? 'future' : age > policy.maxAgeMs ? 'stale' : 'fresh'
  let congestionLevel: CongestionLevel = 'unknown'
  if (parsed && limit !== null && freshness === 'fresh') {
    const ratio = parsed.speedKmh / limit
    congestionLevel = ratio >= policy.freeRatio ? 'free' : ratio >= policy.moderateRatio ? 'moderate' : ratio >= policy.heavyRatio ? 'heavy' : 'severe'
  }
  return { roadId: id, speedLimitKmh: limit, observation: parsed, freshness, congestionLevel }
}

/** Exact OSM way-ID join; reject ambiguous duplicates and observations for unloaded roads.
 * Speed limits must be supplied explicitly; road class never implies a legal limit.
 */
export function buildRoadTrafficStates(
  roads: readonly Pick<Road, 'id'>[], observations: readonly TrafficObservation[], nowMs: number,
  speedLimits: ReadonlyMap<number, number> = new Map(), policy: TrafficPolicy = DEFAULT_TRAFFIC_POLICY,
): RoadTrafficState[] {
  // Validate time/policy even for an empty road list.
  validateEvaluation(nowMs, policy)
  const ids = new Set<number>()
  for (const road of roads) {
    roadId(road.id)
    if (ids.has(road.id)) throw new Error('Duplicate traffic road ID.')
    ids.add(road.id)
  }
  const byId = new Map<number, TrafficObservation>()
  for (const value of observations) {
    const observation = parseTrafficObservation(value)
    if (!ids.has(observation.roadId)) throw new Error('Traffic observation references an unknown road ID.')
    if (byId.has(observation.roadId)) throw new Error('Multiple traffic observations for one road: select an observation explicitly.')
    byId.set(observation.roadId, observation)
  }
  for (const [id, limit] of speedLimits) {
    if (!ids.has(roadId(id))) throw new Error('Speed limit references an unknown road ID.')
    bounded(limit, 300, 'speed limit', true)
  }
  return roads.map(road => deriveRoadTrafficState(road.id, speedLimits.get(road.id), byId.get(road.id), nowMs, policy))
}
