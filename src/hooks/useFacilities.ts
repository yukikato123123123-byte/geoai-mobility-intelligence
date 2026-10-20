import { useCallback, useEffect, useState } from 'react'
import { FACILITY_CATEGORIES, parseFacilities } from '../lib/facilities'
import type { FacilityCategory, FacilityData } from '../lib/facilities'
export function useFacilities() {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'empty' | 'error'; data: FacilityData | null; message: string }>({ status: 'loading', data: null, message: 'Loading Facilities…' })
  const [attempt, setAttempt] = useState(0)
  const [visible, setVisible] = useState<Record<FacilityCategory, boolean>>({ health: true, school: true, pharmacy: true, supermarket: true, station: true })
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<FacilityCategory | 'all'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [focusVersion, setFocusVersion] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    let disposed = false
    const timeout = setTimeout(() => controller.abort(), 10000)
    fetch('/data/london-facilities.json', { signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error(`Facility data unavailable (HTTP ${response.status}).`)
      return response.json() as Promise<unknown>
    }).then(parseFacilities).then(data => {
      if (!disposed) setState({ status: data.facilities.length ? 'ready' : 'empty', data, message: data.facilities.length ? `${data.facilities.length} facilities loaded from local OSM data.` : 'No supported facilities were found in this extract.' })
    }).catch((cause: unknown) => {
      if (!disposed) setState({ status: 'error', data: null, message: controller.signal.aborted ? 'Facility loading timed out. Retry the local data.' : cause instanceof Error ? cause.message : 'Unable to load facilities.' })
    }).finally(() => clearTimeout(timeout))
    return () => { disposed = true; controller.abort(); clearTimeout(timeout) }
  }, [attempt])
  const select = useCallback((id: string) => {
    const facility = state.data?.facilities.find(item => item.id === id)
    if (!facility) return
    setVisible(previous => ({ ...previous, [facility.category]: true }))
    setSelectedId(id); setFocusVersion(value => value + 1)
  }, [state.data])
  const selected = state.data?.facilities.find(facility => facility.id === selectedId) ?? null
  function retry() { setSelectedId(null); setState({ status: 'loading', data: null, message: 'Loading Facilities…' }); setAttempt(value => value + 1) }
  function toggle(category: FacilityCategory) { setVisible(previous => ({ ...previous, [category]: !previous[category] })) }
  const counts = Object.fromEntries(FACILITY_CATEGORIES.map(category => [category.id, state.data?.facilities.filter(facility => facility.category === category.id).length ?? 0])) as Record<FacilityCategory, number>
  return { state, visible, toggle, query, setQuery, category, setCategory, selected, select, focusVersion, retry, counts }
}
export type Facilities = ReturnType<typeof useFacilities>
