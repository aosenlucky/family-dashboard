import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const REMINDER_TIME_ZONE = 'Asia/Shanghai'
export const REMINDER_STATUSES = { claimed: '准备发送', accepted: '平台已接收', sent: '平台发送成功', failed: '发送失败', unknown: '发送结果待核对', cancelled: '提醒已取消', simulated: '预览已模拟' }
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value
}
export function localDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: REMINDER_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const get = kind => parts.find(p => p.type === kind)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}
export function monthBefore(date) {
  if (!validDate(date)) return ''
  const [y, m, d] = date.split('-').map(Number), year = m === 1 ? y - 1 : y, month = m === 1 ? 12 : m - 1
  const day = Math.min(d, new Date(Date.UTC(year, month, 0)).getUTCDate())
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
export function daysBefore(date, count) {
  if (!validDate(date)) return ''
  return new Date(Date.parse(`${date}T00:00:00Z`) - count * 86400000).toISOString().slice(0, 10)
}
// The former calendar-month milestone is the same one-time notice as the new
// exact 30-day milestone. Keep this alias when consulting the durable ledger.
export const reminderMilestone = value => value === 'month' ? 'thirty-days' : value
export function activeReminderDeadline(coupon) {
  if (!coupon || !['unused', 'booked'].includes(coupon.status) || coupon.deadlineConfirmed !== true || coupon.reminder?.enabled !== true) return null
  const dates = []
  if (validDate(coupon.expiresOn)) dates.push({ date: coupon.expiresOn, kind: 'expiry', label: '使用截止' })
  if (coupon.status !== 'booked' && validDate(coupon.bookingDeadline)) dates.push({ date: coupon.bookingDeadline, kind: 'booking', label: '预约截止' })
  return dates.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind))[0] || null
}
export function reminderCandidates(coupons, now = new Date(), recipients = ['aosen', 'xiaoyue']) {
  const today = localDay(now), events = []
  for (const coupon of Array.isArray(coupons) ? coupons : []) {
    const deadline = activeReminderDeadline(coupon)
    if (!deadline || !coupon.id || deadline.date < today) continue
    const milestones = []
    if (coupon.reminder?.thirtyDays !== false) milestones.push({ name: 'thirty-days', date: daysBefore(deadline.date, 30) })
    if (coupon.reminder?.sevenDays) milestones.push({ name: 'seven-days', date: daysBefore(deadline.date, 7) })
    const crossed = milestones.filter(m => m.date <= today)
    if (!crossed.length) continue
    // Late imports receive one useful notice, not both overdue milestones at once.
    const milestone = crossed.at(-1)
    const version = createHash('sha256').update(`${deadline.kind}:${deadline.date}`).digest('hex').slice(0, 24)
    const selectedRecipients = coupon.reminder?.recipients === undefined ? ['aosen'] : Array.isArray(coupon.reminder.recipients) ? coupon.reminder.recipients : []
    for (const recipient of [...new Set(selectedRecipients)].filter(id => recipients.includes(id))) {
      const key = createHash('sha256').update(JSON.stringify([String(coupon.id), version, milestone.name, recipient])).digest('hex')
      events.push({ key, couponId: String(coupon.id), deadlineVersion: version, deadline: deadline.date, kind: deadline.kind, milestone: milestone.name, dueOn: milestone.date, recipient })
    }
  }
  return events
}
export function canSendAt(now, settings = {}) {
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: REMINDER_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now)
  if (time < '09:00') return false
  const validTime = v => /^([01]\d|2[0-3]):[0-5]\d$/.test(v || '')
  const start = validTime(settings.quietStart) ? settings.quietStart : '22:00', end = validTime(settings.quietEnd) ? settings.quietEnd : '08:00'
  return !(start !== end && (start < end ? time >= start && time < end : time >= start || time < end))
}
export function cronSignature(secret, timestamp, nonce) {
  return createHmac('sha256', secret).update(`${timestamp}.${nonce}.coupon-reminders-v1`).digest('hex')
}
export function verifyCronRequest(req, now = new Date(), secret = process.env.COUPON_CRON_SECRET) {
  if (!secret || secret.length < 32) throw Object.assign(new Error('定时提醒密钥尚未配置。'), { status: 503 })
  const timestamp = req.headers?.['x-coupon-timestamp'], signature = req.headers?.['x-coupon-signature'], nonce = req.body?.nonce
  if (req.body?.job !== 'coupon-reminders-v1' || typeof timestamp !== 'string' || !/^\d{10}$/.test(timestamp) || typeof nonce !== 'string' || !/^[a-f0-9-]{36}$/.test(nonce) || typeof signature !== 'string' || !/^[a-f0-9]{64}$/.test(signature) || Math.abs(now.getTime() / 1000 - Number(timestamp)) > 300) {
    throw Object.assign(new Error('无效或过期的定时请求。'), { status: 403 })
  }
  const expected = cronSignature(secret, timestamp, nonce)
  if (!timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) throw Object.assign(new Error('定时请求签名不正确。'), { status: 403 })
  return nonce
}
