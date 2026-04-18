const API_BASE = "/api";

interface ApiResponse {
  status: string;
  data?: any;
  error?: string;
}

async function request(path: string, options?: RequestInit): Promise<ApiResponse> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

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
