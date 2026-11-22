import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readFullBackup, restoreFullBackup, readMainSnapshot, saveTravelItem, deleteTravelItem } from '../api/_data-store.js'
import { previewTransaction } from '../server/preview-store.js'
import travelHandler from '../api/travel-history.js'

const trip = (id) => ({ id, savedAt: '2026-11-22T12:00:00Z', destination: id, plan: { meta: { destination: id }, plans: [{ variant: 'classic', title: id, days: [{ title: id }] }] } })
async function setup() {
  process.env.PERSONAL_PREVIEW_DIR = await mkdtemp(join(tmpdir(), 'family-travel-test-'))
  process.env.NODE_ENV = 'test'
  process.env.SYSTEM_PASSWORD = 'family-test'
  await previewTransaction((state) => { state.records.main = { key: 'main', value: { name: 'family' } }; state.travel = {}; return null })
}

test('travel saves and deletes advance the main revision and invalidate stale full restores', async () => {
  await setup()
  const original = await readFullBackup()
  const saved = await saveTravelItem(trip('A'))
  assert.equal(saved.revision, 1)
  await assert.rejects(restoreFullBackup(original, original.revision), (e) => e.status === 409 && e.revision === 1)
  const snapshot = await readFullBackup()
  assert.equal(snapshot.revision, 1)
  assert.equal(snapshot.travel.travelHistoryIndex[0].id, 'A')
  assert.equal(snapshot.travel.travelPlanDetails.A.plan.meta.destination, 'A')
  const deleted = await deleteTravelItem('A')
  assert.equal(deleted.revision, 2)
  await assert.rejects(restoreFullBackup(snapshot, 1), (e) => e.status === 409)
  assert.deepEqual((await readFullBackup()).travel.travelHistoryIndex, [])
})

test('concurrent local travel mutations retain both trips; snapshots never contain half a travel save', async () => {
  await setup()
  const snapshots = []
  const outcomes = await Promise.all([
    saveTravelItem(trip('A')),
    readFullBackup().then((value) => snapshots.push(value)),
    saveTravelItem(trip('B')),
    readFullBackup().then((value) => snapshots.push(value))
  ])
  assert.deepEqual([outcomes[0].revision, outcomes[2].revision], [1, 2])
  for (const snapshot of snapshots) {
    const ids = snapshot.travel.travelHistoryIndex.map((row) => row.id).sort()
    assert.deepEqual(ids, Object.keys(snapshot.travel.travelPlanDetails).sort())
    assert.equal(ids.length, snapshot.revision)
  }
  assert.deepEqual((await readFullBackup()).travel.travelHistoryIndex.map((row) => row.id).sort(), ['A', 'B'])
  const before = await readFullBackup()
  const results = await Promise.allSettled([saveTravelItem(trip('C')), restoreFullBackup(before, before.revision)])
  assert.equal(results[0].status, 'fulfilled')
  assert.equal(results[1].status, 'rejected')
  assert.equal(results[1].reason.status, 409)
  assert.equal((await readMainSnapshot()).revision, 3)
})

test('travel HTTP mutation responses preserve history and expose the committed family revision', async () => {
  await setup()
  const res = { statusCode: 200, status(n) { this.statusCode = n; return this }, json(value) { this.body = value; return this } }
  await travelHandler({ method: 'POST', headers: { authorization: 'family-test' }, body: { item: trip('A') } }, res)
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.revision, 1)
  assert.equal(res.body.history[0].id, 'A')
  await travelHandler({ method: 'DELETE', query: { id: 'A' }, headers: { authorization: 'family-test' } }, res)
  assert.equal(res.body.revision, 2)
  assert.deepEqual(res.body.history, [])
})

test('missing snapshot/mutation RPC fails closed without multi-request fallback', async () => {
  delete process.env.PERSONAL_PREVIEW_DIR
  process.env.SUPABASE_URL = 'https://test.invalid'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-only'
  const original = globalThis.fetch, requests = []
  globalThis.fetch = async (url, options) => { requests.push({ url, options }); return new Response('not installed', { status: 404 }) }
  try {
    for (const action of [() => readFullBackup(), () => saveTravelItem(trip('A')), () => deleteTravelItem('A')]) await assert.rejects(action(), (e) => e.status === 503)
    assert.equal(requests.length, 3)
    assert.ok(requests[0].url.endsWith('/rpc/family_read_snapshot'))
    assert.ok(requests.slice(1).every((request) => request.url.endsWith('/rpc/family_travel_mutate')))
    assert.ok(requests.every((request) => request.options.method === 'POST'))
  } finally { globalThis.fetch = original }
})

test('Supabase backup and travel writes each use one RPC, preserving response contracts and redaction', async () => {
  delete process.env.PERSONAL_PREVIEW_DIR
  process.env.SUPABASE_URL = 'https://test.invalid'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-only'
  const original = globalThis.fetch, requests = []
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options })
    if (url.endsWith('/rpc/family_read_snapshot')) return Response.json({ record: { name: 'family', _familyRevision: 7, llmApiKey: 'never-export' }, travel: { travelHistoryIndex: [], travelPlanDetails: {} } })
    const body = JSON.parse(options.body)
    assert.equal(body.p_action, 'save')
    assert.equal(body.p_detail.id, 'A')
    assert.equal(body.p_summary.id, 'A')
    return Response.json({ revision: 8, index: [body.p_summary], summary: body.p_summary, detail: body.p_detail })
  }
  try {
    const backup = await readFullBackup()
    assert.equal(backup.revision, 7)
    assert.equal(backup.main.llmApiKey, undefined)
    const saved = await saveTravelItem(trip('A'))
    assert.equal(saved.revision, 8)
    assert.equal(saved.index[0].id, 'A')
    assert.equal(requests.length, 2)
  } finally { globalThis.fetch = original }
})
