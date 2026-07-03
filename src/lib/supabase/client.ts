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

// Safe boot-time diagnostic: logs which mode is active and, in real mode,
// the configured project host — never the anon key itself. This is the
// fastest way to tell "wrong/typo'd VITE_SUPABASE_URL baked into this
// build" apart from "genuinely offline" or "Mock Mode", both of which can
// otherwise look identical from the login screen's error message alone.
if (typeof window !== 'undefined') {
  if (isMockMode) {
    console.info('[FinVizer] Mock Mode active — no VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY at build time.')
  } else {
    try {
      console.info('[FinVizer] Supabase mode active — project host:', new URL(supabaseUrl as string).host)
    } catch {
      console.error('[FinVizer] VITE_SUPABASE_URL is set but is not a valid URL:', supabaseUrl)
    }
  }
}

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
