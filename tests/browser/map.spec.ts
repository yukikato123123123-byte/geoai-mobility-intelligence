import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// Instrument only the test response, so production code exposes no viewer global.
async function inspectViewer(page: Page) {
  await page.route('**/src/components/CesiumMap.tsx*', async route => {
    const response = await route.fetch()
    await route.fulfill({ response, body: (await response.text()).replace('viewer.current = map;', `viewer.current = map;
      window.testMaps = window.testMaps || [];
      window.testMaps.push(map);`) })
  })
}
async function snapshot(page: Page) {
  return page.evaluate(() => {
    const maps = (window as unknown as { testMaps: import('cesium').Viewer[] }).testMaps
    const live = maps.filter(m => !m.isDestroyed())
    const map = live[0]
    return { created: maps.length, live: live.length, layers: map.imageryLayers.length,
      entities: map.entities.values.map(e => e.id).sort(), frame: map.scene.frameState.frameNumber }
  })
}
const tile = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')

test.beforeEach(async ({ page }) => { await inspectViewer(page) })

test('successful tiles, repeated switches, overlay preservation, and unmount cleanup', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/png', body: tile }))
  await page.goto('/')
  await expect(page.locator('.map-status')).toContainText('Basemap Tiles Loaded', { timeout: 30000 })
  await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeEnabled()
  await expect.poll(async () => (await snapshot(page)).entities.some(id => id.startsWith('facility-'))).toBe(true)
  const initial = await snapshot(page)
  expect(initial.live).toBe(1)
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Local Grid', exact: true }).click()
    await expect(page.locator('.map-status')).toContainText('Local grid · No geographic basemap')
    await page.getByRole('button', { name: 'OSM Map', exact: true }).click()
    await expect(page.locator('.map-status')).toContainText('Basemap Tiles Loaded', { timeout: 30000 })
  }
  const after = await snapshot(page)
  expect(after.created).toBe(initial.created); expect(after.layers).toBe(1)
  expect(after.entities).toEqual(initial.entities)
  expect(errors).toEqual([])
  // React unmount calls effect cleanup and destroys the remaining viewer.
  await page.route('**/src/main.tsx*', async route => {
    const response = await route.fetch()
    await route.fulfill({ response, body: (await response.text()).replace('createRoot(document.getElementById("root"))', '(window.testRoot = createRoot(document.getElementById("root")))') })
  })
  await page.reload()
  await expect(page.locator('.map-status')).toContainText('Basemap Tiles Loaded', { timeout: 30000 })
  await page.evaluate(() => (window as unknown as { testRoot: { unmount(): void } }).testRoot.unmount())
  expect(await page.evaluate(() => (window as unknown as { testMaps: import('cesium').Viewer[] }).testMaps.every(m => m.isDestroyed()))).toBe(true)
})

test('network failure reports the tile error, keeps viewer, and reconnects', async ({ page }) => {
  const logs: string[] = []
  page.on('console', m => { if (m.type() === 'error') logs.push(m.text()) })
  await page.route('https://tile.openstreetmap.org/**', route => route.abort('internetdisconnected'))
  await page.goto('/')
  await expect(page.locator('.map-status')).toContainText('Local grid · No geographic basemap', { timeout: 30000 })
  await expect(page.getByRole('alert')).toContainText('Basemap Unavailable')
  await expect(page.getByRole('alert')).toContainText('Failed to obtain image tile')
  await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeEnabled()
  const initial = await snapshot(page)
  expect(initial.layers).toBe(1)
  expect(logs.some(m => m.includes('OpenStreetMap imagery failed'))).toBe(true)
  await page.unroute('https://tile.openstreetmap.org/**')
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/png', body: tile }))
  await page.getByRole('button', { name: 'Reconnect to OSM', exact: true }).click()
  await expect(page.locator('.map-status')).toContainText('Basemap Tiles Loaded', { timeout: 30000 })
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect((await snapshot(page)).created).toBe(initial.created)
})

test('pending imagery times out into a working grid without replacing viewer', async ({ page }) => {
  let tileRequests = 0
  await page.route('https://tile.openstreetmap.org/**', () => { tileRequests++ })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeEnabled({ timeout: 30000 })
  const initial = await snapshot(page)
  await expect(page.locator('.map-status')).toContainText('Local grid · No geographic basemap', { timeout: 30000 })
  await expect(page.getByRole('alert')).toContainText('timed out after 20 seconds')
  const after = await snapshot(page)
  expect(after.created).toBe(initial.created); expect(after.live).toBe(1); expect(after.layers).toBe(1)
  expect(after.frame).toBeGreaterThan(initial.frame)
  const requestsAtFallback = tileRequests
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await page.waitForTimeout(400)
  expect(tileRequests).toBe(requestsAtFallback)
  await expect(page.locator('.cesium-viewer-bottom').getByRole('link', { name: 'OpenStreetMap contributors', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeEnabled()
})

test('WebGL failure is identified as viewer initialization failure', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (id: string, ...args: unknown[]) {
      if (id.includes('webgl')) return null
      return Reflect.apply(getContext, this, [id, ...args])
    } as typeof getContext
  })
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('Unable to initialize the map')
  await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeDisabled()
  await expect(page.locator('.map-status')).toContainText('Unable to Load Map')
})

test('rendering errors remain distinct and retry cleans up the failed viewer', async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/png', body: tile }))
  await page.goto('/')
  await expect(page.locator('.map-status')).toContainText('Basemap Tiles Loaded', { timeout: 30000 })
  const initial = await snapshot(page)
  await page.evaluate(() => {
    const map = (window as unknown as { testMaps: import('cesium').Viewer[] }).testMaps.find(m => !m.isDestroyed())!
    map.useDefaultRenderLoop = false
    map.scene.renderError.raiseEvent(map.scene, new Error('Test render failure'))
  })
  await expect(page.locator('.map-status')).toContainText('Map Rendering Failed')
  await expect(page.getByRole('alert')).toContainText('Cesium rendering failed: Test render failure')
  await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.locator('.map-status')).toContainText('Basemap Tiles Loaded', { timeout: 30000 })
  const after = await snapshot(page)
  expect(after.created).toBe(initial.created + 1); expect(after.live).toBe(1); expect(after.layers).toBe(1)
})

test('local grid retains facility search and OSRM route overlays', async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', route => route.abort('internetdisconnected'))
  let routingRequests = 0
  await page.route('https://routing.openstreetmap.de/**', route => {
    routingRequests++
    return route.fulfill({ json: { code: 'Ok', routes: [{ distance: 1250, duration: 180,
      geometry: { type: 'LineString', coordinates: [[-0.1281, 51.5076], [-0.1246, 51.5008]] } }],
      waypoints: [{ location: [-0.1281, 51.5076], distance: 3 }, { location: [-0.1246, 51.5008], distance: 4 }] } })
  })
  await page.goto('/')
  await expect(page.locator('.map-status')).toContainText('Local grid · No geographic basemap')
  await page.getByRole('button', { name: 'Continue with Local Grid', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Facility Accessibility', exact: true }).click()
  await page.getByRole('searchbox', { name: 'Search facility names' }).fill('56 Dean Street')
  await expect(page.locator('.facility-results li')).toHaveCount(1)
  expect(routingRequests).toBe(0)
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Route Planning', exact: true }).click()
  await page.getByRole('button', { name: 'Find Driving Route', exact: true }).click()
  await expect(page.locator('.route-result')).toContainText('1.25 km')
  expect(routingRequests).toBe(1)
  await expect.poll(async () => (await snapshot(page)).entities.includes('driving-route')).toBe(true)
  const initial = await snapshot(page)
  await page.getByRole('switch', { name: '⌁ Route & Endpoints', exact: true }).uncheck()
  await expect.poll(async () => (await snapshot(page)).entities.includes('driving-route')).toBe(false)
  await page.getByRole('switch', { name: '⌁ Route & Endpoints', exact: true }).check()
  await expect.poll(async () => (await snapshot(page)).entities.includes('driving-route')).toBe(true)
  await page.getByRole('button', { name: '2D', exact: true }).click()
  await expect(page.getByRole('button', { name: '2D', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '3D', exact: true }).click()
  expect((await snapshot(page)).created).toBe(initial.created)
})

test('GIS layer controls, selected facilities, camera framing, and unavailable 3D sources', async ({ page }) => {
  const ionRequests: string[] = []
  page.on('request', r => { if (/cesium\.com|cesium\.ion/.test(r.url())) ionRequests.push(r.url()) })
  await page.route('https://tile.openstreetmap.org/**', r => r.abort('internetdisconnected'))
  await page.goto('/')
  await page.getByRole('button', { name: 'Continue with Local Grid', exact: true }).click()
  await expect(page.getByRole('switch', { name: '3D Buildings', exact: true })).toBeDisabled()
  await expect(page.getByRole('switch', { name: 'Terrain', exact: true })).toBeDisabled()
  await expect(page.locator('.cesium-viewer-bottom').getByRole('link', { name: 'OpenStreetMap contributors', exact: true })).toBeVisible()
  await expect(page.getByLabel('3D data availability')).toContainText('Cesium ion token not configured')
  await expect(page.locator('.map-surface-note')).toContainText('Ellipsoid surface')
  const initial = await snapshot(page)
  expect(initial.entities.filter(id => id.startsWith('road-')).length).toBe(954)
  expect(initial.entities.filter(id => id.startsWith('facility-')).length).toBe(25)
  await page.getByRole('switch', { name: '≋ Road Network', exact: true }).uncheck()
  await expect.poll(async () => (await snapshot(page)).entities.filter(id => id.startsWith('road-')).length).toBe(0)
  await page.getByRole('switch', { name: '≋ Road Network', exact: true }).check()
  await expect.poll(async () => (await snapshot(page)).entities.filter(id => id.startsWith('road-')).length).toBe(954)
  await page.getByRole('switch', { name: /H Hospitals & Clinics/ }).uncheck()
  await expect.poll(() => page.evaluate(() => {
    const map = (window as unknown as { testMaps: import('cesium').Viewer[] }).testMaps.find(m => !m.isDestroyed())!
    return map.entities.values.filter(e => e.id.startsWith('facility-') && e.name?.endsWith('Hospitals & Clinics')).every(e => !e.show)
  })).toBe(true)
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Facility Accessibility', exact: true }).click()
  await page.getByRole('searchbox', { name: 'Search facility names' }).fill('56 Dean Street')
  await page.locator('.facility-results button').click()
  await expect(page.getByLabel('Selected facility')).toContainText('56 Dean Street')
  await expect.poll(() => page.evaluate(() => {
    const map = (window as unknown as { testMaps: import('cesium').Viewer[] }).testMaps.find(m => !m.isDestroyed())!
    const selected = map.entities.values.find(e => e.id.startsWith('facility-') && e.name?.startsWith('56 Dean Street'))!
    return selected.show && selected.label?.show?.getValue(map.clock.currentTime) && map.camera.pitch > -1.15 && map.camera.pitch < -0.6
  })).toBe(true)
  await page.locator('.legend summary').click()
  await page.getByRole('button', { name: 'Focus Road Area', exact: true }).click()
  await page.locator('.legend summary').click()
  await page.getByRole('button', { name: '2D', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { testMaps: import('cesium').Viewer[] }).testMaps.find(m => !m.isDestroyed())!.scene.mode)).toBe(2)
  await page.getByRole('button', { name: '3D', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { testMaps: import('cesium').Viewer[] }).testMaps.find(m => !m.isDestroyed())!.scene.mode)).toBe(3)
  expect(ionRequests).toEqual([])
  expect((await snapshot(page)).created).toBe(initial.created)
})

for (const width of [390, 820]) {
  test(`responsive map and controls remain within the viewport at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.route('https://tile.openstreetmap.org/**', r => r.abort('internetdisconnected'))
    await page.goto('/')
    await page.getByRole('button', { name: 'Continue with Local Grid', exact: true }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    const panel = (await page.locator('.map-panel').boundingBox())!
    expect(panel.height).toBeGreaterThan(600)
    for (const selector of ['.map-controls', '.zoom-controls', '.map-status', '.legend', '.map-heading']) {
      const box = (await page.locator(selector).boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(panel.x)
      expect(box.x + box.width).toBeLessThanOrEqual(panel.x + panel.width)
      expect(box.y + box.height).toBeLessThanOrEqual(panel.y + panel.height)
    }
    await page.getByRole('button', { name: '2D', exact: true }).click()
    await expect(page.getByRole('button', { name: '2D', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: '3D', exact: true }).click()
    expect((await snapshot(page)).live).toBe(1)
  })
}
