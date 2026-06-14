const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3333';

const TOKEN_KEY = 'atendemei_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  const res = await fetch(`${API_URL}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (res.status === 401) {
    tokenStore.clear();
    if (location.pathname !== '/login') location.href = '/login';
    throw new ApiError(401, 'Não autorizado');
  }

  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try {
      const body = await res.json();
      msg = Array.isArray(body.message) ? body.message.join(', ') : body.message ?? msg;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, msg);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

// ───────── tipos compartilhados com a API ─────────
export type SituacaoFiscal = 'REGULAR' | 'PENDENTE' | 'IRREGULAR' | 'DESCONHECIDA';
export type UserRole = 'ADMIN' | 'CONTADOR' | 'ATENDENTE';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  tenantId: string;
}

export interface Cliente {
  id: string;
  cnpj: string;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  nomeContato: string | null;
  telefoneWa: string;
  email: string | null;
  situacaoFiscal: SituacaoFiscal;
  ativo: boolean;
  criadoEm: string;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
