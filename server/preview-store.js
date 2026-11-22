import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { randomUUID } from 'node:crypto'

const queues = new Map()

export function hasPreviewStore() {
  if (!process.env.PERSONAL_PREVIEW_DIR) return false
  if (process.env.NODE_ENV === 'production') throw Object.assign(new Error('本机预览存储不能用于生产环境。'), { status: 503 })
  return true
}

// All preview handlers share one serialized, durable store. No production env is loaded here.
export async function previewTransaction(operation, { write = true } = {}) {
  if (!hasPreviewStore()) throw new Error('本机预览存储未启用。')
  const directory = resolve(process.env.PERSONAL_PREVIEW_DIR)
  const previous = queues.get(directory) || Promise.resolve()
  const next = previous.catch(() => {}).then(async () => {
    const file = join(directory, 'records.json')
    let state
    try { state = JSON.parse(await readFile(file, 'utf8')) } catch (error) {
      if (error.code !== 'ENOENT') throw error
      state = { records: {}, travel: {} }
    }
    const result = await operation(state)
    if (write) {
      await mkdir(directory, { recursive: true })
      const temporary = join(directory, `.records-${randomUUID()}.tmp`)
      await writeFile(temporary, JSON.stringify(state), { encoding: 'utf8', mode: 0o600 })
      await rename(temporary, file)
    }
    return structuredClone(result)
  })
  queues.set(directory, next.then(() => {}, () => {}))
  return next
}

// Implements only the record queries used by the encrypted-diary handler.
export async function previewRecords(query, method = 'GET', body, prefer = 'return=minimal') {
  return previewTransaction((state) => {
    const q = new URLSearchParams(query)
    const rows = Object.entries(state.records).filter(([key, row]) =>
      q.getAll('key').every((filter) => {
        if (filter.startsWith('eq.')) return key === filter.slice(3)
        if (filter.startsWith('lt.')) return key < filter.slice(3)
        if (filter.startsWith('like.') && filter.endsWith('*')) return key.startsWith(filter.slice(5, -1))
        throw new Error('Unsupported preview record query')
      }) && (!q.has('value->>revision') || `eq.${row.value.revision}` === q.get('value->>revision')))
    if (method === 'GET') return rows.map(([key, row]) => q.get('select') === 'key' ? { key } : row)
    if (method === 'POST') {
      if (!state.records[body.key]) state.records[body.key] = body
      else if (!prefer.includes('ignore-duplicates')) throw Object.assign(new Error('记录已存在。'), { status: 409 })
      return null
    }
    if (method === 'PATCH') {
      for (const [key, row] of rows) state.records[key] = { ...row, ...body }
      return rows.map(([key]) => ({ key }))
    }
    if (method === 'DELETE') { for (const [key] of rows) delete state.records[key]; return null }
    throw new Error('Unsupported preview record method')
  }, { write: method !== 'GET' })
}
