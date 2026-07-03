import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Mock Mode activates whenever Supabase credentials are missing from the
 * environment. The app must stay fully runnable in this state — see
 * src/lib/mock for the data used to simulate auth/company/documents.
 */
export const isMockMode = !supabaseUrl || !supabaseAnonKey

export const supabase: SupabaseClient<Database> | null = isMockMode
  ? null
  : createClient<Database>(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })

/**
 * Throws when called in Mock Mode. Use at the top of any code path that
 * requires a real Supabase connection (e.g. calling an Edge Function),
 * so failures are explicit instead of a silent `null` crash later.
 */
export function requireSupabase(): SupabaseClient<Database> {
  if (!supabase) {
    throw new Error(
      'Supabase is not connected (Mock Mode). Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local to enable this action.',
    )
  }
  return supabase
}
