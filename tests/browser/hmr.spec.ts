import { test, expect } from '@playwright/test'
import { mkdir, writeFile, unlink } from 'node:fs/promises'
import path from 'node:path'

test('authenticated same-origin HMR updates without reloading or replacing the map', async ({ page, baseURL }) => {
  const sockets: { host: string; port: string; connected: boolean }[] = []
  page.on('websocket', ws => {
    const url = new URL(ws.url()) // Never log the URL/query: it contains a Vite credential.
    const socket = { host: url.hostname, port: url.port, connected: false }
    sockets.push(socket)
    ws.on('framereceived', frame => {
      try { if (JSON.parse(String(frame.payload)).type === 'connected') socket.connected = true } catch { /* Non-JSON application frames are irrelevant. */ }
    })
  })
  await page.route('https://tile.openstreetmap.org/**', r => r.abort('internetdisconnected'))
  const directory = path.resolve('tests/browser/fixtures')
  const filename = `hmr-live-${process.pid}.ts`
  const file = path.join(directory, filename)
  const url = `/tests/browser/fixtures/${filename}`
  await mkdir(directory, { recursive: true })
  const moduleText = (value: string) => `document.body.dataset.hmrProbe = '${value}'; if (import.meta.hot) import.meta.hot.accept();\n`
  await writeFile(file, moduleText('before'))
  try {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeEnabled({ timeout: 30000 })
    await expect.poll(() => sockets.some(socket => socket.connected)).toBe(true)
    const origin = new URL(baseURL!)
    expect(sockets.filter(socket => socket.connected).every(socket => socket.host === origin.hostname && socket.port === origin.port)).toBe(true)
    await page.locator('.cesium-widget canvas').evaluate(canvas => { (window as unknown as { hmrCanvas: Element }).hmrCanvas = canvas })
    await page.addScriptTag({ type: 'module', url })
    await expect(page.locator('body')).toHaveAttribute('data-hmr-probe', 'before')
    await writeFile(file, moduleText('after'))
    await expect(page.locator('body')).toHaveAttribute('data-hmr-probe', 'after', { timeout: 15000 })
    expect(await page.locator('.cesium-widget canvas').evaluate(canvas => canvas === (window as unknown as { hmrCanvas: Element }).hmrCanvas)).toBe(true)
    await expect(page.locator('.cesium-widget canvas')).toHaveCount(1)
  } finally { await unlink(file).catch(() => {}) }
})

test('development server retains host and cross-origin protections', async ({ request, baseURL }) => {
  const rejected = await request.get(baseURL!, { headers: { Host: 'untrusted.example' } })
  expect(rejected.status()).toBe(403)
  const response = await request.get(baseURL!, { headers: { Origin: 'https://untrusted.example' } })
  expect(response.headers()['access-control-allow-origin']).not.toBe('*')
  expect(response.headers()['access-control-allow-origin']).not.toBe('https://untrusted.example')
})
