import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Mobility } from '../hooks/useMobility'
import type { Facilities } from '../hooks/useFacilities'
import type { Facility } from '../lib/facilities'
import { FacilitySearch } from './FacilitySearch'
import { RoutePlanner } from './RoutePlanner'

type Message = { role: 'assistant' | 'user'; text: string }
export function AssistantPanel({ mobility, routePlanning, onOpenRoutes, facilities, facilitySearch, onFacilityRoute }: { facilities: Facilities; facilitySearch: boolean; onFacilityRoute: (facility: Facility) => void; mobility: Mobility; routePlanning: boolean; onOpenRoutes: () => void }) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', text: 'Welcome to the London mobility workspace. Explore the map and toggle the available layers. AI and live traffic data are not connected.' }])
  function send(event: FormEvent) {
    event.preventDefault()
    const question = input.trim()
    if (!question) return
    const response = /\uacbd\ub85c|\ubcd1\uc6d0|rout(?:e|ing)|hospital/i.test(question)
      ? 'Open Route Planning to enter coordinates or pick endpoints on the map. OSRM can calculate a driving route when the public service is available. Use Facility Accessibility to search local OSM facilities and choose a route destination. Travel estimates do not use live traffic.'
      : /\uc9c0\ub3c4|\ub7f0\ub358|map|london/i.test(question)
        ? 'Drag the map to pan and use the scroll wheel to zoom. The 2D and 3D buttons change the map view. Use the ◎ button to return to London.'
        : 'This is a local demo response. No request was sent to an AI model, and no traffic, congestion or forecast analysis was performed. I can explain map controls and the availability of route planning.'
    setMessages(previous => [...previous, { role: 'user', text: question }, { role: 'assistant', text: response }])
    setInput('')
  }
  return <aside className="assistant panel"><div className="panel-heading"><h2>AI Traffic Assistant</h2><span className="badge">Demo</span></div>
    <div className="assistant-subtitle">AI Integration Not Configured</div>
    {!routePlanning && !facilitySearch && <div className="conversation" role="log" aria-label="Demo assistant conversation">{messages.map((message, index) => <div key={index} className={`message ${message.role}`}><small>{message.role === 'user' ? 'You' : 'GeoAI · Local guidance'}</small><p>{message.text}</p></div>)}</div>}
    {facilitySearch ? <FacilitySearch facilities={facilities} onRoute={onFacilityRoute} /> : routePlanning ? <RoutePlanner mobility={mobility} /> : <div className="route-options"><h3>Route Planning</h3><p className="route-note">{mobility.result.route ? `${(mobility.result.route.distance / 1000).toFixed(2)} km · ${(mobility.result.route.duration / 60).toFixed(1)} min estimated · No live traffic` : 'Explore OSM roads and request a driving route.'}</p><button onClick={onOpenRoutes}>Open Route Planning</button></div>}
    {!routePlanning && !facilitySearch && <form onSubmit={send}><label className="sr-only" htmlFor="assistant-input">Ask the demo assistant</label><textarea id="assistant-input" maxLength={1000} value={input} onChange={event => setInput(event.target.value)} placeholder="Ask how to use the map…" /><div><small>Local demo · No AI analysis</small><button type="submit" disabled={!input.trim()} aria-label="Send message">➤</button></div></form>}
  </aside>
}
