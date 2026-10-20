import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

// Only synthetic credentials are used by regression tests. Never use .env.local here.
async function configuredSources(page: Page) {
  await page.route('**/src/lib/ionConfig.ts*', r => r.fulfill({ contentType: 'application/javascript', body:
    'export const ionConfig = { token: "synthetic-test-credential", configured: true, buildingsEnabled: true, terrainEnabled: true };' }))
  await page.route('https://tile.openstreetmap.org/**', r => r.abort('internetdisconnected'))
}

test('ion permission errors remain independent and do not disable local data', async ({ page }) => {
  await configuredSources(page)
  let buildingRequests = 0, terrainRequests = 0
  await page.route('https://api.cesium.com/v1/assets/*/endpoint*', r => {
    const building = new URL(r.request().url()).pathname.includes('/96188/')
    if (building) buildingRequests++; else terrainRequests++
    return r.fulfill({ status: building ? 403 : 401, contentType: 'application/json', body: '{}' })
  })
  await page.goto('/')
  const buildings = page.locator('[data-layer="buildings"]'), terrain = page.locator('[data-layer="terrain"]')
  await expect(buildings).toContainText('HTTP 403')
  await expect(terrain).toContainText('HTTP 401')
  await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Continue with Local Grid', exact: true }).click()
  await page.getByRole('switch', { name: '3D Buildings', exact: true }).uncheck()
  await expect(buildings).toContainText('Off')
  await expect(terrain).toContainText('HTTP 401')
  const oldTerrain = terrainRequests
  await page.getByRole('switch', { name: '3D Buildings', exact: true }).check()
  await expect(buildings).toContainText('HTTP 403')
  expect(buildingRequests).toBeGreaterThan(1); expect(terrainRequests).toBe(oldTerrain)
  await page.getByRole('button', { name: 'Retry Terrain', exact: true }).click()
  await expect.poll(() => terrainRequests).toBeGreaterThan(oldTerrain)
  await expect(page.locator('.map-panel')).toContainText('Ellipsoid surface')
  await page.locator('.legend summary').click()
  await expect(page.locator('.legend')).toContainText('953 OSM road ways loaded')
  expect(await page.locator('body').innerText()).not.toContain('synthetic-test-credential')
  expect(await page.locator('.cesium-widget canvas').count()).toBe(1)
})

test('disabling an in-flight ion source ignores its later rejection', async ({ page }) => {
  await configuredSources(page)
  let release: () => Promise<void> = async () => {}
  await page.route('https://api.cesium.com/v1/assets/*/endpoint*', async r => {
    if (new URL(r.request().url()).pathname.includes('/96188/')) release = async () => { await r.fulfill({ status: 403, body: '{}' }) }
    else await r.fulfill({ status: 401, body: '{}' })
  })
  await page.goto('/')
  await expect(page.locator('[data-layer="buildings"]')).toContainText('Loading')
  await page.getByRole('switch', { name: '3D Buildings', exact: true }).uncheck()
  await release()
  await expect(page.locator('[data-layer="buildings"]')).toContainText('Off')
  await expect(page.locator('[data-layer="terrain"]')).toContainText('HTTP 401')
  await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeEnabled()
})

test('ion timeout falls back without a viewer failure', async ({ page }) => {
  await configuredSources(page)
  await page.route('https://api.cesium.com/v1/assets/*/endpoint*', () => {})
  await page.goto('/')
  await expect(page.locator('[data-layer="terrain"]')).toContainText('25 seconds', { timeout: 35000 })
  await expect(page.locator('[data-layer="buildings"]')).toContainText('25 seconds')
  await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeEnabled()
  await expect(page.locator('.map-surface-note')).toContainText('Ellipsoid surface')
  expect(await page.locator('.cesium-widget canvas').count()).toBe(1)
})
