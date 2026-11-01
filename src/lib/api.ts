/**
 * The one way the app talks to the backend.
 *
 * - Always calls relative `/api/v1/...` URLs (proxied to FastAPI by next.config.ts).
 * - Keeps the short-lived access token in memory only.
 * - On an expired token, refreshes once using the HttpOnly cookie and retries.
 * - Turns every error into an `ApiError` with the backend's code and message.
 */

const BASE = "/api/v1";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

let accessToken: string | null = null;
let refreshing: Promise<string | null> | null = null;
const listeners = new Set<(token: string | null) => void>();

export function setAccessToken(token: string | null) {
  accessToken = token;
  listeners.forEach((l) => l(token));
}
export function onTokenChange(fn: (token: string | null) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function hasToken() {
  return accessToken !== null;
}

async function parse(res: Response) {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { error: { code: "bad_response", message: "The server sent an unexpected reply." } };
  }
}

/** Ask the backend for a new access token using the refresh cookie. Shared between callers. */
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    refreshing = fetch(`${BASE}/auth/refresh`, { method: "POST", credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return null;
        const body = await res.json();
        return body.access_token as string;
      })
      .catch(() => null)
      .then((token) => {
        setAccessToken(token);
        refreshing = null;
        return token;
      });
  }
  return refreshing;
}

type Options = Omit<RequestInit, "body"> & { body?: unknown; retry?: boolean };

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const { body, retry = true, headers, ...rest } = opts;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const init: RequestInit = {
    ...rest,
    credentials: "include",
    headers: {
      ...(body !== undefined && !isForm ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
  };
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, init);
  } catch {
    throw new ApiError(0, "network", "Cannot reach Oko. Check your connection and try again.");
  }
  if (res.status === 401 && retry && !path.startsWith("/auth/")) {
    const token = await refreshAccessToken();
    if (token) return api<T>(path, { ...opts, retry: false });
  }
  const data = await parse(res);
  if (!res.ok) {
    const err = data?.error ?? {};
    if (res.status >= 500 && !err.message) {
      throw new ApiError(res.status, "server", "Oko is waking up or busy. Try again in a minute.");
    }
    throw new ApiError(res.status, err.code ?? "error", err.message ?? "Something went wrong.", err.details ?? {});
  }
  return data as T;
}

export const get = <T>(path: string) => api<T>(path);
export const post = <T>(path: string, body?: unknown) => api<T>(path, { method: "POST", body: body ?? {} });
export const patch = <T>(path: string, body: unknown) => api<T>(path, { method: "PATCH", body });
export const put = <T>(path: string, body: unknown) => api<T>(path, { method: "PUT", body });
export const del = <T>(path: string) => api<T>(path, { method: "DELETE" });
export const upload = <T>(path: string, form: FormData) => api<T>(path, { method: "POST", body: form });

/** Fetch a protected file (e.g. a proof photo) and return an object URL for <img>. */
export async function blobUrl(path: string): Promise<string> {
  const go = () => fetch(`${BASE}${path}`, { credentials: "include", headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} });
  let res = await go();
  if (res.status === 401 && (await refreshAccessToken())) res = await go();
  if (!res.ok) throw new ApiError(res.status, "error", "Could not load the photo.");
  return URL.createObjectURL(await res.blob());
}
