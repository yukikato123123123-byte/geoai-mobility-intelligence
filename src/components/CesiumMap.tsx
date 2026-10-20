import { useEffect, useRef, useState } from 'react'
import { BoundingSphere, Cartesian3, Color, Credit, EllipsoidTerrainProvider, GridImageryProvider, HeightReference, Event as CesiumEvent, ImageryLayer, OpenStreetMapImageryProvider, Viewer } from 'cesium'

import { useFacilityMap } from '../hooks/useFacilityMap'
import type { Facilities } from '../hooks/useFacilities'
import { useMapOverlays } from '../hooks/useMapOverlays'
import type { Mobility } from '../hooks/useMobility'
import { roadStyle } from '../lib/mobility'
import { frameMap, frameStudyArea } from '../lib/mapVisual'
import { useIonLayers } from '../hooks/useIonLayers'
import { safeCesiumMessage } from '../lib/remoteLayer'
import type { IonLayerStates } from '../lib/remoteLayer'
import { createBasemapController } from '../lib/basemap'

type Props = { ionSettings: Parameters<typeof useIonLayers>[3]; ionStates: IonLayerStates; facilities: Facilities; onSelectFacility: (id: string) => void; mobility: Mobility; markerVisible: boolean; basemapVisible: boolean; title: string }

export function CesiumMap({ ionSettings, ionStates, markerVisible, basemapVisible, title, mobility, facilities, onSelectFacility }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const viewer = useRef<Viewer | null>(null)
  const basemap = useRef<ReturnType<typeof createBasemapController<ImageryLayer>> | null>(null)
  const gridRef = useRef(false)
  const viewerFailed = useRef(false)
  const [attempt, setAttempt] = useState(0)
  const [mode, setMode] = useState<'2D' | '3D'>('3D')
  const [status, setStatus] = useState('Loading Map…')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [grid, setGrid] = useState(false)

  useEffect(() => {
    if (!container.current) return
    let disposed = false
    viewerFailed.current = false
    let instance: Viewer | undefined
    const removers: (() => void)[] = []
    let frameTimeout: ReturnType<typeof setTimeout> | undefined
    let removeReady = () => {}
    try {
      instance = new Viewer(container.current, {
        baseLayer: false, terrainProvider: new EllipsoidTerrainProvider(),
        animation: false, timeline: false, baseLayerPicker: false, geocoder: false,
        homeButton: false, sceneModePicker: false, navigationHelpButton: false,
        fullscreenButton: false, infoBox: false, selectionIndicator: false,
        // The dashboard reports renderError with the original cause and a retry action.
        showRenderLoopErrors: false,
        requestRenderMode: true, maximumRenderTimeChange: Infinity,
      })
      const map = instance
      viewer.current = map
      // Local road/facility data needs visible OSM attribution even without imagery.
      map.creditDisplay.addStaticCredit(new Credit('© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>', true))
      map.scene.globe.baseColor = Color.fromCssColorString('#101c26')
      map.scene.globe.enableLighting = false
      map.scene.backgroundColor = Color.fromCssColorString('#080f17')
      if (map.scene.skyBox) map.scene.skyBox.show = false
      if (map.scene.sun) map.scene.sun.show = false
      if (map.scene.moon) map.scene.moon.show = false
      if (map.scene.skyAtmosphere) map.scene.skyAtmosphere.show = false
      map.scene.fog.enabled = false
      map.scene.postProcessStages.fxaa.enabled = true
      map.scene.screenSpaceCameraController.minimumZoomDistance = 150
      map.scene.screenSpaceCameraController.maximumZoomDistance = 15000000
      map.entities.add({ id: 'london', name: 'London study area center', position: Cartesian3.fromDegrees(-0.125, 51.5065),
        point: { heightReference: HeightReference.CLAMP_TO_TERRAIN, pixelSize: 5, color: Color.fromCssColorString('#b1c6d3'), outlineColor: Color.fromCssColorString('#101c26'), outlineWidth: 2 },
      })
      frameStudyArea(map, 0)
      // Globe progress includes terrain. Track imagery requests separately so slow
      // elevation never gets reported as an OSM imagery timeout.
      const imageryProgress = new CesiumEvent<(count: number) => void>()
      let pendingImagery = 0
      let receivedImagery = false
      let imageryGeneration = 0
      const controller = createBasemapController<ImageryLayer>({
        create: mode => {
          const generation = ++imageryGeneration
          pendingImagery = 0; receivedImagery = false
          const provider = mode === 'grid'
            ? new GridImageryProvider({ cells: 16, color: Color.fromCssColorString('#314550').withAlpha(0.18), canvasSize: 1024, glowWidth: 0, glowColor: Color.TRANSPARENT, backgroundColor: Color.fromCssColorString('#101c26') })
            : new OpenStreetMapImageryProvider({ url: 'https://tile.openstreetmap.org/', maximumLevel: 19,
              credit: new Credit('© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>', true) })
          if (provider instanceof OpenStreetMapImageryProvider) {
            const request = provider.requestImage
            provider.requestImage = function (...args) {
              const result = request.apply(this, args)
              if (!result) return result
              pendingImagery++; imageryProgress.raiseEvent(pendingImagery)
              return Promise.resolve(result).then(image => {
                if (generation === imageryGeneration && image) receivedImagery = true
                return image
              }).finally(() => {
                if (!disposed && generation === imageryGeneration) { pendingImagery--; imageryProgress.raiseEvent(pendingImagery) }
              })
            }
          }
          return new ImageryLayer(provider)
        },
        replace: (next, previous) => {
          // Style the imagery itself; overlays retain their original color contrast.
          const external = next.imageryProvider instanceof OpenStreetMapImageryProvider
          next.brightness = external ? 0.32 : 1
          next.saturation = external ? 0.12 : 1
          next.contrast = external ? 1.25 : 1
          next.gamma = external ? 0.85 : 1
          next.show = previous?.show ?? true
          if (previous) map.imageryLayers.remove(previous, true)
          map.imageryLayers.add(next, 0)
          map.scene.requestRender()
        },
        errors: layer => layer.imageryProvider.errorEvent,
        progress: imageryProgress,
        frame: map.scene.postRender,
        tilesLoaded: () => receivedImagery && pendingImagery === 0,
        update: state => {
          if (disposed) return
          gridRef.current = state.mode === 'grid'
          setGrid(gridRef.current); setStatus(state.status); setError(state.error)
        },
        log: (message, cause) => console.error(message, cause),
      })
      basemap.current = controller
      controller.select(gridRef.current ? 'grid' : 'osm')
      removers.push(() => controller.dispose())
      removers.push(map.scene.renderError.addEventListener((_scene, cause) => {
        viewerFailed.current = true
        removeReady()
        console.error('Cesium rendering failed', safeCesiumMessage(cause))
        controller.dispose()
        clearTimeout(frameTimeout)
        setStatus('Map Rendering Failed')
        setError(`Cesium rendering failed: ${safeCesiumMessage(cause)}`)
        setReady(false)
      }))
      frameTimeout = setTimeout(() => {
        viewerFailed.current = true
        removeReady()
        controller.dispose()
        setStatus('Map Rendering Failed')
        setError('Cesium did not render a frame within 20 seconds. Check WebGL support and hardware acceleration.')
        setReady(false)
      }, 20000)
      // Readiness follows the first rendered frame, not just Viewer construction.
      removeReady = map.scene.postRender.addEventListener(() => {
        clearTimeout(frameTimeout)
        setReady(true)
        removeReady()
      })
      removers.push(removeReady)
    } catch (cause) {
      viewerFailed.current = true
      clearTimeout(frameTimeout)
      removers.forEach(remove => remove())
      basemap.current = null
      viewer.current = null
      if (instance && !instance.isDestroyed()) instance.destroy()
      console.error('Cesium initialization failed', safeCesiumMessage(cause))
      queueMicrotask(() => {
        if (disposed) return
        setReady(false)
        setError(`Unable to initialize the map: ${safeCesiumMessage(cause)}. Check WebGL support and hardware acceleration.`)
        setStatus('Unable to Load Map')
      })
    }
    return () => {
      disposed = true
      clearTimeout(frameTimeout)
      basemap.current = null
      removers.forEach(remove => remove())
      viewer.current = null
      if (instance && !instance.isDestroyed()) instance.destroy()
    }
  }, [attempt])

  useEffect(() => {
    const map = viewer.current
    if (!map || map.isDestroyed()) return
    const marker = map.entities.getById('london')
    if (marker) marker.show = markerVisible
    if (map.imageryLayers.length) map.imageryLayers.get(0).show = basemapVisible
    basemap.current?.setVisible(basemapVisible)
    map.scene.requestRender()
  }, [markerVisible, basemapVisible, ready, attempt, grid])

  useIonLayers(viewer, ready, attempt, ionSettings)
  useMapOverlays(viewer, ready, `${attempt}`, mobility)
  useFacilityMap(viewer, ready, `${attempt}`, facilities, mobility, onSelectFacility)

  function focusRoads() {
    if (viewer.current) frameStudyArea(viewer.current)
  }
  function fitRoute() {
    if (mobility.result.route) {
      const sphere = BoundingSphere.fromPoints(Cartesian3.fromDegreesArray(mobility.result.route.coordinates.flat()))
      if (viewer.current) frameMap(viewer.current, sphere)
    }
  }
  function restart(useGrid: boolean) {
    if (viewer.current && !viewer.current.isDestroyed() && !viewerFailed.current && basemap.current) {
      basemap.current.select(useGrid ? 'grid' : 'osm')
      return
    }
    gridRef.current = useGrid
    setGrid(useGrid); setError(''); setReady(false); setStatus('Loading Map…'); setMode('3D')
    setAttempt(value => value + 1)
  }
  function changeMode(next: '2D' | '3D') {
    const map = viewer.current
    if (!map) return
    if (next === '2D') map.scene.morphTo2D(0)
    else map.scene.morphTo3D(0)
    frameStudyArea(map)
    setMode(next)
  }
  function home() {
    const map = viewer.current
    if (!map) return
    frameStudyArea(map)
  }
  function zoom(direction: number) {
    const map = viewer.current
    if (map) { map.camera.zoomIn(direction * map.camera.positionCartographic.height * 0.35); map.scene.requestRender() }
  }

  return <section className={`map-panel panel ${mobility.pick ? 'picking-endpoint' : ''}`} aria-label="Interactive London map">
    <div className="cesium-host" ref={container} />
    <div className="map-heading glass"><h1>{title}</h1><p><span className="blue-dot" /> WESTMINSTER / LONDON <span className="map-coordinate">51.5065° N · 0.1250° W</span></p></div>
    <div className="map-badge glass"><span className="blue-dot" /> LOCAL OSM EXTRACT<small>Live traffic not connected</small></div>
    <details className="legend glass"><summary>Map legend &amp; sources</summary><strong>{mobility.roadsVisible ? 'OSM Road Classes' : 'Road Network Hidden'}</strong>{mobility.roadsVisible && ['motorway', 'primary', 'secondary', 'service'].map(highway => { const style = roadStyle(highway); return <div key={highway}><i style={{ background: style.color }} />{style.label}</div> })}<small>Road class · Not traffic speed</small><small role="status">{mobility.roads.message}</small>{mobility.roads.status === 'error' && <button onClick={mobility.retryRoads}>Retry Roads</button>}<button disabled={!ready} onClick={focusRoads}>Focus Road Area</button>{mobility.result.route && <button disabled={!ready} onClick={fitRoute}>Fit Route</button>}<small><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></small></details>
    {mobility.pick && <div className="pick-notice glass" role="status">Click to select {mobility.pick} inside the road area.</div>}
    {error && <div className={`map-error ${ready ? 'map-imagery-notice' : ''}`} role="alert"><strong>{ready ? 'Basemap Unavailable' : 'Unable to Load Map'}</strong><p>{error}</p><button onClick={() => restart(ready ? false : grid)}>{ready ? 'Reconnect to OSM' : 'Retry'}</button>{ready && <button onClick={() => restart(true)}>Continue with Local Grid</button>}{!ready && <button onClick={() => restart(!grid)}>{grid ? 'Reconnect to OSM' : 'Use Local Grid'}</button>}</div>}
    <div className="map-surface-note glass">{mode} VIEW <span>{ionStates.terrain.status === 'ready' ? 'World Terrain' : ionStates.terrain.status === 'streaming' ? 'Terrain streaming' : 'Ellipsoid surface'} · {ionStates.buildings.status === 'ready' ? 'OSM Buildings' : ionStates.buildings.status === 'streaming' ? 'Buildings streaming' : 'No active buildings'}</span></div>
    <div className="zoom-controls glass"><button disabled={!ready} onClick={() => zoom(1)} aria-label="Zoom in">＋</button><button disabled={!ready} onClick={() => zoom(-1)} aria-label="Zoom out">−</button></div>
    <div className="map-controls glass"><button disabled={!ready} aria-pressed={mode === '2D'} onClick={() => changeMode('2D')}>2D</button><button disabled={!ready} aria-pressed={mode === '3D'} onClick={() => changeMode('3D')}>3D</button><button disabled={!ready} onClick={home} aria-label="Return to London" title="Frame London study area">◎</button><button onClick={() => restart(!grid)}>{grid ? 'OSM Map' : 'Local Grid'}</button></div>
    <div className="map-status glass" role="status"><span className="blue-dot" /> {status}<span>{!basemapVisible ? 'Basemap hidden' : grid ? 'Local grid' : 'OpenStreetMap · Development'} · No observation timestamp</span></div>
  </section>
}
