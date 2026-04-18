const API_BASE = "/api";

const TOKEN_KEY = "operator_token";

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(fn: () => void): void {
  unauthorizedHandler = fn;
}

interface ApiResponse {
  status: string;
  data?: any;
  error?: string;
}

async function request(path: string, options?: RequestInit): Promise<ApiResponse> {
  try {
    const token = getToken();
    const headers = new Headers(options?.headers);
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (res.status === 401) {
      clearToken();
      if (unauthorizedHandler) {
        unauthorizedHandler();
      }
      return { status: "error", error: "Unauthorized" };
    }

    if (!res.ok) {
      let errorMessage = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        errorMessage = body.error || body.message || errorMessage;
      } catch {
      }
      return { status: "error", error: errorMessage };
    }

    const body = await res.json();
    return body;
  } catch (err) {
    return {
      status: "error",
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

export function listRepositories() {
  return request("/repositories");
}

export function getRepository(id: string) {
  return request(`/repositories/${id}`);
}

export function createRepository(body: { name: string; url: string }) {
  return request("/repositories", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateRepository(id: string, body: { name?: string; url?: string }) {
  return request(`/repositories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteRepository(id: string) {
  return request(`/repositories/${id}`, {
    method: "DELETE",
  });
}

export function scanRepository(id: string) {
  return request(`/repositories/${id}/scan`, {
    method: "POST",
  });
}

export function scanAllRepositories() {
  return request("/repositories/scan", {
    method: "POST",
  });
}

export function getGraph() {
  return request("/repositories/graph");
}

export function listRuns(limit: number = 20) {
  return request(`/runs?limit=${limit}`);
}
