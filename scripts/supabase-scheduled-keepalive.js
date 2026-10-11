import { hasSupabaseConfig, pingSupabase } from '../api/_data-store.js'

if (!hasSupabaseConfig()) {
  throw new Error('[supabase-scheduled-keepalive] Missing SUPABASE_URL and server-side Supabase key.')
}

const startedAt = Date.now()
const result = await pingSupabase()
console.info('[supabase-scheduled-keepalive]', JSON.stringify({
  success: true,
  checkedAt: new Date().toISOString(),
  durationMs: Date.now() - startedAt,
  ...result
}))
