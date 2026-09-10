/**
 * Single source of truth for the app version shown in the UI.
 *
 * In the packaged desktop app, `window.electronAPI.getVersion()` returns the
 * real Electron/`package.json` version and is always preferred. This constant
 * is only the FALLBACK used in the browser / dev where that IPC is absent — it
 * must be kept in sync with `package.json` (the release script updates both).
 */
export const APP_VERSION = "1.4.0-beta.1";
