export type Coordinate = [number, number] // longitude, latitude
export const TEST_BOUNDS = [-0.135, 51.500, -0.115, 51.513] as const
export const ROUTING_URL = 'https://routing.openstreetmap.de/routed-car/route/v1/driving/'
export const ROUTING_PROVIDER = 'OSRM · FOSSGIS'
export type Road = { id: number; highway: string; name: string; coordinates: Coordinate[] }
export type RoadData = { roads: Road[]; retrievedAt: string; osmTimestamp: string | null }
export type Route = { coordinates: Coordinate[]; distance: number; duration: number; snapped: Coordinate[]; snapDistances: number[]; dataVersion: string | null }
export type RoadState = { status: 'loading' | 'ready' | 'empty' | 'error'; data: RoadData | null; message: string }
export type RouteState = { status: 'idle' | 'loading' | 'ready' | 'error'; route: Route | null; message: string }
export type Endpoint = 'origin' | 'destination'
export function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
export function coordinate(value: unknown): value is Coordinate {
  return Array.isArray(value) && value.length === 2 && typeof value[0] === 'number' && Number.isFinite(value[0]) && Math.abs(value[0]) <= 180 && typeof value[1] === 'number' && Number.isFinite(value[1]) && Math.abs(value[1]) <= 90
}
export function inTestArea(point: Coordinate) {
  return point[0] >= TEST_BOUNDS[0] && point[0] <= TEST_BOUNDS[2] && point[1] >= TEST_BOUNDS[1] && point[1] <= TEST_BOUNDS[3]
}
export function parseCoordinate(text: string): Coordinate {
  const parts = text.split(',').map(value => value.trim())
  if (parts.length !== 2 || parts.some(value => !/^-?\d+(?:\.\d+)?$/.test(value))) throw new Error('Enter longitude, latitude as two decimal numbers.')
  const point = parts.map(Number)
  if (!coordinate(point) || !inTestArea(point)) throw new Error('Choose points inside the London test area: longitude −0.135 to −0.115, latitude 51.500 to 51.513.')
  return point
}
export function parseRoadData(value: unknown): RoadData {
  if (!record(value) || !Array.isArray(value.roads) || value.roads.length > 1500 || typeof value.retrievedAt !== 'string' || !Number.isFinite(Date.parse(value.retrievedAt))) throw new Error('Invalid road fixture or rendering limit exceeded.')
  let points = 0
  const ids = new Set<number>()
  const roads = value.roads.map((road: unknown): Road => {
    if (!record(road) || typeof road.id !== 'number' || !Number.isSafeInteger(road.id) || ids.has(road.id) || typeof road.highway !== 'string' || typeof road.name !== 'string' || !Array.isArray(road.coordinates) || road.coordinates.length < 2 || !road.coordinates.every(coordinate)) throw new Error('Invalid road geometry in the local fixture.')
    points += road.coordinates.length
    ids.add(road.id)
    if (points > 30000) throw new Error('Road fixture exceeds the 30,000-point rendering limit.')
    return { id: road.id, highway: road.highway, name: road.name, coordinates: road.coordinates }
  })
  return { roads, retrievedAt: value.retrievedAt, osmTimestamp: typeof value.osmTimestamp === 'string' ? value.osmTimestamp : null }
}
function distanceMeters(a: Coordinate, b: Coordinate) {
  const radians = Math.PI / 180
  const lat = (b[1] - a[1]) * radians, lon = (b[0] - a[0]) * radians
  const h = Math.sin(lat / 2) ** 2 + Math.cos(a[1] * radians) * Math.cos(b[1] * radians) * Math.sin(lon / 2) ** 2
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)))
}
const invalidRoute = 'Routing Service Unavailable: the service returned an invalid route.'
export function parseRouteResponse(value: unknown): Route {
  if (!record(value)) throw new Error(invalidRoute)
  if (value.code === 'NoRoute') throw new Error('No driving route was found between these points. Choose different endpoints.')
  if (value.code === 'NoSegment') throw new Error('No drivable road was found within 100 m of an endpoint. Move it closer to a road.')
  if (value.code !== 'Ok' || !Array.isArray(value.routes) || !value.routes.length) throw new Error(invalidRoute)
  const route: unknown = value.routes[0]
  if (!record(route) || typeof route.distance !== 'number' || !Number.isFinite(route.distance) || route.distance < 0 || typeof route.duration !== 'number' || !Number.isFinite(route.duration) || route.duration < 0 || !record(route.geometry) || route.geometry.type !== 'LineString' || !Array.isArray(route.geometry.coordinates) || route.geometry.coordinates.length < 2 || route.geometry.coordinates.length > 10000 || !route.geometry.coordinates.every(coordinate)) throw new Error(invalidRoute)
  if (!Array.isArray(value.waypoints) || value.waypoints.length !== 2) throw new Error(invalidRoute)
  const waypoints = value.waypoints.map((point: unknown) => {
    if (!record(point) || !coordinate(point.location) || typeof point.distance !== 'number' || !Number.isFinite(point.distance) || point.distance < 0 || point.distance > 101) throw new Error(invalidRoute)
    return { location: point.location, distance: point.distance }
  })
  return { coordinates: route.geometry.coordinates, distance: route.distance, duration: route.duration, snapped: waypoints.map(point => point.location), snapDistances: waypoints.map(point => point.distance), dataVersion: typeof value.data_version === 'string' ? value.data_version : null }
}
export async function requestRoute(origin: Coordinate, destination: Coordinate, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<Route> {
  if (!coordinate(origin) || !coordinate(destination) || !inTestArea(origin) || !inTestArea(destination)) throw new Error('Choose both endpoints inside the London test area.')
  if (origin[0] === destination[0] && origin[1] === destination[1]) throw new Error('Choose different origin and destination coordinates.')
  const url = `${ROUTING_URL}${origin.join(',')};${destination.join(',')}?overview=full&geometries=geojson&steps=false&alternatives=false&radiuses=100;100&generate_hints=false`
  let response: Response
  try { response = await fetcher(url, { signal, headers: { Accept: 'application/json' } }) }
  catch (cause) {
    if (signal.aborted) throw cause
    throw new Error('Routing Service Unavailable. Check your connection and try again later.')
  }
  if (response.status === 429) throw new Error('Routing Service Unavailable: rate limit reached. Wait before trying again.')
  if (!response.ok && response.status !== 400) throw new Error(`Routing Service Unavailable (HTTP ${response.status}). Try again later.`)
  let payload: unknown
  try { payload = await response.json() } catch { throw new Error(invalidRoute) }
  const route = parseRouteResponse(payload)
  if (!response.ok) throw new Error(`Routing Service Unavailable (HTTP ${response.status}).`)
  if (distanceMeters(origin, route.snapped[0]) > 110 || distanceMeters(destination, route.snapped[1]) > 110 || distanceMeters(route.coordinates[0], route.snapped[0]) > 10 || distanceMeters(route.coordinates[route.coordinates.length - 1], route.snapped[1]) > 10) throw new Error(invalidRoute)
  return route
}
export function roadStyle(highway: string) {
  if (/^(motorway|trunk)/.test(highway)) return { color: '#ac9cc9', width: 4.5, label: 'Motorway / trunk' }
  if (/^primary/.test(highway)) return { color: '#d5b881', width: 3.5, label: 'Primary' }
  if (/^(secondary|tertiary)/.test(highway)) return { color: '#7eacb9', width: 2.5, label: 'Secondary / tertiary' }
  return { color: '#718997', width: 1.6, label: 'Local / service' }
}
