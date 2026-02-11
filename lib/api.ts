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
    const msg =
      err && typeof err === "object" && "error" in err
        ? (err as { error?: string }).error
        : err && typeof err === "object" && "message" in err
          ? (err as { message?: string }).message
          : res.statusText;
    throw new Error(String(msg ?? res.statusText));
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error("Invalid JSON in response");
  }
}
