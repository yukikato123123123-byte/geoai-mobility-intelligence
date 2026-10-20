import test from 'node:test'
import assert from 'node:assert/strict'
import net from 'node:net'
import { createServer } from 'vite'

// Exercise the actual occupied-port behavior, not a duplicate of config values.
test('development server refuses an occupied port rather than silently drifting', async () => {
  const occupied = net.createServer()
  await new Promise((resolve, reject) => { occupied.once('error', reject); occupied.listen(0, '127.0.0.1', resolve) })
  let server
  try {
    const { port } = occupied.address()
    server = await createServer({ configFile: 'vite.config.ts', server: { port, watch: null, preTransformRequests: false } })
    await assert.rejects(server.listen(), /already in use|EADDRINUSE/)
  } finally {
    await server?.close()
    await new Promise(resolve => occupied.close(resolve))
  }
})
