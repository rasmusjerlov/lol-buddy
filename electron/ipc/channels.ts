/** All IPC channel names, typed to avoid stringly-typed channel strings. */
export const IPC = {
  // Main → Renderer (send)
  LCU_CONNECTED: 'lcu:connected',
  LCU_DISCONNECTED: 'lcu:disconnected',
  LCU_EVENT: 'lcu:event',

  // Renderer → Main (invoke)
  LCU_GET: 'lcu:get',
  LCU_POST: 'lcu:post',
  LCU_PATCH: 'lcu:patch',
  LCU_DELETE: 'lcu:delete'
} as const
