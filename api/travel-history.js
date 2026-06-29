import { deleteTravelItem, getTravelDetail, listTravelSummaries, saveTravelItem } from './_data-store.js'

const MAX_HISTORY_ITEMS = 60

export default async function handler(req, res) {
  const pin = process.env.SYSTEM_PASSWORD
  const authHeader = req.headers.authorization || ''
  if (pin && authHeader !== pin) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    if (req.method === 'GET') {
      const id = getRequestId(req)
      if (id) {
        const item = await getTravelDetail(id)
        if (!item) return res.status(404).json({ error: '没有找到这条历史行程。' })
        return res.status(200).json({ item })
      }
      return res.status(200).json({ history: await listTravelSummaries(MAX_HISTORY_ITEMS) })
    }

    if (req.method === 'POST') {
      const item = req.body?.item
      if (!item?.plan) return res.status(400).json({ error: '缺少要保存的行程。' })
      const saved = await saveTravelItem(item, MAX_HISTORY_ITEMS)
      return res.status(200).json({ success: true, history: saved.index, item: saved.summary })
    }

    if (req.method === 'DELETE') {
      const history = await deleteTravelItem(getRequestId(req))
      return res.status(200).json({ success: true, history })
    }

    return res.status(405).json({ error: 'Method Not Allowed' })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return res.status(500).json({ error: '旅行历史同步失败。', detail: message })
  }
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
