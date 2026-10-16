export type ApiFailure = Error & { code?: string; details?: unknown };

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, { ...init, credentials: "include", headers: { "Content-Type": "application/json", ...(init.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) { const error = new Error(payload.error?.message || "Something went wrong.") as ApiFailure; error.code = payload.error?.code; error.details = payload.error?.details; throw error; }
  return payload as T;
}
