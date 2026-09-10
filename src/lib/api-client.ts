"use client";

/**
 * Renderer-side companion of src/lib/guard.ts (فاز ۴.۲).
 * In the packaged app the Electron main process hands us a per-run token via
 * the preload bridge; every /api call must carry it. Cached after first read.
 */
let cachedToken: string | null | undefined;

async function apiToken(): Promise<string | null> {
  if (cachedToken !== undefined) return cachedToken;
  try {
    cachedToken = (await window.electronAPI?.getApiToken?.()) ?? null;
  } catch {
    cachedToken = null;
  }
  return cachedToken;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await apiToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("x-stag-token", token);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(path, { ...init, headers, credentials: "omit" });
}
