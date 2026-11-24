import { hasPreviewStore, previewTransaction } from '../server/preview-store.js'

export function blankReminderState() { return { events: {}, batches: {}, nonces: {}, lastRun: null } }
function normalize(state) { return { ...blankReminderState(), ...(state || {}) } }
async function request(path = '', options = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  const base = process.env.SUPABASE_URL
  if (!base || !key) throw Object.assign(new Error('到期提醒存储尚未配置。'), { status: 503 })
  const url = new URL(base)
  if (url.protocol !== 'https:' || url.username || url.password) throw Object.assign(new Error('到期提醒存储地址无效。'), { status: 503 })
  const response = await fetch(`${url.origin}/rest/v1/family_coupon_reminder_state${path}`, { ...options, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...options.headers }, redirect: 'error', signal: AbortSignal.timeout(15000) })
  if (response.status === 409) return { conflict: true }
  if (!response.ok) throw Object.assign(new Error('到期提醒存储暂不可用，请检查券册数据库升级是否完成。'), { status: 503 })
  return response.status === 204 ? null : response.json()
}
export async function reminderTransaction(operation, { write = true } = {}) {
  if (hasPreviewStore()) return previewTransaction(async state => {
    const data = normalize(state.couponReminders)
    const result = await operation(data)
    if (write) state.couponReminders = data
    return result
  }, { write })
  for (let attempt = 0; attempt < 8; attempt++) {
    const rows = await request('?id=eq.main&select=version,state')
    const row = rows?.[0], state = normalize(row?.state)
    // Operations are pure mutations: network sends happen only after a successful CAS.
    const result = await operation(state)
    if (!write) return result
    const body = JSON.stringify({ id: 'main', version: (row?.version || 0) + 1, state, updated_at: new Date().toISOString() })
    const changed = row
      ? await request(`?id=eq.main&version=eq.${row.version}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body })
      : await request('', { method: 'POST', headers: { Prefer: 'return=representation' }, body })
    if (!changed?.conflict && changed?.length) return result
  }
  throw Object.assign(new Error('提醒任务正在处理中，请稍后重试。'), { status: 409 })
}
