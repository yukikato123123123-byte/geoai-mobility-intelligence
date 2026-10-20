import { BoundingSphere, Cartesian3, HeadingPitchRange, Math as CesiumMath, Matrix4, SceneMode } from 'cesium'
import type { Viewer } from 'cesium'
import type { Coordinate } from './mobility.ts'
import { TEST_BOUNDS } from './mobility.ts'

export function frameMap(map: Viewer, sphere: BoundingSphere, duration = 0.8) {
  map.camera.flyToBoundingSphere(sphere, { duration, offset: new HeadingPitchRange(
    CesiumMath.toRadians(-15), map.scene.mode === SceneMode.SCENE2D ? -Math.PI / 2 : CesiumMath.toRadians(-48),
    Math.max(1200, sphere.radius * 3.1),
  ) })
}
export function frameStudyArea(map: Viewer, duration = 0.8) {
  const [west, south, east, north] = TEST_BOUNDS
  const sphere = BoundingSphere.fromPoints(Cartesian3.fromDegreesArray([west, south, east, north]))
  frameMap(map, sphere, duration)
  if (duration === 0) map.camera.lookAtTransform(Matrix4.IDENTITY)
}

// Distance to the whole route, not just its vertices. Used only to reduce POI clutter.
export function nearRoute(point: Coordinate, route: Coordinate[], threshold = 45) {
  const scaleX = 111320 * Math.cos(point[1] * Math.PI / 180)
  const scaleY = 111320
  for (let i = 1; i < route.length; i++) {
    const a = [(route[i - 1][0] - point[0]) * scaleX, (route[i - 1][1] - point[1]) * scaleY]
    const b = [(route[i][0] - point[0]) * scaleX, (route[i][1] - point[1]) * scaleY]
    const dx = b[0] - a[0], dy = b[1] - a[1]
    const length = dx * dx + dy * dy
    const t = length ? Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / length)) : 0
    if (Math.hypot(a[0] + t * dx, a[1] + t * dy) < threshold) return true
  }
  return false
}
