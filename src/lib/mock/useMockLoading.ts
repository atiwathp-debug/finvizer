import { useEffect, useState } from 'react'

/**
 * Simulates the initial fetch delay of a real API call so list/dashboard
 * pages can demonstrate their loading state even though the underlying data
 * is static mock data. Real data fetching (Phase 1A+) replaces this with
 * actual Supabase query loading state.
 */
export function useMockLoading(delayMs = 500): boolean {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), delayMs)
    return () => clearTimeout(timer)
  }, [delayMs])

  return isLoading
}
