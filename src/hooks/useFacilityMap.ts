import { useEffect } from 'react'
import type { RefObject } from 'react'
import { Cartesian2, Cartesian3, Color, ConstantProperty, HeightReference, NearFarScalar, DistanceDisplayCondition, BoundingSphere, Entity, ScreenSpaceEventHandler, ScreenSpaceEventType } from 'cesium'
import type { Viewer } from 'cesium'
import type { Facilities } from './useFacilities'
import { FACILITY_CATEGORIES, facilityName } from '../lib/facilities'
import { frameMap, nearRoute } from '../lib/mapVisual'
import type { Mobility } from './useMobility'
import { record } from '../lib/mobility'
const icons = Object.fromEntries(FACILITY_CATEGORIES.map(category => [category.id, `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="10" fill="#12232e" stroke="${category.color}" stroke-width="1.5"/><text x="12" y="16" text-anchor="middle" fill="${category.color}" font-family="sans-serif" font-weight="bold" font-size="11">${category.symbol}</text></svg>`)}`]))
export function useFacilityMap(viewer: RefObject<Viewer | null>, ready: boolean, epoch: string, facilities: Facilities, mobility: Mobility, onSelect: (id: string) => void) {
  const { state, selected, visible, focusVersion } = facilities
  const pickingRoute = mobility.pick !== null
  const route = mobility.routeVisible ? mobility.result.route : null
  useEffect(() => {
    const map = viewer.current
    if (!ready || !map || map.isDestroyed() || !state.data) return
    for (const facility of state.data.facilities) {
      const category = FACILITY_CATEGORIES.find(item => item.id === facility.category)!
      map.entities.add({ id: `facility-${facility.id}`, name: `${facilityName(facility)} · ${category.label}`, position: Cartesian3.fromDegrees(...facility.coordinates), billboard: { heightReference: HeightReference.CLAMP_TO_TERRAIN, image: icons[facility.category], width: 24, height: 24, scaleByDistance: new NearFarScalar(700, 1, 6000, 0.55), distanceDisplayCondition: new DistanceDisplayCondition(0, 16000), disableDepthTestDistance: Infinity }, label: { heightReference: HeightReference.CLAMP_TO_TERRAIN, text: facilityName(facility), font: 'bold 12px sans-serif', fillColor: Color.WHITE, show: false, showBackground: true, backgroundColor: Color.fromCssColorString('#071521ee'), pixelOffset: new Cartesian2(0, -30), disableDepthTestDistance: Infinity } })
    }
    map.scene.requestRender()
    return () => { if (!map.isDestroyed()) { state.data?.facilities.forEach(facility => map.entities.removeById(`facility-${facility.id}`)); map.scene.requestRender() } }
  }, [viewer, ready, epoch, state.data])
  useEffect(() => {
    const map = viewer.current
    if (!ready || !map || map.isDestroyed()) return
    for (const facility of state.data?.facilities ?? []) {
      const entity = map.entities.getById(`facility-${facility.id}`)
      if (entity) {
        entity.show = visible[facility.category]
        if (entity.billboard) {
          const active = selected?.id === facility.id
          const muted = !active && route && nearRoute(facility.coordinates, route.coordinates)
          entity.billboard.color = new ConstantProperty(Color.WHITE.withAlpha(muted ? 0.28 : 1))
          entity.billboard.scale = new ConstantProperty(active ? 1.2 : muted ? 0.55 : 0.85)
        }
        if (entity.label) entity.label.show = new ConstantProperty(selected?.id === facility.id)
      }
    }
    map.scene.requestRender()
  }, [viewer, ready, epoch, state.data, visible, selected, route])
  useEffect(() => {
    const map = viewer.current
    if (!ready || !map || map.isDestroyed() || !selected) return
    frameMap(map, new BoundingSphere(Cartesian3.fromDegrees(...selected.coordinates), 480), 0.7)
  }, [viewer, ready, epoch, selected, focusVersion])
  useEffect(() => {
    const map = viewer.current
    if (!ready || !map || map.isDestroyed() || pickingRoute) return
    const handler = new ScreenSpaceEventHandler(map.scene.canvas)
    handler.setInputAction((event: { position: Cartesian2 }) => {
      const hit: unknown = map.scene.pick(event.position)
      if (record(hit) && hit.id instanceof Entity && hit.id.id.startsWith('facility-')) onSelect(hit.id.id.slice('facility-'.length))
    }, ScreenSpaceEventType.LEFT_CLICK)
    return () => handler.destroy()
  }, [viewer, ready, epoch, pickingRoute, onSelect])
}
