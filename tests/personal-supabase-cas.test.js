import test from 'node:test'
import assert from 'node:assert/strict'
import { writeMainRecord, restoreFullBackup } from '../api/_data-store.js'
import { REVISION_FIELD } from '../api/_family-security.js'

test('Supabase CAS uses conditional atomic PATCH; legacy revision zero races safely', async () => {
  delete process.env.PERSONAL_PREVIEW_DIR
  process.env.SUPABASE_URL = 'https://test.invalid'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'nonsecret-test-key'
  const original = globalThis.fetch
  let value = { name: 'legacy', assets: [{ amount: 12 }], llmApiKey: 'secret' }
  const patches = []
  globalThis.fetch = async (url, options = {}) => {
    if ((options.method || 'GET') === 'GET') return Response.json([{ value: structuredClone(value) }])
    assert.equal(options.method, 'PATCH')
    assert.equal(options.headers.Prefer, 'return=representation')
    const query = new URL(url).searchParams
    patches.push(query)
    const expected = query.has('or') ? 0 : Number(query.get(`value->>${REVISION_FIELD}`).slice(3))
    if ((value[REVISION_FIELD] || 0) !== expected) return Response.json([])
    value = JSON.parse(options.body).value
    return Response.json([{ key: 'main', value }])
  }
  try {
    const results = await Promise.allSettled(['one', 'two'].map((name) => writeMainRecord({ name }, 0)))
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
    const rejected = results.find((r) => r.status === 'rejected').reason
    assert.equal(rejected.status, 409)
    assert.equal(rejected.revision, 1)
    assert.deepEqual(value.assets, [{ amount: 12 }])
    assert.ok(patches.every((q) => q.get('or') === '(value->>_familyRevision.is.null,value->>_familyRevision.eq.0)'))
    await writeMainRecord({ name: 'next' }, 1)
    assert.equal(patches.at(-1).get('value->>_familyRevision'), 'eq.1')
    assert.equal(value[REVISION_FIELD], 2)
  } finally { globalThis.fetch = original }
})

test('Supabase initialization does not upsert over a competing first insert', async () => {
  const original = globalThis.fetch
  let inserted = null
  globalThis.fetch = async (url, options = {}) => {
    if ((options.method || 'GET') === 'GET') return Response.json(inserted ? [inserted] : [])
    assert.equal(options.method, 'POST')
    assert.equal(new URL(url).searchParams.has('on_conflict'), false)
    if (inserted) return new Response('duplicate', { status: 409 })
    inserted = JSON.parse(options.body)
    return Response.json([inserted], { status: 201 })
  }
  try {
    const results = await Promise.allSettled(['one', 'two'].map((name) => writeMainRecord({ name }, 0)))
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
    assert.equal(results.find((r) => r.status === 'rejected').reason.status, 409)
  } finally { globalThis.fetch = original }
})

test('missing restore RPC cannot cause a partial restore; unsupported stores cannot fake CAS', async () => {
  const original = globalThis.fetch
  const requests = []
  globalThis.fetch = async (url, options) => { requests.push({ url, options }); return new Response('not installed', { status: 404 }) }
  try {
    await assert.rejects(restoreFullBackup({ version: 4, main: { name: 'new' }, travel: {} }, 0), (e) => e.status === 503)
    assert.equal(requests.length, 1)
    assert.ok(requests[0].url.endsWith('/rpc/family_restore_snapshot'))
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    await assert.rejects(writeMainRecord({ name: 'new' }, 0), (e) => e.status === 503)
    assert.equal(requests.length, 1)
  } finally { globalThis.fetch = original }
})
