// Cesium metadata errors can include signed resource URLs before rejecting.
// Sanitize console arguments as well as the app's structured layer diagnostics.
export function redactDiagnostic(value: unknown, credential = '', seen = new WeakSet<object>(), depth = 0): unknown {
  if (typeof value === 'string') {
    let result = credential ? value.split(credential).join('[credential withheld]') : value
    result = result.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[credential withheld]')
    result = result.replace(/(authorization\s*[:=]\s*(?:Bearer\s+)?)[^\s,;"']+/gi, '$1[credential withheld]')
    return result.replace(/((?:access_token|accessToken|token|authorization)[=:\s]+)[^\s&;,"']+/gi, '$1[credential withheld]')
  }
  if (value === null || typeof value !== 'object') return value
  if (seen.has(value) || depth > 6) return '[diagnostic details omitted]'
  seen.add(value)
  if (value instanceof Error) return { name: redactDiagnostic(value.name, credential), message: redactDiagnostic(value.message, credential), stack: redactDiagnostic(value.stack, credential) }
  const result: Record<string, unknown> = {}
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value)).slice(0, 40)) {
    if (!('value' in descriptor)) continue // Never invoke diagnostic getters.
    result[key] = /token|authorization|secret/i.test(key) ? '[credential withheld]' : redactDiagnostic(descriptor.value, credential, seen, depth + 1)
  }
  return result
}
export function installCredentialLogRedaction(credential: string) {
  for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    const original = console[method].bind(console)
    console[method] = (...args: unknown[]) => original(...args.map(value => redactDiagnostic(value, credential)))
  }
}
