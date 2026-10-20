import { useEffect } from 'react'
import type { RefObject } from 'react'
import { BoundingSphere, Cartesian2, Cartesian3, Cartographic, Color, Rectangle, ScreenSpaceEventHandler, ScreenSpaceEventType, PolylineOutlineMaterialProperty, HorizontalOrigin, DistanceDisplayCondition, HeightReference, ClassificationType } from 'cesium'
import type { Viewer } from 'cesium'
import { parseCoordinate, roadStyle, TEST_BOUNDS } from '../lib/mobility'
import { frameMap } from '../lib/mapVisual'
import type { Mobility } from './useMobility'

export function useMapOverlays(viewer: RefObject<Viewer | null>, ready: boolean, epoch: string, m: Mobility) {
  const { roads, roadsVisible, routeVisible, result, origin, destination, pick, onPick } = m
  useEffect(() => {
    const map = viewer.current
    if (!ready || !map || map.isDestroyed() || !roadsVisible || !roads.data) return
    const ids: string[] = []
    for (const road of roads.data.roads) {
      const style = roadStyle(road.highway)
      const id = `road-${road.id}`
      map.entities.add({ id, name: `${road.name || 'Unnamed road'} · ${road.highway}`, polyline: { positions: Cartesian3.fromDegreesArray(road.coordinates.flat()), width: style.width, material: new PolylineOutlineMaterialProperty({ color: Color.fromCssColorString(style.color), outlineColor: Color.fromCssColorString('#0b141c'), outlineWidth: 0.45 }), clampToGround: true, classificationType: ClassificationType.TERRAIN, zIndex: /^(motorway|trunk|primary)/.test(road.highway) ? 2 : 1 } })
      ids.push(id)
    }
    map.entities.add({ id: 'road-extent', name: 'OSM query extent (complete ways may extend beyond this box)', rectangle: { coordinates: Rectangle.fromDegrees(...TEST_BOUNDS), fill: false, outline: true, outlineColor: Color.fromCssColorString('#44606b88') } })
    ids.push('road-extent')
    map.scene.requestRender()
    return () => { if (!map.isDestroyed()) { ids.forEach(id => map.entities.removeById(id)); map.scene.requestRender() } }
  }, [viewer, ready, epoch, roads.data, roadsVisible])
  useEffect(() => {
    const map = viewer.current
    if (!ready || !map || map.isDestroyed() || !routeVisible) return
    const ids: string[] = []
    for (const [index, value] of [origin, destination].entries()) {
      try {
        const point = parseCoordinate(value)
        const id = index ? 'route-destination' : 'route-origin'
        map.entities.add({ id, position: Cartesian3.fromDegrees(...point), point: { heightReference: HeightReference.CLAMP_TO_TERRAIN, pixelSize: 10, color: Color.fromCssColorString(index ? '#f2b77a' : '#62d6bf'), outlineColor: Color.WHITE, outlineWidth: 2, disableDepthTestDistance: Infinity }, label: { heightReference: HeightReference.CLAMP_TO_TERRAIN, text: index ? 'DESTINATION' : 'ORIGIN', font: 'bold 11px sans-serif', fillColor: Color.WHITE, showBackground: true, backgroundColor: Color.fromCssColorString('#091625e8'), horizontalOrigin: index ? HorizontalOrigin.LEFT : HorizontalOrigin.RIGHT, pixelOffset: new Cartesian2(index ? 16 : -16, index ? 22 : -22), distanceDisplayCondition: new DistanceDisplayCondition(0, 12000), disableDepthTestDistance: Infinity } })
        ids.push(id)
      } catch { /* Invalid edited inputs deliberately have no marker. */ }
    }
    if (result.route) {
      map.entities.add({ id: 'driving-route', name: 'OSRM driving route · not traffic-aware', polyline: { positions: Cartesian3.fromDegreesArray(result.route.coordinates.flat()), width: 6, material: new PolylineOutlineMaterialProperty({ color: Color.fromCssColorString('#6de0ff'), outlineColor: Color.fromCssColorString('#063c59'), outlineWidth: 2 }), clampToGround: true, classificationType: ClassificationType.TERRAIN, zIndex: 10 } })
      ids.push('driving-route')
    }
    map.scene.requestRender()
    return () => { if (!map.isDestroyed()) { ids.forEach(id => map.entities.removeById(id)); map.scene.requestRender() } }
  }, [viewer, ready, epoch, routeVisible, result.route, origin, destination])
  useEffect(() => {
    const map = viewer.current
    if (!ready || !map || map.isDestroyed() || !result.route) return
    const sphere = BoundingSphere.fromPoints(Cartesian3.fromDegreesArray(result.route.coordinates.flat()))
    frameMap(map, sphere)
  }, [viewer, ready, epoch, result.route])
  useEffect(() => {
    const map = viewer.current
    if (!ready || !map || map.isDestroyed() || !pick) return
    const handler = new ScreenSpaceEventHandler(map.scene.canvas)
    handler.setInputAction((event: { position: Cartesian2 }) => {
      const ray = map.camera.getPickRay(event.position)
      const position = (ray && map.scene.globe.pick(ray, map.scene)) || map.camera.pickEllipsoid(event.position, map.scene.globe.ellipsoid)
      if (!position) return
      const point = Cartographic.fromCartesian(position)
      onPick(pick, [point.longitude * 180 / Math.PI, point.latitude * 180 / Math.PI])
    }, ScreenSpaceEventType.LEFT_CLICK)
    return () => { handler.destroy() }
  }, [viewer, ready, epoch, pick, onPick])
}
