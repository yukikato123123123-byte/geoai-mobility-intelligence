import { loadEnv } from 'vite'

// Never emit raw errors, response bodies, headers, URLs or environment values.
const token = loadEnv('development', process.cwd(), 'VITE_').VITE_CESIUM_ION_TOKEN?.trim()
if (!token) { console.log('Cesium ion token: missing'); process.exitCode = 1 }
else {
  console.log('Cesium ion token: configured (value withheld)')
  for (const [name, id] of [['World Terrain', 1], ['OSM Buildings', 96188]]) {
    try {
      const response = await fetch(`https://api.cesium.com/v1/assets/${id}/endpoint`, {
        headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000),
      })
      console.log(`${name} (asset ${id}): endpoint HTTP ${response.status}`)
      if (!response.ok) process.exitCode = 1
      if (response.ok) {
        const data = await response.json()
        console.log(`${name}: ${data.type === (id === 1 ? 'TERRAIN' : '3DTILES') ? 'expected asset type' : 'unexpected asset type'}; streaming URL ${data.url ? 'provided' : 'missing'}`)
      } else if (response.status === 401) console.log(`${name}: authentication rejected; check token validity and allowed origins`)
      else if (response.status === 403) console.log(`${name}: access forbidden; check assets:read scope, allowed asset IDs, account entitlement and origin restrictions`)
      else if (response.status === 404) console.log(`${name}: asset unavailable to this token/account`)
    } catch (error) {
      const code = error?.cause?.code
      const safe = ['ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'ENETUNREACH', 'ECONNREFUSED', 'UND_ERR_CONNECT_TIMEOUT'].includes(code) ? code : error?.name === 'TimeoutError' ? '15-second timeout' : 'network/TLS connection failed'
      console.log(`${name} (asset ${id}): ${safe}; permissions could not be verified`)
      process.exitCode = 1
    }
  }
}
