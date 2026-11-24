import { hasPreviewStore } from '../server/preview-store.js'
import { verifyCronRequest } from './_coupon-reminder-model.js'
import { runCouponReminders } from './_coupon-reminders.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store')
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method Not Allowed' }) }
  try {
    if (hasPreviewStore()) return res.status(403).json({ error: '本机预览不运行真实提醒任务。' })
    const now = new Date(), nonce = verifyCronRequest(req, now)
    return res.status(200).json(await runCouponReminders({ now, nonce }))
  } catch (error) { return res.status(error.status || 500).json({ error: error.status ? error.message : '提醒任务未完成，请检查服务端状态。' }) }
}
