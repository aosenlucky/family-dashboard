import { createHash, randomUUID } from 'node:crypto'
import { readMainSnapshot } from './_data-store.js'
import { hasPreviewStore } from '../server/preview-store.js'
import { reminderTransaction } from './_coupon-reminder-store.js'
import { reminderCandidates, reminderMilestone, canSendAt, localDay, REMINDER_STATUSES } from './_coupon-reminder-model.js'
import { reminderRecipients, publicRecipients, notificationText, sendReminder, queryReminder } from './_coupon-reminder-push.js'

const terminal = new Set(['accepted', 'sent', 'unknown', 'simulated'])
const hash = value => createHash('sha256').update(value).digest('hex')
const publicEvent = e => ({ couponId: e.couponId, recipient: e.recipient, status: e.status, label: REMINDER_STATUSES[e.status] || e.status, updatedAt: e.updatedAt, reason: e.status === 'failed' && e.attempts >= 3 ? '已尝试 3 次仍失败，请检查接收渠道。' : e.reason || '', attempts: e.attempts || 0, nextAttemptAt: e.status === 'failed' && e.attempts < 3 ? e.nextAttemptAt : null, deadline: e.deadline, kind: e.kind, milestone: e.milestone })
export async function reminderOverview({ store = reminderTransaction, recipients = reminderRecipients(process.env, hasPreviewStore()) } = {}) {
  return store(state => ({ configured: recipients.length > 0, recipients: publicRecipients(recipients), lastRun: state.lastRun,
    statuses: Object.values(state.events).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 200).map(publicEvent),
    preview: hasPreviewStore(), signingConfigured: hasPreviewStore() || !!process.env.COUPON_CRON_SECRET,
    // A configured secret is not evidence that cron was installed or actually ran.
    schedulerConfigured: hasPreviewStore() || !!(process.env.COUPON_CRON_SECRET && state.lastRun?.checkedAt && !state.lastRun.simulated),
    schedulerHealthy: !!(state.lastRun?.checkedAt && Date.now() - Date.parse(state.lastRun.checkedAt) >= 0 && Date.now() - Date.parse(state.lastRun.checkedAt) < 26 * 3600000),
    note: hasPreviewStore() ? '预览模拟不会发送真实消息。' : !recipients.length ? '尚未配置微信接收渠道，站内仍会显示临期状态。' : '平台接收或发送成功不代表收件人已读。'
  }), { write: false })
}
async function finishBatch(store, batchId, result, now, allowed = ['claimed', 'accepted']) {
  return store(state => {
    const batch = state.batches[batchId]
    if (!batch || !allowed.includes(batch.status)) return false
    Object.assign(batch, result, { updatedAt: now.toISOString() })
    for (const key of batch.eventKeys) {
      const event = state.events[key]
      if (event?.batchId !== batchId || !allowed.includes(event.status)) continue
      Object.assign(event, result, { updatedAt: now.toISOString(), nextAttemptAt: result.status === 'failed' ? new Date(now.getTime() + 3600000).toISOString() : null })
    }
    return true
  })
}

export async function runCouponReminders({ now = new Date(), simulate = false, nonce, store = reminderTransaction, read = readMainSnapshot, send = sendReminder, query = queryReminder, recipients = reminderRecipients(process.env, hasPreviewStore()) } = {}) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw Object.assign(new Error('无效的提醒检查时间。'), { status: 400 })
  const timestamp = now.toISOString(), day = localDay(now)
  // Persist nonce and expire abandoned sends before doing any external work.
  await store(state => {
    for (const [key, expiry] of Object.entries(state.nonces)) if (expiry < now.getTime()) delete state.nonces[key]
    if (nonce) {
      if (state.nonces[nonce]) throw Object.assign(new Error('定时请求已经处理。'), { status: 409 })
      state.nonces[nonce] = now.getTime() + 10 * 60000
    }
    for (const batch of Object.values(state.batches)) if (batch.status === 'claimed' && batch.leaseUntil < timestamp) {
      batch.status = 'unknown'; batch.reason = '上次发送未完成确认，请核对后再安排提醒。'; batch.updatedAt = timestamp
      for (const key of batch.eventKeys) if (state.events[key]?.batchId === batch.id) Object.assign(state.events[key], { status: 'unknown', reason: batch.reason, updatedAt: timestamp })
    }
    // Upgrade existing event history before discarding any batch that still
    // holds its only destination identity. Never retain plaintext push tokens.
    for (const event of Object.values(state.events)) if (!event.destination && state.batches[event.batchId]?.destination) {
      event.destination = state.batches[event.batchId].destination
    }
    // Old run attempts are disposable; the event ledger is deliberately retained.
    for (const [id, batch] of Object.entries(state.batches)) if (batch.createdAt < new Date(now.getTime() - 90 * 86400000).toISOString() && !['claimed', 'accepted'].includes(batch.status)) delete state.batches[id]
  })

  if (!simulate) {
    const accepted = await store(state => Object.values(state.batches).filter(b => b.status === 'accepted' && b.provider === 'pushplus').slice(-10), { write: false })
    for (const batch of accepted) {
      const recipient = recipients.find(r => r.id === batch.recipient)
      if (!recipient) continue
      const result = await query(recipient, batch)
      if (result) await finishBatch(store, batch.id, result, now, ['accepted'])
    }
  }
  const snapshot = await read(), coupons = snapshot.record?.coupons || [], settings = snapshot.record?.notificationSettings || {}
  const eligible = reminderCandidates(coupons, now, recipients.map(r => r.id))
  const reason = !recipients.length ? 'unconfigured' : !canSendAt(now, settings) ? 'quiet-hours' : ''
  if (reason) {
    const result = { checkedAt: timestamp, status: reason, eligible: eligible.length, batches: 0, simulated: simulate }
    await store(state => { state.lastRun = result })
    return result
  }
  const destination = r => hash(r.token || `preview:${r.id}`)
  const groups = new Map()
  for (const r of recipients) { const key = destination(r); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(r) }
  const claims = await store(state => {
    const currentKeys = new Set(eligible.map(e => e.key)), batches = []
    for (const event of Object.values(state.events)) if (['failed', 'cancelled'].includes(event.status) && !currentKeys.has(event.key)) {
      event.status = 'cancelled'; event.reason = '日期、接收人或券状态已变更。'; event.updatedAt = timestamp
    }
    let attemptsToday = Object.values(state.batches).filter(b => b.day === day).length
    for (const [dest, members] of groups) {
      if (attemptsToday >= 20) break
      const prior = Object.values(state.batches).filter(b => b.day === day && b.destination === dest)
      // One successful/uncertain digest per destination per day; definite failures may retry.
      if (prior.some(b => terminal.has(b.status) || b.status === 'claimed')) continue
      const memberIds = members.map(r => r.id)
      const events = eligible.filter(e => memberIds.includes(e.recipient)).filter(e => {
        // A sent milestone belongs to the coupon, not a particular edition of
        // its date or reminder switch. Legacy month events count as 30 days.
        // Store a destination on each event so pruning old batches never loses
        // deduplication for two members who share one notification channel.
        const alreadySubmitted = Object.values(state.events).some(old => {
          if (old.couponId !== e.couponId || reminderMilestone(old.milestone) !== reminderMilestone(e.milestone)
            || (!terminal.has(old.status) && old.status !== 'claimed')) return false
          const oldDestination = old.destination || state.batches[old.batchId]?.destination
          return old.recipient === e.recipient || oldDestination === dest || (!oldDestination && memberIds.includes(old.recipient))
        })
        if (alreadySubmitted) return false
        const old = state.events[e.key]
        if (!old) return true
        return ['failed', 'cancelled'].includes(old.status) && (old.attempts || 0) < 3 && (!old.nextAttemptAt || old.nextAttemptAt <= timestamp)
      }).slice(0, 100)
      if (!events.length) continue
      const batch = { id: randomUUID(), recipient: members[0].id, destination: dest, day, status: 'claimed', createdAt: timestamp, updatedAt: timestamp, leaseUntil: new Date(now.getTime() + 5 * 60000).toISOString(), eventKeys: events.map(e => e.key) }
      state.batches[batch.id] = batch
      for (const event of events) state.events[event.key] = { ...event, destination: dest, status: 'claimed', batchId: batch.id, attempts: (state.events[event.key]?.attempts || 0) + 1, updatedAt: timestamp }
      batches.push({ ...batch, events }); attemptsToday++
    }
    return batches
  })
  let sentBatches = 0
  for (const batch of claims) {
    // A coupon may have been used or its deadline edited while a batch was being claimed.
    const latest = await read(), freshCoupons = latest.record?.coupons || []
    const freshKeys = new Set(reminderCandidates(freshCoupons, now, recipients.map(r => r.id)).map(e => e.key))
    const valid = batch.events.filter(e => freshKeys.has(e.key))
    const invalid = batch.events.filter(e => !freshKeys.has(e.key))
    if (invalid.length) await store(state => { for (const e of invalid) if (state.events[e.key]?.batchId === batch.id) Object.assign(state.events[e.key], { status: 'cancelled', reason: '发送前发现券已更新或不再需要提醒。', updatedAt: timestamp }) })
    if (!valid.length) { await finishBatch(store, batch.id, { status: 'cancelled', reason: '券已更新或不再需要提醒。' }, now); continue }
    const recipient = recipients.find(r => r.id === batch.recipient)
    const unique = [...new Map(valid.map(e => [e.couponId, e])).values()]
    const message = notificationText(unique, freshCoupons)
    const result = simulate ? { status: 'simulated', provider: 'preview', reason: '仅模拟提醒，没有发送微信消息。' } : await send(recipient, message)
    await finishBatch(store, batch.id, result, now)
    sentBatches++
  }
  const result = { checkedAt: timestamp, status: 'complete', eligible: eligible.length, batches: sentBatches, simulated: simulate }
  await store(state => { state.lastRun = result })
  return result
}
