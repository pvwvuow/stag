/** Minimal typing for the API surface exposed by electron/preload.cjs */
export interface ElectronApi {
  isDesktop: true;
  platform: string;
  minimize: () => void;
  maximizeToggle: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  onMaximizedChange: (callback: (maximized: boolean) => void) => () => void;
  getVersion: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI?: ElectronApi;
  }
}

export {};
