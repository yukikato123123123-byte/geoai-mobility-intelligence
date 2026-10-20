import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const target = new URL('../public/data/london-roads.json', import.meta.url)
if (existsSync(target) && !process.argv.includes('--refresh')) {
  console.log('Using existing road fixture. Use --refresh only for an intentional update.'); process.exit(0)
}
const source = 'https://overpass-api.de/api/interpreter'
const bbox = [-0.135, 51.500, -0.115, 51.513] // west, south, east, north
const classes = 'motorway|trunk|primary|secondary|tertiary|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link|residential|unclassified|service|living_street'
const query = `[out:json][timeout:25][maxsize:33554432];way["highway"~"^(${classes})$"](${bbox[1]},${bbox[0]},${bbox[3]},${bbox[2]});out tags geom;`
// One bounded request. No automatic retry, pagination, scraping or runtime imports.
const inputIndex = process.argv.indexOf('--input')
const dateIndex = process.argv.indexOf('--retrieved-at')
let raw, retrievedAt
if (inputIndex !== -1) {
  if (dateIndex === -1 || !Number.isFinite(Date.parse(process.argv[dateIndex + 1]))) throw new Error('Local imports require --retrieved-at with the actual retrieval timestamp.')
  raw = await readFile(process.argv[inputIndex + 1], 'utf8')
  retrievedAt = new Date(process.argv[dateIndex + 1]).toISOString()
} else {
  const response = await fetch(source, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'GeoAI-Mobility-Intelligence/0.1 (local London road fixture import)' }, body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(35000) })
  if (!response.ok) throw new Error(`Overpass HTTP ${response.status}; existing fixture was preserved.`)
  raw = await response.text()
  retrievedAt = new Date().toISOString()
}
if (raw.length > 5_000_000) throw new Error('Road import exceeds the 5 MB limit.')
const payload = JSON.parse(raw)
if (payload.remark || !Array.isArray(payload.elements) || !payload.elements.length) throw new Error('Overpass returned incomplete or empty data.')
const roads = payload.elements.map(way => {
  if (way.type !== 'way' || !Number.isSafeInteger(way.id) || !way.tags?.highway || !Array.isArray(way.geometry) || way.geometry.length < 2) throw new Error('Invalid OSM way.')
  const coordinates = way.geometry.map(({ lon, lat }) => {
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || lon < -0.6 || lon > 0.3 || lat < 51.2 || lat > 51.8) throw new Error('Invalid or unexpectedly distant road coordinate.')
    return [lon, lat]
  })
  return { id: way.id, highway: way.tags.highway, name: way.tags['name:en'] || way.tags.name || '', coordinates }
})
const points = roads.reduce((sum, road) => sum + road.coordinates.length, 0)
if (roads.length > 1500 || points > 30000) throw new Error('Road fixture exceeds browser rendering limits.')
const fixture = { source, attribution: '© OpenStreetMap contributors', license: 'ODbL 1.0', retrievedAt, osmTimestamp: payload.osm3s?.timestamp_osm_base ?? null, queryBbox: bbox, extentNote: 'Complete OSM ways intersecting the query box; geometry may extend beyond it. This is a display extract, not a routing graph.', query, sha256: createHash('sha256').update(raw).digest('hex'), roads }
await mkdir(new URL('../public/data/', import.meta.url), { recursive: true })
await mkdir(new URL('../data/', import.meta.url), { recursive: true })
await writeFile(new URL('../data/london-roads.overpass.json', import.meta.url), raw)
await writeFile(new URL('../public/data/london-roads.json.tmp', import.meta.url), JSON.stringify(fixture))
await rename(new URL('../public/data/london-roads.json.tmp', import.meta.url), target)
console.log(JSON.stringify({ roads: roads.length, points, retrievedAt: fixture.retrievedAt, osmTimestamp: fixture.osmTimestamp, bytes: raw.length, queryBbox: bbox }))
