import type { BadCase, BadCaseStatus, BadCaseType, ChatResponse, Knowledge, LoginResponse, MetricCard, Role, SessionLog } from './types';

const API_BASE = import.meta.env.VITE_API_BASE || '/_backend';
const NORMALIZED_API_BASE = API_BASE.replace(/\/$/, '');

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${NORMALIZED_API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || `请求失败：${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function login(payload: { username: string; password: string; role?: Role }) {
  return request<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function sendChat(payload: { question: string; user_id?: string; role?: Role }) {
  return request<ChatResponse>('/api/chat', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getKnowledge() {
  return request<Knowledge[]>('/api/knowledge');
}

export function createKnowledge(payload: Omit<Knowledge, 'id' | 'updated_at'>) {
  return request<Knowledge>('/api/knowledge', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateKnowledge(id: string, payload: Omit<Knowledge, 'id' | 'updated_at'>) {
  return request<Knowledge>(`/api/knowledge/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export function getSessions() {
  return request<SessionLog[]>('/api/sessions');
}

export function transferSession(id: string) {
  return request<SessionLog>(`/api/sessions/${id}/transfer`, { method: 'POST' });
}

export function getBadCases() {
  return request<BadCase[]>('/api/badcases');
}

export function createBadCase(payload: {
  session_id?: string | null;
  question: string;
  answer?: string | null;
  type?: BadCaseType;
  status?: BadCaseStatus;
  suggestion?: string;
}) {
  return request<BadCase>('/api/badcases', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateBadCase(id: string, payload: {
  session_id?: string | null;
  question: string;
  answer?: string | null;
  type: BadCaseType;
  status: BadCaseStatus;
  suggestion: string;
}) {
  return request<BadCase>(`/api/badcases/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export function getMetrics() {
  return request<{ cards: MetricCard[] }>('/api/metrics');
}
