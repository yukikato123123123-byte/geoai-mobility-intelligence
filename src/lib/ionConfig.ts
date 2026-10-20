// Vite client credentials must never be placed in React state, diagnostics, or reports.
const token = import.meta.env.VITE_CESIUM_ION_TOKEN?.trim() ?? ''
export const ionConfig = {
  token,
  configured: Boolean(token),
  buildingsEnabled: Boolean(token) && import.meta.env.VITE_CESIUM_BUILDINGS !== 'false',
  terrainEnabled: Boolean(token) && import.meta.env.VITE_CESIUM_TERRAIN !== 'false',
}
