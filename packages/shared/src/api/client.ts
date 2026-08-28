// Pluckk API client — the only way clients talk to data after the 2026-08 move
// off Supabase. Framework-agnostic: the caller supplies how to read the bearer
// token (localStorage in the webapp, chrome.storage in the extension).

import { BACKEND_URL } from '../constants/api';

export interface AuthUser {
  id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface FolderRow {
  id: string; user_id: string; name: string; color: string | null; sort_order: number | null;
  created_at: string; updated_at: string;
}

export interface CardRow {
  id: string; user_id: string | null; question: string; answer: string;
  source_url: string | null; image_url: string | null; folder_id: string | null;
  style: string | null; answer_type: string | null; tags: string[] | null;
  is_public: boolean; created_at: string;
  source_selection: string | null; source_context: string | null; source_title: string | null;
  source_selector: string | null; source_text_offset: number | null;
  numeric_answer: number | null; numeric_lower: number | null; numeric_upper: number | null;
  numeric_unit: string | null; numeric_precision: number | null;
  folder?: FolderRow | null;
  due_at?: string | null;
}

export interface ReviewStateRow {
  id: string; card_id: string; user_id: string; status: string; due_at: string;
  interval_days: number; ease_factor: number; review_count: number; lapse_count: number; streak: number;
  last_reviewed_at: string | null; created_at: string; updated_at: string;
}

export interface ReviewQueue { cards: CardRow[]; states: ReviewStateRow[]; new_reviewed_today: string[] }
export interface ActivityData {
  reviews: Array<{ review_date: string; total_reviews: number }>;
  cards: Array<{ created_date: string; cards_created: number }>;
}

export interface NewCardInput {
  question: string; answer: string; source_url?: string | null; style?: string | null; tags?: string[] | null;
  folder_id?: string | null; image_url?: string | null;
  source_selection?: string; source_context?: string; source_title?: string;
  source_selector?: string; source_text_offset?: number;
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) { super(message); }
}

export interface ApiClientOptions {
  baseUrl?: string;
  getToken: () => Promise<string | null> | string | null;
  onUnauthorized?: () => void;
}

export function createApiClient(opts: ApiClientOptions) {
  const base = (opts.baseUrl ?? BACKEND_URL).replace(/\/$/, '');

  async function request<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth) {
      const token = await opts.getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    if (res.status === 401 && auth) opts.onUnauthorized?.();
    const text = await res.text();
    let data: unknown = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      const msg = (data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string')
        ? (data as { error: string }).error : `HTTP ${res.status}`;
      throw new ApiError(res.status, msg, data);
    }
    return data as T;
  }

  const q = (params: Record<string, string | undefined>) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined) s.set(k, v);
    const str = s.toString();
    return str ? `?${str}` : '';
  };

  return {
    request,
    auth: {
      /** Exchange a Google ID token for a Pluckk bearer token. */
      google: (credential: string, client: string) =>
        request<{ token: string; user: AuthUser }>('POST', '/api/v1/auth/google', { credential, client }, false),
      logout: () => request<{ success: true }>('DELETE', '/api/v1/auth/token'),
    },
    user: {
      me: () => request<UserMeResponse>('GET', '/api/user/me'),
      update: (updates: Record<string, unknown>) => request<{ success: true }>('PATCH', '/api/user/me', updates),
    },
    cards: {
      list: (params: { source_url_prefix?: string } = {}) => request<CardRow[]>('GET', `/api/v1/cards${q(params)}`),
      get: (id: string) => request<CardRow>('GET', `/api/v1/cards/${id}`),
      create: (card: NewCardInput) => request<CardRow>('POST', '/api/v1/cards', card),
      update: (id: string, updates: Partial<NewCardInput> & { is_public?: boolean }) => request<CardRow>('PATCH', `/api/v1/cards/${id}`, updates),
      remove: (id: string) => request<{ success: true }>('DELETE', `/api/v1/cards/${id}`),
    },
    folders: {
      list: () => request<FolderRow[]>('GET', '/api/v1/folders'),
      create: (name: string) => request<FolderRow>('POST', '/api/v1/folders', { name }),
      update: (id: string, updates: { name?: string; color?: string; sort_order?: number }) => request<FolderRow>('PATCH', `/api/v1/folders/${id}`, updates),
      remove: (id: string) => request<{ success: true }>('DELETE', `/api/v1/folders/${id}`),
    },
    review: {
      queue: () => request<ReviewQueue>('GET', '/api/v1/review/queue'),
      submit: (payload: { card_id: string; rating: string; new_state: { status: string; due_at: string; interval_days: number; ease_factor: number }; algorithm_version?: string; response_time_ms?: number }) =>
        request<{ state: ReviewStateRow }>('POST', '/api/v1/review', payload),
    },
    activity: { get: () => request<ActivityData>('GET', '/api/v1/activity') },
    feedback: { submit: (feedback_text: string) => request<{ success: true }>('POST', '/api/v1/feedback', { feedback_text }) },
    images: {
      upload: (card_id: string, image_data: string, mime_type: string) =>
        request<{ image_url: string }>('POST', '/api/v1/images', { card_id, image_data, mime_type }),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

export interface UserMeResponse {
  user: { id: string; email: string | null; username: string | null; displayName: string | null; bio: string | null; avatarUrl: string | null; profileIsPublic: boolean; createdAt: string };
  subscription: { status: string; isPro: boolean };
  usage: { cardsThisMonth: number; limit?: number; remaining: number | 'unlimited' };
  settings: { mochiApiKey: string | null; mochiDeckId: string | null };
  learningProfile: Record<string, unknown> & { onboardingCompleted: boolean };
}
