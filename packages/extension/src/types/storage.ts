/**
 * Chrome Storage Types
 * Defines types for data stored in chrome.storage.sync and chrome.storage.local
 */

// Sync storage - settings that sync across devices
export interface SyncStorageData {
  mochiApiKey?: string | null;
  mochiDeckId?: string | null;
  mochiDecks?: MochiDeck[];
  systemPrompt?: string | null;
  keepOpenAfterStoring?: boolean;
  showPageAnnotations?: boolean;
}

export interface MochiDeck {
  id: string;
  name: string;
}

// Local storage - device-specific data
export interface LocalStorageData {
  pluckk_session?: PluckkSession | null;
}

// Session stored after OAuth
export interface PluckkSession {
  /** Pluckk bearer token (opaque, issued by /api/v1/auth/google). */
  access_token: string;
  user: SessionUser;
  /** @deprecated Supabase-era fields; no longer set. */
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
}

export interface SessionUser {
  id: string;
  email: string;
  user_metadata?: Record<string, unknown>;
}

// User profile from backend API
export interface UserProfile {
  settings?: {
    mochiApiKey: string | null;
    mochiDeckId: string | null;
  };
}

// Type-safe storage getters
export type SyncStorageKey = keyof SyncStorageData;
export type LocalStorageKey = keyof LocalStorageData;

/**
 * Get data from sync storage with type safety
 */
export async function getSyncStorage<K extends SyncStorageKey>(
  keys: K[]
): Promise<Pick<SyncStorageData, K>> {
  return chrome.storage.sync.get(keys) as Promise<Pick<SyncStorageData, K>>;
}

/**
 * Set data in sync storage with type safety
 */
export async function setSyncStorage(data: Partial<SyncStorageData>): Promise<void> {
  return chrome.storage.sync.set(data);
}

/**
 * Get data from local storage with type safety
 */
export async function getLocalStorage<K extends LocalStorageKey>(
  keys: K[]
): Promise<Pick<LocalStorageData, K>> {
  return chrome.storage.local.get(keys) as Promise<Pick<LocalStorageData, K>>;
}

/**
 * Set data in local storage with type safety
 */
export async function setLocalStorage(data: Partial<LocalStorageData>): Promise<void> {
  return chrome.storage.local.set(data);
}
