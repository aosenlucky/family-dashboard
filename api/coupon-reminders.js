import { requireFamily } from './_family-security.js'
import { hasPreviewStore } from '../server/preview-store.js'
import { reminderOverview, runCouponReminders } from './_coupon-reminders.js'
import { validDate } from './_coupon-reminder-model.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store')
  try {
    requireFamily(req)
    if (req.method === 'GET') return res.status(200).json(await reminderOverview())
    if (req.method === 'POST') {
      if (!hasPreviewStore()) return res.status(403).json({ error: '此接口仅允许本机预览模拟，正式提醒由服务器定时检查。' })
      if (req.body?.action !== 'simulate' || !validDate(req.body?.date)) return res.status(400).json({ error: '请选择有效的模拟日期。' })
      const now = new Date(`${req.body.date}T09:00:00+08:00`)
      const result = await runCouponReminders({ now, simulate: true })
      return res.status(200).json({ ...await reminderOverview(), result })
    }
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method Not Allowed' })
  } catch (error) { return res.status(error.status || 500).json({ error: error.status ? error.message : '提醒状态暂不可用，请稍后重试。' }) }
}
