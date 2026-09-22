import { hasSupabaseConfig, pingSupabase } from '../api/_data-store.js'

if (process.env.VERCEL !== '1') {
  console.info('[supabase-build-keepalive] Skipped outside Vercel.')
  process.exit(0)
}

if (!hasSupabaseConfig()) {
  throw new Error('[supabase-build-keepalive] Missing SUPABASE_URL and server-side Supabase key.')
}

const startedAt = Date.now()
const result = await pingSupabase()
console.info('[supabase-build-keepalive]', JSON.stringify({
  success: true,
  checkedAt: new Date().toISOString(),
  durationMs: Date.now() - startedAt,
  ...result
}))
