import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { convertFacilities, FACILITY_CATEGORIES } from '../src/lib/facilities.ts'
import { TEST_BOUNDS } from '../src/lib/mobility.ts'
const target = new URL('../public/data/london-facilities.json', import.meta.url)
if (existsSync(target) && !process.argv.includes('--refresh')) { console.log('Using existing facility fixture. No external request. Use --refresh for an intentional update.'); process.exit(0) }
const source = 'https://overpass-api.de/api/interpreter'
const query = await readFile(new URL('./london-facilities.overpassql', import.meta.url), 'utf8')
const input = process.argv.indexOf('--input'), date = process.argv.indexOf('--retrieved-at')
let raw, retrievedAt
if (input !== -1) {
  if (date === -1 || !Number.isFinite(Date.parse(process.argv[date + 1]))) throw new Error('Specify the actual download time with --retrieved-at for a local import.')
  raw = await readFile(process.argv[input + 1], 'utf8'); retrievedAt = new Date(process.argv[date + 1]).toISOString()
} else {
  const response = await fetch(source, { method: 'POST', headers: { 'User-Agent': 'GeoAI-Mobility-Intelligence/0.1 (London local facility fixture import)', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(35000) })
  if (!response.ok) throw new Error(`Overpass HTTP ${response.status}. No automatic retry; existing fixture preserved.`)
  raw = await response.text(); retrievedAt = new Date().toISOString()
}
if (raw.length > 2_000_000) throw new Error('Facility response exceeds 2 MB.')
const payload = JSON.parse(raw)
const converted = convertFacilities(payload)
const fixture = { source, attribution: '© OpenStreetMap contributors', license: 'ODbL 1.0', retrievedAt, osmTimestamp: payload.osm3s?.timestamp_osm_base ?? null, queryBbox: TEST_BOUNDS, query, locationNote: 'Nodes use OSM positions. Ways and relations use Overpass bounding-box centers, not verified entrances. Centers outside the test area are excluded.', sha256: createHash('sha256').update(raw).digest('hex'), ...converted }
await mkdir(new URL('../public/data/', import.meta.url), { recursive: true })
await mkdir(new URL('../data/', import.meta.url), { recursive: true })
await writeFile(new URL('../data/london-facilities.overpass.json', import.meta.url), raw)
await writeFile(new URL('../public/data/london-facilities.json.tmp', import.meta.url), JSON.stringify(fixture))
await rename(new URL('../public/data/london-facilities.json.tmp', import.meta.url), target)
console.log(JSON.stringify({ retrievedAt, osmTimestamp: fixture.osmTimestamp, count: converted.facilities.length, skipped: converted.skipped, deduplicated: converted.deduplicated, categories: Object.fromEntries(FACILITY_CATEGORIES.map(category => [category.id, converted.facilities.filter(facility => facility.category === category.id).length])) }))
