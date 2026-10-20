import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { Cesium3DTileset, Cesium3DTileStyle, CesiumTerrainProvider, EllipsoidTerrainProvider, IonResource } from 'cesium'
import type { Viewer } from 'cesium'
import { ionConfig } from '../lib/ionConfig'
import { createRemoteLayer } from '../lib/remoteLayer'
import type { IonLayerStates } from '../lib/remoteLayer'

type Settings = {
  buildings: boolean; terrain: boolean; buildingRetry: number; terrainRetry: number
  onState: (layer: keyof IonLayerStates, state: IonLayerStates['buildings']) => void
}
export function useIonLayers(viewer: RefObject<Viewer | null>, ready: boolean, epoch: number, settings: Settings) {
  const controllers = useRef<{ buildings: ReturnType<typeof createRemoteLayer<Cesium3DTileset>>; terrain: ReturnType<typeof createRemoteLayer<CesiumTerrainProvider>> } | null>(null)
  const { buildings, terrain, buildingRetry, terrainRetry, onState } = settings
  useEffect(() => {
    const map = viewer.current
    if (!ready || !map || map.isDestroyed()) return
    const buildingsController = createRemoteLayer<Cesium3DTileset>({
      configured: ionConfig.configured,
      load: async () => {
        const source = await IonResource.fromAssetId(96188, { accessToken: ionConfig.token })
        const tileset = await Cesium3DTileset.fromUrl(source, { // Accurate projection also avoids model-matrix reprojection on mode changes.
          projectTo2D: true, maximumScreenSpaceError: 12, showCreditsOnScreen: true })
        tileset.style = new Cesium3DTileStyle({ color: "color('#617887')" })
        return tileset
      },
      attach: (tileset, rendered, failed) => {
        const removeVisible = tileset.tileVisible.addEventListener(tile => {
          if (tile.content.featuresLength > 0 || tile.content.trianglesLength > 0) { rendered(); removeVisible() }
        })
        const removeFailed = tileset.tileFailed.addEventListener(failed)
        map.scene.primitives.add(tileset)
        map.scene.requestRender()
        return () => { removeVisible(); removeFailed() }
      },
      release: tileset => {
        if (!map.isDestroyed() && map.scene.primitives.contains(tileset)) map.scene.primitives.remove(tileset)
        if (!tileset.isDestroyed()) tileset.destroy()
        if (!map.isDestroyed()) map.scene.requestRender()
      },
      update: state => onState('buildings', state),
      diagnostic: message => console.warn(`Cesium OSM Buildings: ${message}`),
    })
    const terrainController = createRemoteLayer<CesiumTerrainProvider>({
      configured: ionConfig.configured,
      load: async () => {
        const source = await IonResource.fromAssetId(1, { accessToken: ionConfig.token })
        return CesiumTerrainProvider.fromUrl(source, { requestVertexNormals: true })
      },
      attach: (provider, rendered, failed) => {
        // A metadata response alone is not a successfully rendered terrain layer.
        const request = provider.requestTileGeometry
        let receivedGeometry = false
        provider.requestTileGeometry = function (...args) {
          const result = request.apply(this, args)
          return result?.then(data => { if (data) receivedGeometry = true; return data })
        }
        const removeError = provider.errorEvent.addEventListener(failed)
        const removeFrame = map.scene.postRender.addEventListener(() => {
          if (receivedGeometry) { rendered(); removeFrame() }
        })
        map.terrainProvider = provider
        map.scene.requestRender()
        return () => {
          removeError(); removeFrame(); provider.requestTileGeometry = request
          if (!map.isDestroyed() && map.terrainProvider === provider) {
            map.terrainProvider = new EllipsoidTerrainProvider()
            map.scene.requestRender()
          }
        }
      },
      release: () => { /* TerrainProvider has no destroy API; removing it releases globe tile references. */ },
      update: state => onState('terrain', state),
      diagnostic: message => console.warn(`Cesium World Terrain: ${message}`),
    })
    controllers.current = { buildings: buildingsController, terrain: terrainController }
    return () => {
      controllers.current = null
      buildingsController.dispose(); terrainController.dispose()
      if (!map.isDestroyed()) {
        const state = { status: ionConfig.configured ? 'off' as const : 'unconfigured' as const, message: 'Viewer is not active' }
        onState('buildings', state); onState('terrain', state)
      }
    }
  }, [viewer, ready, epoch, onState])
  useEffect(() => { controllers.current?.buildings.setEnabled(buildings) }, [buildings, ready, epoch])
  useEffect(() => { controllers.current?.terrain.setEnabled(terrain) }, [terrain, ready, epoch])
  useEffect(() => { if (buildingRetry) controllers.current?.buildings.retry() }, [buildingRetry])
  useEffect(() => { if (terrainRetry) controllers.current?.terrain.retry() }, [terrainRetry])
}
