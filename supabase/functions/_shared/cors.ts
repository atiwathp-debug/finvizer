// Shared CORS headers for Edge Functions invoked directly from the browser
// (supabase-js's `functions.invoke` sends a preflight OPTIONS request).
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
