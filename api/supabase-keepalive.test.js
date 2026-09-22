import assert from 'node:assert/strict'
import test from 'node:test'

const originalEnv = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY
}
const originalFetch = globalThis.fetch

process.env.SUPABASE_URL = 'https://example.supabase.co'
process.env.SUPABASE_SECRET_KEY = 'test-secret-key'
delete process.env.SUPABASE_SERVICE_ROLE_KEY

const { default: handler } = await import('./supabase-keepalive.js')

test('Supabase keepalive endpoint', async (t) => {
  await t.test('runs three reads and an isolated heartbeat write without exposing row data', async () => {
    const requests = []
    globalThis.fetch = async (url, options) => {
      requests.push({ url: String(url), options })
      if (options.method === 'POST') return new Response(null, { status: 204 })
      return new Response('[{"id":"must-not-be-returned"}]', {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const response = await invokeHandler({ method: 'GET', headers: {} })

    assert.equal(response.statusCode, 200)
    assert.equal(response.headers['cache-control'], 'no-store, max-age=0')
    assert.equal(response.payload.success, true)
    assert.equal(response.payload.databaseRequests, 4)
    assert.equal(response.payload.databaseWrites, 1)
    assert.equal(JSON.stringify(response.payload).includes('must-not-be-returned'), false)
    assert.equal(requests.length, 4)
    assert.deepEqual(
      requests.filter(({ options }) => options.method !== 'POST').map(({ url }) => new URL(url).pathname + new URL(url).search).sort(),
      [
        '/rest/v1/family_records?select=key&limit=1',
        '/rest/v1/travel_history_index?select=id&limit=1',
        '/rest/v1/travel_plan_details?select=id&limit=1'
      ].sort()
    )
    for (const request of requests) {
      assert.equal(request.options.headers.apikey, 'test-secret-key')
      assert.equal(request.options.headers.Authorization, 'Bearer test-secret-key')
    }

    const writeRequest = requests.find(({ options }) => options.method === 'POST')
    assert.equal(new URL(writeRequest.url).pathname + new URL(writeRequest.url).search, '/rest/v1/family_records?on_conflict=key')
    assert.equal(writeRequest.options.headers.Prefer, 'resolution=merge-duplicates,return=minimal')
    const body = JSON.parse(writeRequest.options.body)
    assert.equal(body.key, '__system_keepalive__')
    assert.deepEqual(body.value, { lastSeenAt: body.updated_at })
  })

  await t.test('rejects unsupported methods before accessing Supabase', async () => {
    let requestCount = 0
    globalThis.fetch = async () => {
      requestCount += 1
      return new Response('[]', { status: 200 })
    }

    const response = await invokeHandler({ method: 'DELETE', headers: {} })

    assert.equal(response.statusCode, 405)
    assert.equal(response.headers.allow, 'GET, POST')
    assert.equal(requestCount, 0)
  })

  await t.test('returns an error status when a database query fails', async () => {
    globalThis.fetch = async () => new Response('{"message":"database unavailable"}', { status: 503 })

    const response = await invokeHandler({ method: 'POST', headers: {}, body: {} })

    assert.equal(response.statusCode, 500)
    assert.equal(response.payload.success, false)
    assert.match(response.payload.detail, /503/)
  })

  await t.test('returns an error status when Supabase is not configured', async () => {
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_SECRET_KEY

    const response = await invokeHandler({ method: 'GET', headers: {} })

    assert.equal(response.statusCode, 503)
    assert.equal(response.payload.success, false)

    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SECRET_KEY = 'test-secret-key'
  })
})

test.after(() => {
  globalThis.fetch = originalFetch
  restoreEnv('SUPABASE_URL', originalEnv.SUPABASE_URL)
  restoreEnv('SUPABASE_SERVICE_ROLE_KEY', originalEnv.SUPABASE_SERVICE_ROLE_KEY)
  restoreEnv('SUPABASE_SECRET_KEY', originalEnv.SUPABASE_SECRET_KEY)
})

async function invokeHandler(request) {
  const response = {
    statusCode: 200,
    headers: {},
    payload: undefined,
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = value
    },
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.payload = payload
      return this
    }
  }

  await handler(request, response)
  return response
}

function restoreEnv(name, value) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}
