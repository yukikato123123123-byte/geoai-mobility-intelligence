import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { categoryForTags, convertFacilities, facilityDestination, facilityName, filterFacilities, parseFacilities, safeWebsite } from '../src/lib/facilities.ts'
import { parseCoordinate } from '../src/lib/mobility.ts'
// Synthetic unit-test records only. Never loaded by the dashboard.
const node = (id, tags={}, lon=-0.128, lat=51.507) => ({type:'node',id,tags,lon,lat})
const sample = () => convertFacilities({elements:[node(1,{amenity:'pharmacy',name:'  Alpha Pharmacy  '}),node(2,{amenity:'school',name:'Academy'},-0.13),node(3,{amenity:'clinic'})]}).facilities
const fixture = facilities => ({ facilities, retrievedAt:'2026-10-19T00:00:00Z',skipped:0,deduplicated:0 })
test('maps only supported facility tags without fabricating categories',()=>{
 for(const [tags,category] of [[{amenity:'hospital'},'health'],[{healthcare:'clinic'},'health'],[{amenity:'school'},'school'],[{amenity:'pharmacy'},'pharmacy'],[{shop:'supermarket'},'supermarket'],[{railway:'station'},'station'],[{amenity:'bus_station'},'station']]) assert.equal(categoryForTags(tags),category)
 assert.equal(categoryForTags({shop:'convenience'}),null)
})
test('local name search ignores case and surrounding whitespace and combines category filters',()=>{
 const data=sample()
 assert.equal(filterFacilities(data,' ALPHA ','all').length,1)
 assert.equal(filterFacilities(data,'alpha','school').length,0)
 assert.equal(filterFacilities(data,'','school')[0].name,'Academy')
 assert.equal(filterFacilities(data,'no-such-facility','all').length,0)
 assert.equal(filterFacilities(data,'unnamed','health').length,1)
})
test('missing names and optional fields are retained with honest fallback labels',()=>{
 const facility=sample()[2]
 assert.equal(facility.name,'');assert.equal(facilityName(facility),'Unnamed hospital or clinic')
 assert.deepEqual(parseFacilities(fixture(sample())).facilities,sample())
 assert.equal(safeWebsite(facility.tags.website),null)
})
test('incomplete replies are rejected; invalid entries and outside centers counted',()=>{
 assert.throws(()=>convertFacilities({remark:'runtime error',elements:[]}),/Incomplete/)
 const result=convertFacilities({elements:[{},node(1,{amenity:'school'},10,20),{type:'way',id:2,tags:{amenity:'school'}},node(3,{amenity:'school'})]})
 assert.equal(result.skipped,3);assert.equal(result.facilities.length,1)
 assert.equal(convertFacilities({elements:[]}).facilities.length,0)
 assert.equal(parseFacilities(fixture([])).facilities.length,0)
})
test('deduplicates OSM IDs and close named representations, but keeps separate branches',()=>{
 const result=convertFacilities({elements:[node(1,{shop:'supermarket',name:'Market'}),node(1,{shop:'supermarket',name:'Market'}),{type:'way',id:2,tags:{shop:'supermarket',name:'Market'},center:{lon:-0.128,lat:51.507}},node(3,{shop:'supermarket',name:'Market'},-0.13)]})
 assert.equal(result.facilities.length,2);assert.equal(result.deduplicated,2)
 assert.deepEqual(result.facilities[0].sourceIds,['node/1','way/2'])
})
test('station buildings/tunnels relation and station point share one marker',()=>{
 const result=convertFacilities({elements:[{type:'relation',id:2,center:{lon:-0.1281,lat:51.5071},tags:{public_transport:'station',building:'transportation',type:'public_transport',name:'Example Tube Station (buildings and tunnels)'}},node(1,{railway:'station',name:'Example'})]})
 assert.equal(result.facilities.length,1);assert.equal(result.deduplicated,1)
 assert.deepEqual(result.facilities[0].sourceIds,['node/1','relation/2'])
})
test('facility destination uses longitude-latitude order and existing routing validation',()=>{
 const facility=sample()[0]
 assert.deepEqual(parseCoordinate(facilityDestination(facility)),facility.coordinates)
 assert.throws(()=>facilityDestination({...facility,coordinates:[51.507,-0.128]}),/outside/)
 assert.throws(()=>facilityDestination({...facility,coordinates:[NaN,51.507]}),/outside/)
})
test('invalid links, corrupted fixtures and duplicate IDs are rejected',()=>{
 for(const url of ['javascript:alert(1)','data:text/html,test','file:///etc/passwd','https://user:password@example.com','not-a-url'])assert.equal(safeWebsite(url),null)
 assert.equal(safeWebsite('https://example.org'),'https://example.org/')
 const facility=sample()[0]
 assert.throws(()=>parseFacilities(fixture([facility,facility])))
 assert.throws(()=>parseFacilities(fixture([{...facility,coordinates:[181,91]}])))
 assert.throws(()=>parseFacilities(fixture([{...facility,category:'invented'}])))
})
test('real fixture is bounded, sourced, distinct and preserves the road test area',async()=>{
 const payload=JSON.parse(await readFile(new URL('../public/data/london-facilities.json',import.meta.url),'utf8'))
 const data=parseFacilities(payload)
 assert.ok(data.facilities.length>0&&data.facilities.length<=500)
 assert.equal(new Set(data.facilities.map(f=>f.id)).size,data.facilities.length)
 assert.deepEqual(payload.queryBbox,[-0.135,51.500,-0.115,51.513])
 assert.ok(data.osmTimestamp);assert.ok(payload.sha256);assert.equal(payload.license,'ODbL 1.0')
})
