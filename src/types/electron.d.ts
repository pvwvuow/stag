/** Minimal typing for the API surface exposed by electron/preload.cjs */

export interface UpdateState {
  status: "idle" | "checking" | "available" | "downloading" | "ready" | "error" | "unsupported";
  version: string | null;
  releaseNotes: string | null;
  percent: number;
  transferred: number;
  total: number;
  bps: number;
  error: string | null;
  /** beta.4 — true when the installer arrived via differential (blockmap) download */
  delta?: boolean;
}

export interface ElectronApi {
  isDesktop: true;
  platform: string;
  minimize: () => void;
  maximizeToggle: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  onMaximizedChange: (callback: (maximized: boolean) => void) => () => void;
  getVersion: () => Promise<string>;
  getApiToken: () => Promise<string>;
  openExternal: (url: string) => void;
  clearDnsCache: () => Promise<{ ok: boolean }>;
  setPrefs: (prefs: {
    tray?: boolean;
    closeToTray?: boolean;
    autostart?: boolean;
  }) => Promise<{ ok: boolean; autostartActive?: boolean | null; error?: string }>;
  getLogs: () => Promise<{ ok: boolean; logs?: string; error?: string }>;
  retryServer: () => Promise<{ ok: boolean; error?: string }>;
  /** beta.4 — Windows elevation state + one-click UAC relaunch */
  getElevation?: () => Promise<{ elevated: boolean; platform: string }>;
  relaunchElevated?: () => Promise<{ ok: boolean; error?: string }>;
  updater: {
    getState: () => Promise<UpdateState>;
    check: () => Promise<UpdateState>;
    download: () => Promise<UpdateState>;
    install: () => void;
    onEvent: (callback: (state: UpdateState) => void) => () => void;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronApi;
  }
}

export {};
