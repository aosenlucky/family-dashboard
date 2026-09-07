import { hasSupabaseConfig, pingSupabase } from './_data-store.js'

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  res.setHeader('Cache-Control', 'no-store, max-age=0')

  if (!hasSupabaseConfig()) {
    return res.status(503).json({
      success: false,
      error: 'Supabase is not configured.'
    })
  }

  const startedAt = Date.now()
  try {
    const result = await pingSupabase()
    const checkedAt = new Date().toISOString()
    const durationMs = Date.now() - startedAt
    console.info('[supabase-keepalive]', JSON.stringify({ success: true, checkedAt, durationMs, ...result }))
    return res.status(200).json({ success: true, checkedAt, durationMs, ...result })
  } catch (error) {
    const checkedAt = new Date().toISOString()
    const durationMs = Date.now() - startedAt
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[supabase-keepalive]', JSON.stringify({ success: false, checkedAt, durationMs, detail }))
    return res.status(500).json({
      success: false,
      error: 'Supabase keepalive failed.',
      detail,
      checkedAt,
      durationMs
    })
  }
}
