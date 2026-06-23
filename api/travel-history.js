const HISTORY_FIELD = 'travelHistory'

export default async function handler(req, res) {
  const pin = process.env.SYSTEM_PASSWORD
  const authHeader = req.headers.authorization || ''
  if (pin && authHeader !== pin) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    if (req.method === 'GET') {
      const record = await readJsonBinRecord()
      return res.status(200).json({ history: normalizeHistory(record[HISTORY_FIELD]) })
    }

    if (req.method === 'POST') {
      const item = req.body?.item
      if (!item?.plan) return res.status(400).json({ error: '缺少要保存的行程。' })
      const record = await readJsonBinRecord()
      const history = normalizeHistory(record[HISTORY_FIELD])
      const nextItem = {
        ...item,
        id: item.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        savedAt: item.savedAt || new Date().toISOString()
      }
      const next = [nextItem, ...history.filter((saved) => saved.id !== nextItem.id && (saved.destination !== nextItem.destination || saved.dateRange !== nextItem.dateRange))].slice(0, 24)
      await writeJsonBinRecord({ ...record, [HISTORY_FIELD]: next })
      return res.status(200).json({ success: true, history: next, item: nextItem })
    }

    if (req.method === 'DELETE') {
      const id = getRequestId(req)
      const record = await readJsonBinRecord()
      const history = normalizeHistory(record[HISTORY_FIELD])
      const next = id ? history.filter((item) => item.id !== id) : []
      await writeJsonBinRecord({ ...record, [HISTORY_FIELD]: next })
      return res.status(200).json({ success: true, history: next })
    }

    return res.status(405).json({ error: 'Method Not Allowed' })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return res.status(500).json({ error: '旅行历史同步失败。', detail: message })
  }
}

async function readJsonBinRecord() {
  const { key, binId } = getJsonBinConfig()
  const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
    headers: { 'X-Master-Key': key }
  })
  if (!response.ok) throw new Error(`读取 JsonBin 失败：${response.status}`)
  const data = await response.json()
  return data.record && typeof data.record === 'object' ? data.record : {}
}

async function writeJsonBinRecord(record) {
  const { key, binId } = getJsonBinConfig()
  const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Master-Key': key },
    body: JSON.stringify(record)
  })
  if (!response.ok) throw new Error(`写入 JsonBin 失败：${response.status}`)
}

function getJsonBinConfig() {
  const key = process.env.JSONBIN_API_KEY
  const binId = process.env.JSONBIN_BIN_ID
  if (!key || !binId) throw new Error('缺少 JSONBIN_API_KEY 或 JSONBIN_BIN_ID。')
  return { key, binId }
}

function normalizeHistory(value) {
  return Array.isArray(value) ? value.filter((item) => item?.plan).slice(0, 24) : []
}

function getRequestId(req) {
  if (req.query?.id) return String(req.query.id)
  try {
    const url = new URL(req.url || '', 'http://local')
    return url.searchParams.get('id') || ''
  } catch {
    return ''
  }
}
