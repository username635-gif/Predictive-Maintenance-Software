import { apiBaseUrl } from '../utils/apiBase';
import { getAuthToken, clearRosSession } from '../auth/rosSession';
import type { UserRole } from '../auth/rosSession';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${apiBaseUrl()}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearRosSession();
    window.dispatchEvent(new CustomEvent('auth-session-expired'));
    throw new ApiError(401, 'Session expired -- please sign in again.');
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // response body wasn't JSON -- keep the generic message
    }
    throw new ApiError(res.status, message);
  }

  return res.json() as Promise<T>;
}

export interface MeResponse {
  user: { id: string; email: string; name: string; role: UserRole | null; organizationId: string };
  status: 'pending' | 'active';
  token?: string;
}

export const api = {
  getAssets: () => request<{ count: number; assets: unknown[] }>('/api/v1/assets'),
  getAlerts: () => request<{ alerts: unknown[] }>('/api/v1/alerts'),
  getActiveAlerts: () => request<{ alerts: unknown[] }>('/api/v1/alerts/active'),
  acknowledgeAlert: (id: string) =>
    request<{ alert: unknown; status: string }>(`/api/v1/alerts/${id}/acknowledge`, { method: 'POST' }),
  getWorkOrders: () => request<{ count: number; work_orders: unknown[] }>('/api/v1/workorders'),
  createWorkOrder: (payload: unknown) =>
    request<{ work_order: unknown; priority_note?: string }>('/api/v1/workorders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateWorkOrder: (id: string, updates: unknown) =>
    request<{ work_order: unknown }>(`/api/v1/workorders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),
  getPredictions: () => request<{ predictions: unknown[]; note?: string }>('/api/v1/predictions'),
  getSensors: () => request<{ count: number; sensors: unknown[] }>('/api/v1/sensors'),
  getSensorHistory: (id: string, hours = 24) => request<{ sensor_id: string; hours: number; count: number; readings: { reading_at: string; value: number; is_flagged_bad: boolean }[] }>(`/api/v1/sensors/${id}/history?hours=${hours}`),
  getPigRuns: () => request<{ pig_runs: unknown[] }>('/api/v1/pig'),
  getGateways: () => request<{ gateways: unknown[] }>('/api/v1/gateways'),
  getGatewayStatus: () => request<{ protocols: unknown[] }>('/api/v1/gateways/status'),
  createGateway: (payload: unknown) =>
    request<{ gateway: unknown }>('/api/v1/gateways', { method: 'POST', body: JSON.stringify(payload) }),
  updateGateway: (id: string, payload: unknown) =>
    request<{ gateway: unknown }>(`/api/v1/gateways/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) }),

  getMe: () => request<MeResponse>('/api/v1/auth/me'),
  invite: (payload: { email: string; name: string; role?: UserRole }) =>
    request<{ user: unknown }>('/api/v1/auth/invites', { method: 'POST', body: JSON.stringify(payload) }),
  signup: (payload: { email: string; password: string }) =>
    request<{ message: string }>('/api/v1/auth/signup', { method: 'POST', body: JSON.stringify(payload) }),
  verify: (payload: { email: string; token: string }) =>
    request<{ status: string }>('/api/v1/auth/verify', { method: 'POST', body: JSON.stringify(payload) }),
  assignRole: (id: string, role: UserRole) =>
    request<{ user: unknown }>(`/api/v1/auth/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
};
