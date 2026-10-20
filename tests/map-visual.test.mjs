import test from 'node:test'
import assert from 'node:assert/strict'
import { nearRoute } from '../src/lib/mapVisual.ts'

test('facility clutter uses distance to route segments, including segment interiors', () => {
  const route = [[-0.13, 51.506], [-0.12, 51.506]]
  assert.equal(nearRoute([-0.125, 51.5061], route), true)
  assert.equal(nearRoute([-0.125, 51.51], route), false)
  assert.equal(nearRoute([-0.14, 51.506], route), false)
})

test('empty and repeated route coordinates are safe', () => {
  assert.equal(nearRoute([-0.125, 51.506], []), false)
  assert.equal(nearRoute([-0.125, 51.506], [[-0.125, 51.506], [-0.125, 51.506]]), true)
  assert.equal(nearRoute([-0.13, 51.51], [[-0.125, 51.506], [-0.125, 51.506]]), false)
})
