import test from 'node:test'
import assert from 'node:assert/strict'
import { redactDiagnostic } from '../src/lib/credentialLogs.ts'

test('console diagnostics redact configured credentials and signed resource tokens', () => {
  const credential = 'synthetic-test-value'
  const error = new Error(`Access failed https://example.test/?access_token=${credential}`)
  const value = { error, resource: { accessToken: credential, url: 'https://example.test/?access_token=eyJfake.payload.signature' }, headers: { Authorization: 'Bearer another-value' } }
  const result = JSON.stringify(redactDiagnostic(value, credential))
  for (const secret of [credential, 'eyJfake.payload.signature', 'another-value']) assert.equal(result.includes(secret), false)
  assert.match(result, /Access failed/)
})
test('diagnostic traversal never invokes getters and handles cycles', () => {
  const value = { statusCode: 403 }
  Object.defineProperty(value, 'unsafe', { get() { throw new Error('should not execute') } })
  value.self = value
  assert.doesNotThrow(() => redactDiagnostic(value))
  assert.equal(redactDiagnostic(value).statusCode, 403)
})

test('free-form bearer header strings are redacted', () => {
  assert.equal(String(redactDiagnostic('Authorization: Bearer opaque-test-value')).includes('opaque-test-value'), false)
})
