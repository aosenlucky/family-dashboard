import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { monthBefore, daysBefore, localDay, reminderCandidates, canSendAt, cronSignature, verifyCronRequest } from '../api/_coupon-reminder-model.js'
import { blankReminderState, reminderTransaction } from '../api/_coupon-reminder-store.js'
import { runCouponReminders } from '../api/_coupon-reminders.js'
import { sendReminder, queryReminder, notificationText, reminderRecipients } from '../api/_coupon-reminder-push.js'
import reminderHandler from '../api/coupon-reminders.js'
import runHandler from '../api/coupon-reminder-run.js'

const coupon = changes => ({ id: 'one', merchant: '湖边酒店', title: '两晚小旅行', status: 'unused', expiresOn: '2026-12-24', bookingDeadline: '', deadlineConfirmed: true, reminder: { enabled: true, sevenDays: false, recipients: ['aosen'] }, ...changes })
const now = new Date('2026-11-24T09:00:00+08:00')
const recipients = [{ id: 'aosen', label: 'Aosen', token: 'test-destination' }]
function fixture(coupons = [coupon()]) {
  const state = blankReminderState(); let queue = Promise.resolve(); let reads = 0
  const store = (operation, { write = true } = {}) => {
    const task = queue.then(async () => { const draft = structuredClone(state); const result = await operation(draft); if (write) Object.assign(state, draft); return structuredClone(result) })
    queue = task.catch(() => {}); return task
  }
  return { state, store, read: async () => { reads++; return { record: { coupons, notificationSettings: {} } } }, reads: () => reads }
}
const response = (payload, status = 200) => new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } })
function resMock() { return { code: 200, headers: {}, setHeader(k, v) { this.headers[k] = v }, status(v) { this.code = v; return this }, json(v) { this.payload = v; return this } } }

test('natural month reminders clamp month ends and leap dates; local day uses Shanghai', () => {
  assert.equal(monthBefore('2026-03-31'), '2026-02-28')
  assert.equal(monthBefore('2024-03-31'), '2024-02-29')
  assert.equal(monthBefore('2027-01-31'), '2026-12-31')
  assert.equal(monthBefore('2026-02-30'), '')
  assert.equal(localDay(new Date('2026-11-23T20:00:00Z')), '2026-11-24')
})
test('30-day reminders use exactly 30 days, not the former calendar month', () => {
  assert.equal(daysBefore('2026-03-31', 30), '2026-03-01')
  assert.equal(daysBefore('2024-03-31', 30), '2024-03-01')
  const c = coupon({ expiresOn: '2026-03-31' })
  assert.equal(reminderCandidates([c], new Date('2026-02-28T09:00:00+08:00')).length, 0)
  const event = reminderCandidates([c], new Date('2026-03-01T09:00:00+08:00'))[0]
  assert.equal(event.dueOn, '2026-03-01'); assert.equal(event.milestone, 'thirty-days')
})
test('each coupon can disable push or select only the seven-day milestone', () => {
  const reminder = { enabled: true, thirtyDays: false, sevenDays: true, recipients: ['aosen'] }
  assert.equal(reminderCandidates([coupon({ reminder })], now).length, 0)
  const atSeven = new Date('2026-12-17T09:00:00+08:00')
  assert.equal(reminderCandidates([coupon({ reminder })], atSeven)[0].milestone, 'seven-days')
  assert.equal(reminderCandidates([coupon({ reminder: { ...reminder, enabled: false } })], atSeven).length, 0)
  assert.equal(reminderCandidates([coupon({ reminder: { ...reminder, sevenDays: false } })], atSeven).length, 0)
})
test('unknown dates, wish, used, refunds and expired coupons cannot produce reminders', () => {
  for (const value of [coupon({ expiresOn: '' }), coupon({ deadlineConfirmed: false }), coupon({ status: 'wish' }), coupon({ status: 'used' }), coupon({ status: 'refunded' }), coupon({ expiresOn: '2026-11-23' })]) assert.equal(reminderCandidates([value], now).length, 0)
  assert.equal(reminderCandidates([coupon()], now).length, 1)
})
test('late import emits nearest milestone once; booked coupons move to usage deadline', () => {
  const late = coupon({ expiresOn: '2026-11-27', reminder: { enabled: true, sevenDays: true, recipients: ['aosen', 'aosen', 'stranger'] } })
  const events = reminderCandidates([late], now)
  assert.equal(events.length, 1); assert.equal(events[0].milestone, 'seven-days')
  const mixed = coupon({ bookingDeadline: '2026-12-01', expiresOn: '2027-03-01' })
  assert.equal(reminderCandidates([mixed], now)[0].kind, 'booking')
  assert.equal(reminderCandidates([{ ...mixed, status: 'booked' }], now).length, 0)
})
test('quiet hours are honored and no normal batches are sent before 09:00', () => {
  assert.equal(canSendAt(new Date('2026-11-24T08:59:00+08:00')), false)
  assert.equal(canSendAt(now), true)
  assert.equal(canSendAt(new Date('2026-11-24T23:00:00+08:00')), false)
  assert.equal(canSendAt(now, { quietStart: '08:00', quietEnd: '10:00' }), false)
})
test('HMAC validates nonce, scope and 5 minute window, rejecting wrong signatures', () => {
  const secret = 'unit-test-secret-longer-than-32-characters', timestamp = String(Math.floor(now.getTime() / 1000)), nonce = randomUUID()
  const req = { headers: { 'x-coupon-timestamp': timestamp, 'x-coupon-signature': cronSignature(secret, timestamp, nonce) }, body: { job: 'coupon-reminders-v1', nonce } }
  assert.equal(verifyCronRequest(req, now, secret), nonce)
  assert.throws(() => verifyCronRequest(req, new Date(now.getTime() + 301000), secret), /过期/)
  assert.throws(() => verifyCronRequest({ ...req, body: { ...req.body, nonce: randomUUID() } }, now, secret), /签名/)
  assert.throws(() => verifyCronRequest(req, now, ''), /尚未配置/)
})
test('concurrent runs claim a single daily digest and durable nonce blocks replay', async () => {
  const f = fixture([coupon(), coupon({ id: 'two' })]); let sends = 0
  const args = { ...f, now, recipients, send: async () => { sends++; return { status: 'accepted', provider: 'serverchan' } }, query: async () => null }
  await Promise.all([runCouponReminders({ ...args, nonce: 'nonce-a' }), runCouponReminders({ ...args, nonce: 'nonce-b' })])
  assert.equal(sends, 1); assert.equal(Object.keys(f.state.events).length, 2)
  assert.ok(Object.values(f.state.events).every(e => e.status === 'accepted'))
  await assert.rejects(runCouponReminders({ ...args, nonce: 'nonce-a' }), /已经处理/)
  await runCouponReminders({ ...args, now: new Date(now.getTime() + 86400000) })
  assert.equal(sends, 1)
})
test('definite failures retry at most three times; timeout stays unknown without automatic resend', async () => {
  const f = fixture(); let sends = 0
  const args = { ...f, recipients, send: async () => { sends++; return { status: 'failed', reason: 'quota' } } }
  for (let i = 0; i < 5; i++) await runCouponReminders({ ...args, now: new Date(now.getTime() + i * 3600000) })
  assert.equal(sends, 3)
  const g = fixture(); sends = 0
  for (let i = 0; i < 3; i++) await runCouponReminders({ ...g, recipients, now: new Date(now.getTime() + i * 86400000), send: async () => { sends++; return { status: 'unknown' } } })
  assert.equal(sends, 1)
})
test('date edits and restoring old data do not repeat a submitted coupon milestone', async () => {
  const coupons = [coupon()], f = fixture(coupons); let sends = 0
  const args = { ...f, recipients, send: async () => { sends++; return { status: 'accepted', provider: 'serverchan' } } }
  await runCouponReminders({ ...args, now })
  coupons[0].expiresOn = '2026-12-25'
  await runCouponReminders({ ...args, now: new Date('2026-11-25T09:00:00+08:00') })
  assert.equal(sends, 1)
  coupons[0].expiresOn = '2026-12-24'
  await runCouponReminders({ ...args, now: new Date('2026-11-26T09:00:00+08:00') })
  assert.equal(sends, 1)
})
test('both selected milestones send once each across daily checks and reminder switches', async () => {
  const coupons = [coupon({ reminder: { enabled: true, thirtyDays: true, sevenDays: true, recipients: ['aosen'] } })]
  const f = fixture(coupons); let sends = 0
  const args = { ...f, recipients, send: async () => { sends++; return { status: 'accepted', provider: 'serverchan' } } }
  await runCouponReminders({ ...args, now })
  coupons[0].reminder.enabled = false
  await runCouponReminders({ ...args, now: new Date('2026-11-25T09:00:00+08:00') })
  coupons[0].reminder.enabled = true
  for (let i = 2; i <= 30; i++) await runCouponReminders({ ...args, now: new Date(now.getTime() + i * 86400000) })
  assert.equal(sends, 2)
  assert.deepEqual(Object.values(f.state.events).map(e => e.milestone).sort(), ['seven-days', 'thirty-days'])
  coupons[0].reminder.sevenDays = false
  await runCouponReminders({ ...args, now: new Date('2026-12-24T10:00:00+08:00') })
  assert.equal(sends, 2)
})
test('legacy month events remain deduplicated even with a different deadline and no saved batch', async () => {
  for (const status of ['accepted', 'sent', 'unknown']) {
    const f = fixture([coupon({ expiresOn: '2026-12-25' })]); let sends = 0
    f.state.events.legacy = { key: 'legacy', couponId: 'one', milestone: 'month', recipient: 'aosen', deadline: '2026-12-24', status, attempts: 1 }
    await runCouponReminders({ ...f, recipients, now: new Date('2026-11-25T09:00:00+08:00'), send: async () => { sends++; return { status: 'accepted' } } })
    assert.equal(sends, 0, status)
  }
})
test('coupon consumed between claim and send cancels message', async () => {
  const f = fixture(); let reads = 0, sends = 0
  await runCouponReminders({ ...f, now, recipients, read: async () => ({ record: { coupons: [coupon({ status: ++reads === 1 ? 'unused' : 'used' })] } }), send: async () => { sends++; return { status: 'accepted' } } })
  assert.equal(sends, 0); assert.equal(Object.values(f.state.events)[0].status, 'cancelled')
})
test('shared destination receives one digest even when both family members are selected', async () => {
  const f = fixture([coupon({ reminder: { enabled: true, recipients: ['aosen', 'xiaoyue'] } })]); let sends = 0
  await runCouponReminders({ ...f, now, recipients: [...recipients, { id: 'xiaoyue', token: recipients[0].token }], send: async (_, message) => { sends++; assert.match(message.title, /1 张/); return { status: 'accepted' } } })
  assert.equal(sends, 1); assert.equal(Object.keys(f.state.events).length, 2)
})
test('adding another recipient on the same channel later does not resend after batch pruning', async () => {
  const coupons = [coupon()], f = fixture(coupons); let sends = 0
  const shared = [...recipients, { id: 'xiaoyue', token: recipients[0].token }]
  const args = { ...f, recipients: shared, send: async () => { sends++; return { status: 'accepted', provider: 'serverchan' } } }
  await runCouponReminders({ ...args, now })
  f.state.batches = {}
  coupons[0].reminder.recipients = ['xiaoyue']
  await runCouponReminders({ ...args, now: new Date('2026-11-25T09:00:00+08:00') })
  assert.equal(sends, 1)
  const oldEvent = Object.values(f.state.events)[0]
  assert.equal(typeof oldEvent.destination, 'string')
  assert.equal(oldEvent.destination.length, 64)
})
test('legacy destination is retained before pruning even if the channel moved to the other member', async () => {
  const f = fixture([coupon({ reminder: { enabled: true, recipients: ['xiaoyue'] } })]); let sends = 0
  const destination = createHash('sha256').update(recipients[0].token).digest('hex')
  f.state.events.legacy = { key: 'legacy', couponId: 'one', milestone: 'month', recipient: 'aosen', batchId: 'old-batch', status: 'sent', attempts: 1 }
  f.state.batches['old-batch'] = { id: 'old-batch', day: '2026-08-01', createdAt: '2026-08-01T01:00:00Z', status: 'sent', destination, eventKeys: ['legacy'] }
  await runCouponReminders({ ...f, now, recipients: [{ id: 'xiaoyue', token: recipients[0].token }], send: async () => { sends++; return { status: 'accepted' } } })
  assert.equal(sends, 0)
  assert.equal(f.state.batches['old-batch'], undefined)
  assert.equal(f.state.events.legacy.destination, destination)
})
test('daily global batch budget and abandoned lease both prevent further sends', async () => {
  const f = fixture(); let sends = 0
  for (let i = 0; i < 20; i++) f.state.batches[`limit-${i}`] = { id: `limit-${i}`, day: '2026-11-24', createdAt: now.toISOString(), status: 'failed', destination: 'different', eventKeys: [] }
  await runCouponReminders({ ...f, now, recipients, send: async () => { sends++; return { status: 'accepted' } } })
  assert.equal(sends, 0)
  const g = fixture(), event = reminderCandidates([coupon()], now)[0]
  g.state.events[event.key] = { ...event, batchId: 'abandoned', status: 'claimed', attempts: 1 }
  g.state.batches.abandoned = { id: 'abandoned', recipient: 'aosen', day: '2026-11-23', createdAt: '2026-11-23T01:00:00Z', leaseUntil: '2026-11-23T01:05:00Z', status: 'claimed', eventKeys: [event.key] }
  await runCouponReminders({ ...g, now, recipients, send: async () => { sends++; return { status: 'accepted' } } })
  assert.equal(sends, 0); assert.equal(g.state.events[event.key].status, 'unknown')
})
test('failed reminder is cancelled after coupon expiry and cannot consume retry budget', async () => {
  const coupons = [coupon({ expiresOn: '2026-11-24' })], f = fixture(coupons); let sends = 0
  await runCouponReminders({ ...f, now, recipients, send: async () => { sends++; return { status: 'failed' } } })
  await runCouponReminders({ ...f, now: new Date('2026-11-25T09:00:00+08:00'), recipients, send: async () => { sends++; return { status: 'accepted' } } })
  assert.equal(sends, 1); assert.equal(Object.values(f.state.events)[0].status, 'cancelled')
})
test('provider accepted response is not delivered; malformed success and network timeout stay unknown', async () => {
  const r = { token: 'test-pushplus-token', accessKey: 'test-access-key' }, message = { title: 't', content: 'c' }
  assert.deepEqual(await sendReminder(r, message, { fetcher: async () => response({ code: 200, data: 'message-id' }) }), { status: 'accepted', provider: 'pushplus', providerMessageId: 'message-id', reason: '平台已接收，尚不代表收件人已读。' })
  assert.equal((await sendReminder(r, message, { fetcher: async () => new Response('not JSON') })).status, 'unknown')
  assert.equal((await sendReminder(r, message, { fetcher: async () => { throw Error('timeout including token never exposed') } })).status, 'unknown')
  assert.equal((await queryReminder(r, { provider: 'pushplus', providerMessageId: 'message-id' }, { fetcher: async () => response({ code: 200, data: { status: 2 } }) })).status, 'sent')
  assert.equal(await queryReminder({ token: r.token }, { provider: 'pushplus', providerMessageId: 'id' }), null)
})
test('message includes only minimal coupon fields and a fixed family link, no codes or prices', () => {
  const c = coupon({ notes: 'secret nuclear-code', paidPrice: '9999', attachments: [{ objectKey: 'private-image' }] })
  const message = notificationText(reminderCandidates([c], now), [c])
  assert.match(message.title, /^拾光小笺/)
  assert.match(message.content, /使用截止 2026-12-24/)
  assert.doesNotMatch(message.content, /secret|9999|private-image/)
  const legacy = reminderRecipients({ PUSHPLUS_TOKEN: 'some-token' })
  assert.equal(legacy[0].shared, true); assert.match(legacy[0].label, /未区分成员/)
})
test('endpoint authorization rejects demo, production simulation and unsigned cron without sending', async () => {
  const prior = { system: process.env.SYSTEM_PASSWORD, preview: process.env.PERSONAL_PREVIEW_DIR, cron: process.env.COUPON_CRON_SECRET }
  process.env.SYSTEM_PASSWORD = 'test-family'; delete process.env.PERSONAL_PREVIEW_DIR; process.env.COUPON_CRON_SECRET = 'long-unit-test-secret-32-characters'
  try {
    let res = resMock(); await reminderHandler({ method: 'GET', headers: { authorization: 'demo' } }, res); assert.equal(res.code, 401)
    res = resMock(); await reminderHandler({ method: 'POST', headers: { authorization: 'test-family' }, body: { action: 'simulate', date: '2026-11-24' } }, res); assert.equal(res.code, 403)
    res = resMock(); await runHandler({ method: 'POST', headers: {}, body: {} }, res); assert.equal(res.code, 403)
  } finally { for (const [key, value] of [['SYSTEM_PASSWORD', prior.system], ['PERSONAL_PREVIEW_DIR', prior.preview], ['COUPON_CRON_SECRET', prior.cron]]) value === undefined ? delete process.env[key] : process.env[key] = value }
})
test('production state uses compare-and-swap, retrying conflicts without losing updates', async () => {
  const previous = { fetch: global.fetch, url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY, preview: process.env.PERSONAL_PREVIEW_DIR }
  process.env.SUPABASE_URL = 'https://coupon-test.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'unit-test-service-key'; delete process.env.PERSONAL_PREVIEW_DIR
  let row = { version: 0, state: blankReminderState() }, conflicts = 0
  global.fetch = async (url, options = {}) => {
    assert.equal(options.redirect, 'error')
    const parsed = new URL(url)
    if (!options.method) return response([structuredClone(row)])
    const version = Number(parsed.searchParams.get('version')?.slice(3))
    if (version !== row.version) { conflicts++; return response([]) }
    row = JSON.parse(options.body); return response([row])
  }
  try {
    await Promise.all([reminderTransaction(s => { s.events.first = { id: 1 } }), reminderTransaction(s => { s.events.second = { id: 2 } })])
    assert.ok(conflicts > 0); assert.equal(row.version, 2); assert.equal(Object.keys(row.state.events).length, 2)
  } finally { global.fetch = previous.fetch; for (const [key, value] of [['SUPABASE_URL', previous.url], ['SUPABASE_SERVICE_ROLE_KEY', previous.key], ['PERSONAL_PREVIEW_DIR', previous.preview]]) value === undefined ? delete process.env[key] : process.env[key] = value }
})
