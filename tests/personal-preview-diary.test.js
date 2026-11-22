import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sync from '../api/sync.js'
import { accessProof, createCloudStorage } from '../src/features/diary/cloud.js'
import { createVault, unlockVault } from '../src/features/diary/crypto.js'
import { newData } from '../src/features/diary/model.js'

test('isolated persistent preview uses the real encrypted diary protocol across devices', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'family-preview-diary-'))
  process.env.PERSONAL_PREVIEW_DIR = directory
  process.env.SYSTEM_PASSWORD = 'local-family-test'
  process.env.NODE_ENV = 'test'
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Local diary must not reach cloud') })
  const call = async (_url, options) => {
    let status = 200, payload
    await sync({ method: 'POST', headers: Object.fromEntries(new Headers(options.headers)), body: JSON.parse(options.body), query: {} }, {
      setHeader() {}, status(code) { status = code; return this }, json(value) { payload = value }
    })
    return Response.json(payload, { status })
  }
  const account = 'preview-user', password = 'preview-diary-only', data = newData('预览日记')
  data.draft.text = 'only visible after decryption'
  data.draft.photos = ['data:image/jpeg;base64,' + 'A'.repeat(390000)]
  const vault = await createVault(password, data)
  const proof = await accessProof(account, password), recovery = await accessProof(account, vault.recovery, true)
  const storage = () => createCloudStorage(account, proof, call, () => process.env.SYSTEM_PASSWORD)
  await storage().register(recovery)
  await storage().writeVault(vault.envelope, 0, { recovery })
  assert.deepEqual((await unlockVault(await storage().readVault(), password)).data, data)
  const persisted = await readFile(join(directory, 'records.json'), 'utf8')
  assert.equal(persisted.includes(data.draft.text), false)
  assert.equal(persisted.includes(password), false)
  assert.equal(persisted.includes(vault.recovery), false)
  const racing = await Promise.allSettled([storage().writeVault(vault.envelope, 1), storage().writeVault(vault.envelope, 1)])
  assert.equal(racing.filter((r) => r.status === 'fulfilled').length, 1)
  assert.equal(racing.find((r) => r.status === 'rejected').reason.status, 409)
})
