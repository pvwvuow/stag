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
  openExternal: (url: string) => void;
  clearDnsCache: () => Promise<{ ok: boolean }>;
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
