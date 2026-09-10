/**
 * Preload — exposes a minimal, safe window-control API to the renderer.
 * No Node APIs, no remote content: contextIsolation stays on.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isDesktop: true,
  platform: process.platform,

  /** Window controls (frameless titlebar) */
  minimize: () => ipcRenderer.send("window:minimize"),
  maximizeToggle: () => ipcRenderer.send("window:maximize-toggle"),
  close: () => ipcRenderer.send("window:close"),
  isMaximized: () => ipcRenderer.invoke("window:is-maximized"),
  onMaximizedChange: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on("window:maximizedChanged", listener);
    return () => ipcRenderer.removeListener("window:maximizedChanged", listener);
  },

  /** App info */
  getVersion: () => ipcRenderer.invoke("app:get-version"),
});
