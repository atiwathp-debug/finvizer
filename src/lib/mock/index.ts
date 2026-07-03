/**
 * Mock Mode foundation. Feature-specific mock data (customers, documents,
 * dashboard stats, etc.) is added alongside the features that need it —
 * this file only defines the shared shape used to signal Mock Mode in the UI.
 */
import { isMockMode } from '@/lib/supabase/client'

export { isMockMode }

export const MOCK_MODE_BANNER_TEXT = 'Mock Mode: ยังไม่ได้เชื่อมต่อ Supabase'
