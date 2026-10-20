import { useCallback, useState } from 'react'
import { CesiumMap } from './components/CesiumMap'
import { AssistantPanel } from './components/AssistantPanel'
import { Analytics } from './components/Analytics'
import './App.css'
import { FACILITY_CATEGORIES } from './lib/facilities'
import { useFacilities } from './hooks/useFacilities'
import { useMobility } from './hooks/useMobility'
import { ionConfig } from './lib/ionConfig'
import type { IonLayerStates, LayerState } from './lib/remoteLayer'

const currentYear = new Date().getFullYear()
const views = [
  { icon: '◫', name: 'Traffic Overview', description: 'Explore the London map. Live traffic data is not connected.' },
  { icon: '▥', name: 'Traffic Analysis', description: 'Traffic analysis is coming soon. Enable demo charts below to preview the visualizations.' },
  { icon: '◉', name: 'Congestion Prediction', description: 'Congestion prediction is coming soon. Historical observations and a prediction model are required.' },
  { icon: '⌁', name: 'Route Planning', description: 'Select endpoints in the London test area. OSRM provides estimated driving duration without live traffic.' },
  { icon: '♧', name: 'Facility Accessibility', description: 'Search local OSM facilities, inspect available information, and select a destination for an OSRM driving route. Entrance access is not verified.' },
  { icon: '♙', name: 'Traffic Simulation', description: 'Simulation is coming soon. No simulations or forecasts are currently running.' },
  { icon: '▤', name: 'AI Analysis Reports', description: 'AI Integration Not Configured. The assistant provides local demo guidance only.' },
  { icon: '▦', name: 'Data Management', description: 'Local OSM roads and facilities with public OSRM driving routes. Traffic and AI services are not connected.' },
  { icon: '⚙', name: 'Settings', description: 'Toggle the basemap and London marker in Layers. Use the map controls to switch between 2D, 3D and the local grid.' },
]
const unavailableLayers = ['Traffic Observations', 'Traffic Incidents', 'Congestion Levels', 'Public Transport Routes', 'Administrative Boundaries']

function App() {
  const mobility = useMobility()
  const facilities = useFacilities()
  const [selected, setSelected] = useState(0)
  const [markerVisible, setMarkerVisible] = useState(true)
  const [basemapVisible, setBasemapVisible] = useState(true)
  const [buildings, setBuildings] = useState(ionConfig.buildingsEnabled)
  const [terrain, setTerrain] = useState(ionConfig.terrainEnabled)
  const [buildingRetry, setBuildingRetry] = useState(0)
  const [terrainRetry, setTerrainRetry] = useState(0)
  const [ionStates, setIonStates] = useState<IonLayerStates>({
    buildings: { status: ionConfig.configured ? 'off' : 'unconfigured', message: ionConfig.configured ? 'Layer is off' : 'Cesium ion token not configured' },
    terrain: { status: ionConfig.configured ? 'off' : 'unconfigured', message: ionConfig.configured ? 'Layer is off' : 'Cesium ion token not configured' },
  })
  const onIonState = useCallback((layer: keyof IonLayerStates, state: LayerState) => setIonStates(previous => ({ ...previous, [layer]: state })), [])
  const ionSettings = { buildings, terrain, buildingRetry, terrainRetry, onState: onIonState }
  const [demo, setDemo] = useState(false)
  const selectFacilityEntry = facilities.select
  const selectFacility = useCallback((id: string) => { selectFacilityEntry(id); setSelected(4) }, [selectFacilityEntry])
  return <div className="dashboard">
    <header className="topbar"><a className="brand" href="#" onClick={event => { event.preventDefault(); setSelected(0) }}><span className="brand-mark">◎</span><span>GeoAI <b>Mobility Intelligence</b></span></a><nav aria-label="Main navigation">{[['Dashboard', 0], ['Traffic Analysis', 1], ['Route Planning', 3], ['Facility Accessibility', 4], ['Simulation', 5], ['Data Management', 7], ['Settings', 8]].map(([name, id]) => <button key={name} className={selected === id ? 'active' : ''} onClick={() => setSelected(Number(id))}>{name}</button>)}</nav><div className="profile"><span className="avatar">SE</span><span>Shinobi Earth<small>London workspace</small></span></div></header>
    <main className="workspace"><aside className="sidebar"><section className="panel analysis-menu"><div className="panel-heading"><span>Analysis</span><span>⌃</span></div><nav aria-label="Analysis">{views.slice(0, 7).map((view, index) => <button key={view.name} aria-current={selected === index ? 'page' : undefined} className={selected === index ? 'active' : ''} onClick={() => setSelected(index)}><span>{view.icon}</span>{view.name}{index > 0 && index !== 3 && index !== 4 && <small>Soon</small>}</button>)}</nav></section>
    <section className="panel layers"><div className="panel-heading"><span>Layers</span><span className="badge">Local + 3D</span></div><label className="layer"><span>◫ &nbsp; Basemap</span><input type="checkbox" role="switch" checked={basemapVisible} onChange={event => setBasemapVisible(event.target.checked)} /><span className="switch" /></label><label className="layer"><span>◎ &nbsp; London Marker</span><input type="checkbox" role="switch" checked={markerVisible} onChange={event => setMarkerVisible(event.target.checked)} /><span className="switch" /></label><label className="layer"><span>≋ &nbsp; Road Network</span><input type="checkbox" role="switch" checked={mobility.roadsVisible} onChange={event => mobility.setRoadsVisible(event.target.checked)} /><span className="switch" /></label><label className="layer"><span>⌁ &nbsp; Route &amp; Endpoints</span><input type="checkbox" role="switch" checked={mobility.routeVisible} onChange={event => mobility.setRouteVisible(event.target.checked)} /><span className="switch" /></label>{FACILITY_CATEGORIES.map(category => <label className="layer facility-layer" key={category.id}><span><b style={{ color: category.color }}>{category.symbol}</b> &nbsp; {category.label}</span><small>{facilities.state.data ? facilities.counts[category.id] : '—'}</small><input type="checkbox" role="switch" checked={facilities.visible[category.id]} onChange={() => facilities.toggle(category.id)} /><span className="switch" /></label>)}<p className="layer-note" role="status">{facilities.state.message}{facilities.state.status === 'error' && <button onClick={facilities.retry}>Retry Facilities</button>}</p><div className="surface-availability" aria-label="3D data availability"><strong>Cesium ion · 3D sources</strong>{(['buildings', 'terrain'] as const).map(layer => {
      const enabled = layer === 'buildings' ? buildings : terrain
      const state = ionStates[layer]
      const name = layer === 'buildings' ? '3D Buildings' : 'Terrain'
      return <div key={layer} className="ion-layer" data-layer={layer}>
        <label className={`layer ${!ionConfig.configured ? 'unavailable' : ''}`}><span>{name}</span><input type="checkbox" role="switch" aria-label={name} disabled={!ionConfig.configured} checked={enabled} onChange={event => layer === 'buildings' ? setBuildings(event.target.checked) : setTerrain(event.target.checked)} /><span className="switch" /></label>
        <p role="status"><strong>{state.status === 'unconfigured' ? 'Unavailable' : state.status === 'ready' ? 'Ready' : state.status === 'error' ? 'Unavailable' : state.status === 'off' ? 'Off' : state.status === 'loading' ? 'Loading' : 'Streaming'}</strong> · {state.message}</p>
        {state.status === 'error' && <button onClick={() => layer === 'buildings' ? setBuildingRetry(value => value + 1) : setTerrainRetry(value => value + 1)}>Retry {name}</button>}
      </div>
    })}<p>Buildings and terrain stream independently. Local roads and facilities remain available.</p></div>{unavailableLayers.map((name, index) => <label className="layer unavailable" key={name}><span>{['≋', '◉', '△', '◴', '▣', '⌂', '✚', '⌂', '▧', '▥', '♧'][index]} &nbsp; {name}</span><small>Not connected</small><input type="checkbox" role="switch" disabled checked={false} readOnly /><span className="switch" /></label>)}<div className="layer-note">{mobility.roads.data && <>Retrieved: {mobility.roads.data.retrievedAt.slice(0, 10)}<br /></>}OSM roads: Westminster–Trafalgar extract.<br />Road display data and routing graph may differ.</div><button className="outline-button" onClick={() => setSelected(7)}>▦ &nbsp; Data Connection Status</button></section></aside>
    <div className="map-workspace"><CesiumMap ionSettings={ionSettings} ionStates={ionStates} facilities={facilities} onSelectFacility={selectFacility} mobility={mobility} markerVisible={markerVisible} basemapVisible={basemapVisible} title={views[selected].name} /><div className="view-status"><span>ⓘ</span><p>{views[selected].description}</p><label><input type="checkbox" checked={demo} onChange={event => setDemo(event.target.checked)} />Show Demo Charts</label></div></div>
    <AssistantPanel facilities={facilities} facilitySearch={selected === 4} onFacilityRoute={facility => { mobility.useFacilityDestination(facility); setSelected(3) }} mobility={mobility} routePlanning={selected === 3} onOpenRoutes={() => setSelected(3)} /><Analytics demo={demo} />
    </main><footer><span>© {currentYear} GeoAI Mobility Intelligence</span><span>London · 3D map MVP <i /> Traffic Data Not Connected</span></footer>
  </div>
}
export default App
