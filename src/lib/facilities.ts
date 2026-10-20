import { coordinate, inTestArea, record } from './mobility.ts'
import type { Coordinate } from './mobility.ts'
export const FACILITY_CATEGORIES = [
  { id: 'health', label: 'Hospitals & Clinics', singular: 'hospital or clinic', symbol: 'H', color: '#d39aab' },
  { id: 'school', label: 'Schools', singular: 'school', symbol: 'S', color: '#b5a4ce' },
  { id: 'pharmacy', label: 'Pharmacies', singular: 'pharmacy', symbol: 'P', color: '#83bfae' },
  { id: 'supermarket', label: 'Supermarkets', singular: 'supermarket', symbol: 'M', color: '#cebb8b' },
  { id: 'station', label: 'Transport Stations', singular: 'transport station', symbol: 'T', color: '#83b7d3' },
] as const
export type FacilityCategory = typeof FACILITY_CATEGORIES[number]['id']
export type Facility = { id: string; sourceIds: string[]; category: FacilityCategory; name: string; coordinates: Coordinate; locationKind: 'node' | 'area-center'; tags: Record<string, string> }
export type FacilityData = { facilities: Facility[]; retrievedAt: string; osmTimestamp: string | null; skipped: number; deduplicated: number }
export function isFacilityCategory(value: unknown): value is FacilityCategory { return FACILITY_CATEGORIES.some(category => category.id === value) }
export function facilityName(facility: Facility) { return facility.name.trim() || `Unnamed ${FACILITY_CATEGORIES.find(category => category.id === facility.category)!.singular}` }
export function categoryForTags(tags: Record<string, unknown>): FacilityCategory | null {
  if (['hospital', 'clinic'].includes(String(tags.amenity)) || ['hospital', 'clinic'].includes(String(tags.healthcare))) return 'health'
  if (tags.amenity === 'school') return 'school'
  if (tags.amenity === 'pharmacy' || tags.healthcare === 'pharmacy') return 'pharmacy'
  if (tags.shop === 'supermarket') return 'supermarket'
  if (tags.amenity === 'bus_station' || tags.public_transport === 'station' || tags.railway === 'station' || tags.railway === 'halt') return 'station'
  return null
}
const tagKeys = ['amenity', 'healthcare', 'shop', 'railway', 'public_transport', 'operator', 'opening_hours', 'wheelchair', 'phone', 'contact:phone', 'website', 'contact:website', 'addr:full', 'addr:housenumber', 'addr:street', 'addr:postcode']
const osmId = /^(node|way|relation)\/[1-9]\d*$/
function normalizeName(value: string) { return value.normalize('NFKC').trim().toLocaleLowerCase('en').replace(/\s+/g, ' ') }
export function convertFacilities(payload: unknown): { facilities: Facility[]; skipped: number; deduplicated: number } {
  if (!record(payload) || payload.remark || !Array.isArray(payload.elements) || payload.elements.length > 2000) throw new Error('Incomplete or oversized Overpass response. Existing facility data was preserved.')
  const facilities: Facility[] = [], ids = new Set<string>()
  let skipped = 0, deduplicated = 0
  const elements = [...payload.elements].sort((a: unknown, b: unknown) => Number(record(a) && a.type === 'relation') - Number(record(b) && b.type === 'relation'))
  for (const value of elements as unknown[]) {
    if (!record(value) || !['node', 'way', 'relation'].includes(String(value.type)) || typeof value.id !== 'number' || !Number.isSafeInteger(value.id) || value.id <= 0 || !record(value.tags)) { skipped++; continue }
    const id = `${value.type}/${value.id}`
    if (ids.has(id)) { deduplicated++; continue }
    ids.add(id)
    const category = categoryForTags(value.tags)
    const center = value.type === 'node' ? value : record(value.center) ? value.center : {}
    const coordinates = [center.lon, center.lat]
    if (!category || !coordinate(coordinates) || !inTestArea(coordinates)) { skipped++; continue }
    const name = typeof value.tags['name:en'] === 'string' ? value.tags['name:en'] : typeof value.tags.name === 'string' ? value.tags.name : ''
    // Merge only identically named/category representations within ~8m; keep original IDs.
    const infrastructure = category === 'station' && value.type === 'relation' && value.tags.type === 'public_transport' && value.tags.building === 'transportation'
    const stationRepresentation = infrastructure && facilities.find(facility => facility.category === 'station' && facility.locationKind === 'node' && facility.name.trim() && normalizeName(name).startsWith(`${normalizeName(facility.name)} `) && Math.hypot((facility.coordinates[0] - coordinates[0]) * 69400, (facility.coordinates[1] - coordinates[1]) * 111200) <= 100)
    const duplicate = stationRepresentation || name.trim() && facilities.find(facility => facility.category === category && normalizeName(facility.name) === normalizeName(name) && Math.hypot((facility.coordinates[0] - coordinates[0]) * 69400, (facility.coordinates[1] - coordinates[1]) * 111200) <= 8)
    if (duplicate) { duplicate.sourceIds.push(id); deduplicated++; continue }
    const tags: Record<string, string> = {}
    for (const key of tagKeys) if (typeof value.tags[key] === 'string') tags[key] = value.tags[key]
    facilities.push({ id, sourceIds: [id], category, name: name.trim(), coordinates, locationKind: value.type === 'node' ? 'node' : 'area-center', tags })
    if (facilities.length > 500) throw new Error('Facility extract exceeds the 500-marker limit.')
  }
  return { facilities, skipped, deduplicated }
}
export function parseFacilities(value: unknown): FacilityData {
  if (!record(value) || !Array.isArray(value.facilities) || value.facilities.length > 500 || typeof value.retrievedAt !== 'string' || !Number.isFinite(Date.parse(value.retrievedAt)) || typeof value.skipped !== 'number' || !Number.isSafeInteger(value.skipped) || value.skipped < 0 || typeof value.deduplicated !== 'number' || !Number.isSafeInteger(value.deduplicated) || value.deduplicated < 0) throw new Error('Invalid facility fixture.')
  const ids = new Set<string>()
  const facilities = value.facilities.map((item: unknown): Facility => {
    if (!record(item) || typeof item.id !== 'string' || !osmId.test(item.id) || ids.has(item.id) || !isFacilityCategory(item.category) || typeof item.name !== 'string' || !coordinate(item.coordinates) || !inTestArea(item.coordinates) || !['node', 'area-center'].includes(String(item.locationKind)) || !record(item.tags) || !Object.values(item.tags).every(tag => typeof tag === 'string') || !Array.isArray(item.sourceIds) || !item.sourceIds.length || !item.sourceIds.every(id => typeof id === 'string' && osmId.test(id))) throw new Error('Invalid facility entry. No markers were loaded.')
    ids.add(item.id)
    return { id: item.id, sourceIds: item.sourceIds, category: item.category, name: item.name, coordinates: item.coordinates, locationKind: item.locationKind as Facility['locationKind'], tags: item.tags as Record<string, string> }
  })
  return { facilities, retrievedAt: value.retrievedAt, osmTimestamp: typeof value.osmTimestamp === 'string' ? value.osmTimestamp : null, skipped: value.skipped, deduplicated: value.deduplicated }
}
export function filterFacilities(facilities: Facility[], query: string, category: FacilityCategory | 'all') {
  const term = normalizeName(query)
  return facilities.filter(facility => (category === 'all' || facility.category === category) && normalizeName(facilityName(facility)).includes(term)).sort((a, b) => facilityName(a).localeCompare(facilityName(b), 'en'))
}
export function facilityDestination(facility: Facility): string {
  if (!coordinate(facility.coordinates) || !inTestArea(facility.coordinates)) throw new Error('This facility is outside the supported routing area.')
  return facility.coordinates.map(value => value.toFixed(6)).join(', ')
}
export function safeWebsite(value: string | undefined): string | null {
  if (!value) return null
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null } catch { return null }
}
