import type {
  AuthResponse,
  AuthUser,
  ConnectionItem,
  ConnectionStatus,
  ExpertiseWebGraph,
  MatchSuggestion,
  PendingConnectionsResponse,
  Profile,
} from "@/types/api"
import type { ProfileUpdateInput } from "@/types/schemas"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message)
    this.name = "ApiError"
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token, headers, ...rest } = options

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  })

  const data = (await res.json().catch(() => ({}))) as T & { error?: string }

  if (!res.ok) {
    throw new ApiError(
      (data as { error?: string }).error ?? `Erro ${res.status}`,
      res.status
    )
  }

  return data
}

export const api = {
  register: (body: { email: string; password: string; nome: string }) =>
    request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string }) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  logout: (token: string) =>
    request<{ success: boolean }>("/auth/logout", {
      method: "POST",
      token,
    }),

  me: (token: string) =>
    request<{ user: AuthUser }>("/auth/me", { token }),

  getMyProfile: (token: string) =>
    request<{ profile: Profile }>("/profiles/me", { token }),

  updateMyProfile: (token: string, body: ProfileUpdateInput) =>
    request<{ profile: Profile; message?: string }>("/profiles/me", {
      method: "PUT",
      token,
      body: JSON.stringify(body),
    }),

  getProfile: (id: string) =>
    request<{ profile: Profile }>(`/profiles/${id}`),

  getMatchSuggestions: (token: string) =>
    request<{ suggestions: MatchSuggestion[] }>("/matching/suggestions", {
      token,
    }),

  recalculateEmbedding: (token: string) =>
    request<{ message: string }>("/matching/recalculate", {
      method: "POST",
      token,
    }),

  getExpertiseWeb: () => request<ExpertiseWebGraph>("/graph/expertise-web"),

  createConnection: (token: string, targetProfileId: string) =>
    request<{ connection: ConnectionItem }>("/connections", {
      method: "POST",
      token,
      body: JSON.stringify({ targetProfileId }),
    }),

  getConnections: (token: string, status?: ConnectionStatus) =>
    request<{ connections: ConnectionItem[] }>(
      status ? `/connections?status=${status}` : "/connections",
      { token }
    ),

  getPendingConnections: (token: string) =>
    request<PendingConnectionsResponse>("/connections/pending", { token }),

  updateConnection: (
    token: string,
    connectionId: string,
    status: "aceita" | "ignorada"
  ) =>
    request<{ connection: ConnectionItem }>(`/connections/${connectionId}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ status }),
    }),
}
