// Supabase barrel export

export { createSupabaseClient } from './client.js';
export {
  getSupabaseClient,
  signInWithGoogle,
  signOut,
  getSession,
  getUser,
  onAuthStateChange,
  getAccessToken
} from './auth.js';
