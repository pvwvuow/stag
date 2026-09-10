"use client";

/**
 * فاز ۸ — desktop prefs (system tray / close-to-tray / auto-start) that live
 * in the renderer's localStorage and are mirrored into the Electron main
 * process over IPC. Browser mode silently no-ops.
 */

export interface StagPrefs {
  tray: boolean;
  closeToTray: boolean;
  autostart: boolean;
}

const KEY = "stag.prefs.v1";

export const DEFAULT_PREFS: StagPrefs = {
  tray: false,
  closeToTray: false,
  autostart: false,
};

export function loadPrefs(): StagPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<StagPrefs>) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs: StagPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* noop */
  }
  pushPrefs(prefs);
}

/** Push prefs to the main process without persisting (boot sync). */
export function pushPrefs(prefs: StagPrefs): void {
  try {
    void window.electronAPI?.setPrefs?.(prefs);
  } catch {
    /* browser mode / older bridge */
  }
}
