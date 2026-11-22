// Optional local PostgreSQL-engine check, with no cloud connection:
// npm install --prefix .local/sql-validation --ignore-scripts --no-package-lock @electric-sql/pglite
// node scripts/verify-personal-restore.mjs
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PGlite } from '../.local/sql-validation/node_modules/@electric-sql/pglite/dist/index.js'

const db = new PGlite()
await db.exec('create role anon; create role authenticated; create role service_role;')
await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'))
await db.exec(await readFile(new URL('../supabase/personal-restore.sql', import.meta.url), 'utf8'))
await db.query('insert into family_records(key,value) values($1,$2::jsonb),($3,$4::jsonb)', ['main', JSON.stringify({ name: 'before', assets: [{ amount: 1 }], llmApiKey: 'server-secret' }), 'private-diary-v1:fixture', JSON.stringify({ ciphertext: 'encrypted-only' })])
await db.query('insert into travel_history_index(id,summary) values($1,$2::jsonb)', ['old-trip', JSON.stringify({ id: 'old-trip', title: 'before' })])
await db.query('insert into travel_plan_details(id,item) values($1,$2::jsonb)', ['old-trip', JSON.stringify({ id: 'old-trip', plan: { title: 'before' } })])
const current = async () => (await db.query("select value from family_records where key='main'")).rows[0].value
const restore = async (backup, revision, rollback = null) => (await db.query(
  'select family_restore_snapshot($1,$2,$3,$4::jsonb,$5::bigint,$6,$7) as result',
  ['family_records', 'travel_history_index', 'travel_plan_details', backup ? JSON.stringify(backup) : null, revision, `restore-${randomUUID()}`, rollback]
)).rows[0].result
const snapshot = async () => (await db.query('select family_read_snapshot($1,$2,$3) as result', ['family_records', 'travel_history_index', 'travel_plan_details'])).rows[0].result
const mutateTravel = async (id, { action = 'save', failAfterIndex = false, limit = 60 } = {}) => (await db.query(
  'select family_travel_mutate($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8::integer) as result',
  ['family_records', 'travel_history_index', 'travel_plan_details', action,
    JSON.stringify({ id, plan: { title: id }, savedAt: failAfterIndex ? 'invalid-timestamp-after-index-insert' : '2026-11-22T12:00:00Z' }),
    JSON.stringify({ id, title: id, savedAt: '2026-11-22T12:00:00Z' }), id, limit]
)).rows[0].result
const target = { version: 4, main: { name: 'after', assets: [{ amount: 2 }] }, travel: { travelHistoryIndex: [{ id: 'new-trip', title: 'after' }], travelPlanDetails: { 'new-trip': { id: 'new-trip', plan: { title: 'after' } } } } }
try {
  const saved = await restore(target, 0)
  assert.equal(saved.revision, 1)
  assert.equal((await current()).name, 'after')
  assert.equal((await current()).llmApiKey, 'server-secret')
  assert.equal((await db.query('select id from travel_plan_details')).rows[0].id, 'new-trip')
  const stale = await restore(target, 0)
  assert.equal(stale.conflict, true)
  assert.equal(stale.current._familyRevision, 1)
  assert.equal(stale.current.llmApiKey, undefined)
  const pointCount = (await db.query("select count(*)::integer as n from family_records where key like 'restore-%'")).rows[0].n
  const invalid = structuredClone(target)
  invalid.travel.travelHistoryIndex[0].dayCount = 'invalid-integer-forced-error'
  await assert.rejects(restore(invalid, 1))
  assert.equal((await current())._familyRevision, 1)
  assert.equal((await db.query('select id from travel_plan_details')).rows[0].id, 'new-trip')
  assert.equal((await db.query("select count(*)::integer as n from family_records where key like 'restore-%'")).rows[0].n, pointCount)
  const rolled = await restore(null, 1, saved.restorePointId)
  assert.equal(rolled.revision, 2)
  assert.equal((await current()).name, 'before')
  assert.equal((await current()).llmApiKey, 'server-secret')
  assert.equal((await db.query('select id from travel_plan_details')).rows[0].id, 'old-trip')
  assert.deepEqual((await db.query("select value from family_records where key='private-diary-v1:fixture'")).rows[0].value, { ciphertext: 'encrypted-only' })
  const beforeTravel = await snapshot()
  assert.equal(beforeTravel.record._familyRevision, 2)
  const tripSave = await mutateTravel('atomic-trip')
  assert.equal(tripSave.revision, 3)
  assert.equal((await restore(target, 2)).conflict, true)
  const tripSnapshot = await snapshot()
  assert.equal(tripSnapshot.record._familyRevision, 3)
  assert.deepEqual(tripSnapshot.travel.travelHistoryIndex.map((item) => item.id).sort(), Object.keys(tripSnapshot.travel.travelPlanDetails).sort())
  assert.equal(tripSnapshot.travel.travelPlanDetails['atomic-trip'].plan.title, 'atomic-trip')
  await assert.rejects(mutateTravel('should-rollback', { failAfterIndex: true }))
  assert.deepEqual(await snapshot(), tripSnapshot)
  // Concurrent API callers are submitted to the local PostgreSQL engine. Each
  // travel operation is one transaction; a restore using the old revision loses.
  const racing = await Promise.all([mutateTravel('race-a'), restore(target, 3), mutateTravel('race-b'), snapshot()])
  assert.equal(racing[0].revision, 4)
  assert.equal(racing[1].conflict, true)
  assert.equal(racing[2].revision, 5)
  assert.equal(racing[3].record._familyRevision, 5)
  assert.ok(racing[3].travel.travelPlanDetails['race-a'])
  assert.ok(racing[3].travel.travelPlanDetails['race-b'])
  assert.deepEqual(racing[3].travel.travelHistoryIndex.map((item) => item.id).sort(), Object.keys(racing[3].travel.travelPlanDetails).sort())
  const deleted = await mutateTravel('race-a', { action: 'delete' })
  assert.equal(deleted.revision, 6)
  assert.equal((await snapshot()).travel.travelPlanDetails['race-a'], undefined)
  assert.equal((await restore(target, 5)).conflict, true)
  await mutateTravel('prune-newest', { limit: 2 })
  const pruned = await snapshot()
  assert.equal(pruned.record._familyRevision, 7)
  assert.equal(pruned.travel.travelHistoryIndex.length, 2)
  assert.deepEqual(pruned.travel.travelHistoryIndex.map((item) => item.id).sort(), Object.keys(pruned.travel.travelPlanDetails).sort())
  const cleared = await mutateTravel('', { action: 'delete' })
  assert.equal(cleared.revision, 8)
  assert.deepEqual((await snapshot()).travel.travelHistoryIndex, [])
  assert.deepEqual((await snapshot()).travel.travelPlanDetails, {})
  assert.equal((await current()).llmApiKey, 'server-secret')
  assert.deepEqual((await db.query("select value from family_records where key='private-diary-v1:fixture'")).rows[0].value, { ciphertext: 'encrypted-only' })
  await db.exec('set role anon')
  await assert.rejects(restore(target, 2), /permission denied/)
  await assert.rejects(snapshot(), /permission denied/)
  await assert.rejects(mutateTravel('forbidden'), /permission denied/)
  console.log('PASS: PostgreSQL restore/rollback, atomic travel mutation/pruning, common revision conflicts, consistent backup snapshot, failure rollback, private diary isolation, and all RPC anon denials.')
} finally { await db.close() }
