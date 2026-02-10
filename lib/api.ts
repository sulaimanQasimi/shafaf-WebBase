/**
 * Unified invoke: uses Tauri when running in Tauri, otherwise calls Next.js API.
 */
export async function invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (typeof window !== "undefined" && (window as unknown as { __TAURI__?: unknown }).__TAURI__) {
    const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
    return tauriInvoke<T>(cmd, args ?? {});
  }
  const res = await fetch("/api/invoke", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cmd, ...(args ?? {}) }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json() as Promise<T>;
}
