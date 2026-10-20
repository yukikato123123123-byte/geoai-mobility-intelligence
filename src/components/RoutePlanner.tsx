import type { Mobility } from '../hooks/useMobility'
import { ROUTING_PROVIDER } from '../lib/mobility'
export function RoutePlanner({ mobility: m }: { mobility: Mobility }) {
  return <section className="route-planner" aria-label="Route Planning"><h3>Route Planning <span className="badge">Driving</span></h3>
    <p className="route-note">Westminster–Trafalgar test area. Enter longitude, latitude or select a point on the map.</p>
    {m.destinationFacility && <p className="route-note" role="status">Destination facility: <strong>{m.destinationFacility.name}</strong>. {m.destinationFacility.locationKind === 'area-center' ? 'Approximate area center.' : 'OSM mapped point.'} Entrance access is not verified.</p>}
    <form onSubmit={event => { event.preventDefault(); void m.findRoute() }}>
      {(['origin', 'destination'] as const).map(endpoint => <div className="route-field" key={endpoint}><label htmlFor={`route-${endpoint}`}>{endpoint === 'origin' ? 'Origin' : 'Destination'} <small>(longitude, latitude)</small></label><input id={`route-${endpoint}`} required value={m[endpoint]} onChange={event => m.update(endpoint, event.target.value)} spellCheck={false} autoComplete="off" /><button type="button" aria-pressed={m.pick === endpoint} onClick={() => { m.clear(); m.setPick(endpoint) }}>Pick {endpoint} on map</button></div>)}
      <div className="route-actions"><button type="submit" disabled={m.result.status === 'loading'}>{m.result.status === 'loading' ? 'Finding Route…' : 'Find Driving Route'}</button><button type="button" onClick={m.clear}>Clear Route</button></div>
    </form>
    {m.pick && <p className="route-note" role="status">Click the map to select the {m.pick}. <button onClick={() => m.setPick(null)}>Cancel</button></p>}
    {m.result.message && <p className={m.result.status === 'error' ? 'route-error' : 'route-note'} role={m.result.status === 'error' ? 'alert' : 'status'}>{m.result.message}</p>}
    {m.result.route && <div className="route-result"><dl><div><dt>Distance</dt><dd>{(m.result.route.distance / 1000).toFixed(2)} km</dd></div><div><dt>Estimated duration</dt><dd>{(m.result.route.duration / 60).toFixed(1)} min</dd></div></dl><p>No live traffic prediction. Snapped to roads within {Math.ceil(Math.max(...m.result.route.snapDistances))} m of your selections.</p><p>Routing data version: {m.result.route.dataVersion ?? 'Not provided by service'}</p></div>}
    <p className="route-note">Routing: <a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noreferrer">{ROUTING_PROVIDER}</a> · Public service, no availability guarantee. Coordinates are sent to and logged by the provider when you request a route. <a href="https://www.fossgis.de/datenschutzerklaerung/" target="_blank" rel="noreferrer">Privacy</a></p>
    <p className="route-note">Data: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a> · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">Fix the map</a></p>
  </section>
}
