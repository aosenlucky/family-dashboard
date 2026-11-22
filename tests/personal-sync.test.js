import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sync, { isQuietTime } from '../api/sync.js'
import wealthAuth from '../api/wealth-auth.js'
import backup from '../api/data-backup.js'
import { previewTransaction } from '../server/preview-store.js'
import { REVISION_FIELD, createWealthToken, isWealthUnlocked } from '../api/_family-security.js'
import { getSupabaseConfig } from '../api/_data-store.js'

const secret = 'test-family-only'
const request = async (handler, method, body, extra = {}) => {
  const response = { code: 200, headers: {}, setHeader(k, v) { this.headers[k] = v }, status(code) { this.code = code; return this }, json(value) { this.body = value; return this } }
  await handler({ method, body, headers: { authorization: secret, ...extra }, query: {} }, response)
  return response
}
async function setup() {
  process.env.PERSONAL_PREVIEW_DIR = await mkdtemp(join(tmpdir(), 'personal-family-test-'))
  process.env.SYSTEM_PASSWORD = secret
  process.env.WEALTH_PASSWORD = 'test-wealth-only'
  process.env.NODE_ENV = 'test'
  await previewTransaction((state) => {
    state.records.main = { key: 'main', value: { name: 'original', photos: [], todos: [], assets: [{ amount: 72 }], paymentChecks: { a: true }, llmApiKey: 'never-return', wealthPassword: 'legacy-secret' } }
    state.travel = { travelHistory: [], travelHistoryIndex: [], travelPlanDetails: {} }
    return null
  })
}

test('main read is private; locked updates preserve finances and secrets without revealing them', async () => {
  await setup()
  const read = await request(sync, 'GET')
  assert.equal(read.code, 200)
  assert.equal(read.body.revision, 0)
  assert.equal(read.body.wealthUnlocked, false)
  for (const key of ['assets', 'paymentChecks', 'llmApiKey', 'wealthPassword']) assert.equal(key in read.body.record, false)
  const saved = await request(sync, 'POST', { record: { name: 'changed' }, revision: 0 })
  assert.equal(saved.code, 200)
  assert.equal(saved.body.revision, 1)
  const persisted = await previewTransaction((state) => state.records.main.value, { write: false })
  assert.deepEqual(persisted.assets, [{ amount: 72 }])
  assert.equal(persisted.llmApiKey, 'never-return')
  assert.equal(persisted.wealthPassword, undefined)
  const attack = await request(sync, 'POST', { record: { assets: [] }, revision: 1 })
  assert.equal(attack.code, 403)
  assert.equal((await request(sync, 'GET')).body.revision, 1)
})

test('concurrent saves have exactly one winner; stale and legacy requests cannot overwrite', async () => {
  await setup()
  const replies = await Promise.all(['one', 'two'].map((name) => request(sync, 'POST', { record: { name }, revision: 0 })))
  assert.deepEqual(replies.map((r) => r.code).sort(), [200, 409])
  const stale = replies.find((r) => r.code === 409)
  assert.equal(stale.body.revision, 1)
  assert.equal(stale.body.record.assets, undefined)
  assert.equal(stale.body.record.llmApiKey, undefined)
  assert.equal((await request(sync, 'POST', { name: 'old-client' })).code, 428)
})

test('legacy finance todos and recycled finance entries stay private and survive locked full-record saves', async () => {
  await setup()
  const financeTodo = { id: 'private-todo', text: '转入工商银行 12345 元', sourceType: 'loan-transfer', sourceKey: 'loan-transfer:ICBC:12345' }
  const financeTrash = { id: 'private-trash', collection: 'assets', item: { id: 1, value: 12345 } }
  const todoTrash = { id: 'private-todo-trash', collection: 'todos', item: financeTodo }
  await previewTransaction((state) => {
    state.records.main.value.todos = [financeTodo, { id: 'shared-todo', text: '浇花' }]
    state.records.main.value.trash = [financeTrash, todoTrash, { id: 'shared-trash', collection: 'photos', item: { url: '/garden.jpg' } }]
    return null
  })
  const locked = (await request(sync, 'GET')).body
  assert.equal(JSON.stringify(locked).includes('12345'), false)
  assert.deepEqual(locked.record.todos.map((x) => x.id), ['shared-todo'])
  assert.deepEqual(locked.record.trash.map((x) => x.id), ['shared-trash'])
  const saved = await request(sync, 'POST', { record: { todos: [], trash: [] }, revision: 0 })
  assert.equal(saved.code, 200)
  assert.deepEqual(saved.body.record.todos, [])
  const unlocked = (await request(sync, 'GET', undefined, { 'x-wealth-token': createWealthToken().token })).body
  assert.deepEqual(unlocked.record.todos, [financeTodo])
  assert.deepEqual(unlocked.record.trash, [financeTrash, todoTrash])
  const attack = await request(sync, 'POST', { record: { todos: [{ id: 'private-todo', text: 'changed without unlock' }] }, revision: 1 })
  assert.equal(attack.code, 403)
  assert.equal((await request(sync, 'GET')).body.revision, 1)
})

test('wealth token only grants bounded finance access and never exposes server secrets', async () => {
  await setup()
  const unlocked = await request(wealthAuth, 'POST', { password: 'test-wealth-only' })
  assert.equal(unlocked.code, 200)
  const headers = { 'x-wealth-token': unlocked.body.token }
  const read = await request(sync, 'GET', undefined, headers)
  assert.equal(read.body.wealthUnlocked, true)
  assert.deepEqual(read.body.record.assets, [{ amount: 72 }])
  assert.equal(read.body.record.llmApiKey, undefined)
  const update = await request(sync, 'POST', { record: { assets: [{ amount: 80 }] }, revision: 0 }, headers)
  assert.equal(update.code, 200)
  assert.deepEqual(update.body.record.assets, [{ amount: 80 }])
  assert.equal(isWealthUnlocked({ headers: { 'x-wealth-token': unlocked.body.token + 'x' } }), false)
  assert.equal(isWealthUnlocked({ headers: { 'x-wealth-token': createWealthToken('demo').token } }), false)
  process.env.WEALTH_PASSWORD = 'rotated'
  assert.equal(isWealthUnlocked({ headers }), false)
})

test('missing family config fails closed for sync, wealth, and backups', async () => {
  await setup()
  delete process.env.SYSTEM_PASSWORD
  for (const handler of [sync, wealthAuth, backup]) assert.equal((await request(handler, handler === wealthAuth ? 'POST' : 'GET', {})).code, 503)
})

test('preview never contacts push providers and quiet hours use the family timezone', async () => {
  await setup()
  assert.throws(getSupabaseConfig, (e) => e.status === 503)
  process.env.PUSHPLUS_TOKEN = 'must-not-send'
  const original = globalThis.fetch
  globalThis.fetch = async () => { throw new Error('Preview must not send external notifications') }
  try {
    const reply = await request(sync, 'POST', { action: 'notify', title: '家务', content: '已完成' })
    assert.equal(reply.code, 200)
    assert.equal(reply.body.reason, 'local-preview')
  } finally { globalThis.fetch = original; delete process.env.PUSHPLUS_TOKEN }
  assert.equal(isQuietTime({}, new Date('2026-11-22T15:00:00Z')), true)
  assert.equal(isQuietTime({}, new Date('2026-11-22T02:00:00Z')), false)
  assert.equal(isQuietTime({ quietStart: '12:00', quietEnd: '14:00' }, new Date('2026-11-22T05:00:00Z')), true)
})

test('backup preview never writes; restore and rollback require privilege, confirmation and CAS', async () => {
  await setup()
  const headers = { 'x-wealth-token': createWealthToken().token }
  assert.equal((await request(backup, 'GET')).code, 403)
  const exported = (await request(backup, 'GET', undefined, headers)).body
  assert.equal(exported.version, 4)
  assert.equal(exported.main.llmApiKey, undefined)
  assert.deepEqual(exported.mediaOrigins, [])
  const target = { ...exported, main: { name: 'restored', photos: [{ id: '1' }], assets: [{ amount: 90 }] }, travel: { travelHistory: [], travelHistoryIndex: [], travelPlanDetails: {} } }
  const preview = await request(backup, 'POST', { action: 'preview', backup: target }, headers)
  assert.equal(preview.body.counts.photos, 1)
  assert.equal((await request(sync, 'GET')).body.record.name, 'original')
  assert.equal((await request(backup, 'POST', { action: 'restore', backup: target, revision: 0 }, headers)).code, 400)
  assert.equal((await request(backup, 'POST', { action: 'restore', backup: target, confirm: true }, headers)).code, 428)
  const restored = await request(backup, 'POST', { action: 'restore', backup: target, revision: 0, confirm: true }, headers)
  assert.equal(restored.code, 200)
  assert.equal(restored.body.revision, 1)
  const stale = await request(backup, 'POST', { action: 'restore', backup: exported, revision: 0, confirm: true }, headers)
  assert.equal(stale.code, 409)
  assert.equal((await request(sync, 'GET')).body.record.name, 'restored')
  const rollback = await request(backup, 'POST', { action: 'rollback', restorePointId: restored.body.restorePointId, revision: 1, confirm: true }, headers)
  assert.equal(rollback.code, 200)
  assert.equal(rollback.body.revision, 2)
  assert.equal((await request(sync, 'GET')).body.record.name, 'original')
  assert.deepEqual((await request(backup, 'GET', undefined, headers)).body.travel, exported.travel)
  const failed = await request(backup, 'POST', { action: 'restore', backup: { ...target, travel: null }, revision: 2, confirm: true }, headers)
  assert.equal(failed.code, 400)
  const stored = await previewTransaction((state) => state.records.main.value, { write: false })
  assert.equal(stored[REVISION_FIELD], 2)
  assert.equal(stored.llmApiKey, 'never-return')
})
