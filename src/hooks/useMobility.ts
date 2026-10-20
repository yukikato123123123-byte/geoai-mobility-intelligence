import { useCallback, useEffect, useRef, useState } from 'react'
import { facilityDestination, facilityName } from '../lib/facilities'
import type { Facility } from '../lib/facilities'
import { inTestArea, parseCoordinate, parseRoadData, requestRoute } from '../lib/mobility'
import type { Coordinate, Endpoint, RoadState, RouteState } from '../lib/mobility'

export function useMobility() {
  const [roadsVisible, setRoadsVisible] = useState(true)
  const [routeVisible, setRouteVisible] = useState(true)
  const [roads, setRoads] = useState<RoadState>({ status: 'loading', data: null, message: 'Loading Road Network…' })
  const [roadAttempt, setRoadAttempt] = useState(0)
  const [origin, setOrigin] = useState('-0.1281, 51.5076')
  const [destination, setDestination] = useState('-0.1246, 51.5008')
  const [destinationFacility, setDestinationFacility] = useState<{ name: string; locationKind: Facility['locationKind'] } | null>(null)
  const [pick, setPick] = useState<Endpoint | null>(null)
  const [result, setResult] = useState<RouteState>({ status: 'idle', route: null, message: '' })
  const pending = useRef<AbortController | null>(null)
  const sequence = useRef(0)
  const lastRequest = useRef(0)
  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    fetch('/data/london-roads.json', { signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error(`Road fixture unavailable (HTTP ${response.status}).`)
      return response.json() as Promise<unknown>
    }).then(parseRoadData).then(data => {
      if (!controller.signal.aborted) setRoads({ status: data.roads.length ? 'ready' : 'empty', data, message: data.roads.length ? `${data.roads.length} OSM road ways loaded` : 'The road extract contains no roads.' })
    }).catch((cause: unknown) => {
      if (!disposed) setRoads({ status: 'error', data: null, message: cause instanceof Error && cause.name !== 'AbortError' ? cause.message : 'Road loading timed out. Retry the local fixture.' })
    }).finally(() => clearTimeout(timeout))
    let disposed = false
    return () => { disposed = true; clearTimeout(timeout); controller.abort() }
  }, [roadAttempt])
  useEffect(() => () => { sequence.current++; pending.current?.abort() }, [])
  const clear = useCallback(() => {
    sequence.current++; pending.current?.abort(); pending.current = null
    setResult({ status: 'idle', route: null, message: '' }); setPick(null)
  }, [])
  const update = useCallback((endpoint: Endpoint, value: string) => {
    clear()
    if (endpoint === 'origin') setOrigin(value)
    else { setDestination(value); setDestinationFacility(null) }
  }, [clear])
  const onPick = useCallback((endpoint: Endpoint, point: Coordinate) => {
    if (!inTestArea(point)) { setResult({ status: 'error', route: null, message: 'Choose a point inside the London test area. Use Focus Road Area to find it.' }); return }
    update(endpoint, point.map(value => value.toFixed(6)).join(', '))
  }, [update])
  function useFacilityDestination(facility: Facility) {
    const value = facilityDestination(facility)
    update('destination', value)
    setDestinationFacility({ name: facilityName(facility), locationKind: facility.locationKind })
    setRouteVisible(true)
  }
  async function findRoute() {
    if (pending.current) return
    let start: Coordinate, end: Coordinate
    try { start = parseCoordinate(origin); end = parseCoordinate(destination) }
    catch (cause) { setResult({ status: 'error', route: null, message: cause instanceof Error ? cause.message : 'Invalid coordinates.' }); return }
    if (Date.now() - lastRequest.current < 1100) { setResult({ status: 'error', route: null, message: 'Please wait at least one second between route requests.' }); return }
    lastRequest.current = Date.now()
    const controller = new AbortController()
    pending.current = controller
    const current = ++sequence.current
    setPick(null); setResult({ status: 'loading', route: null, message: 'Finding a driving route…' })
    const timeout = setTimeout(() => controller.abort(), 15000)
    try {
      const route = await requestRoute(start, end, controller.signal)
      if (current === sequence.current) { setRouteVisible(true); setResult({ status: 'ready', route, message: 'Driving route ready. Estimated duration is not traffic-aware.' }) }
    } catch (cause) {
      if (current === sequence.current) setResult({ status: 'error', route: null, message: controller.signal.aborted ? 'Routing Service Unavailable: request timed out. Try again later.' : cause instanceof Error ? cause.message : 'Routing Service Unavailable.' })
    } finally {
      clearTimeout(timeout)
      if (current === sequence.current) pending.current = null
    }
  }
  function retryRoads() { setRoads({ status: 'loading', data: null, message: 'Loading Road Network…' }); setRoadAttempt(value => value + 1) }
  return { destinationFacility, useFacilityDestination, roadsVisible, setRoadsVisible, routeVisible, setRouteVisible, roads, retryRoads, origin, destination, pick, setPick, result, update, onPick, findRoute, clear }
}
export type Mobility = ReturnType<typeof useMobility>
