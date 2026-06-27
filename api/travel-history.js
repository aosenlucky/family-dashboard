import { LEGACY_TRAVEL_FIELD, TRAVEL_DETAILS_FIELD, TRAVEL_INDEX_FIELD, readTravelRecord, writeTravelRecord } from './_data-store.js'

const MAX_HISTORY_ITEMS = 60

export default async function handler(req, res) {
  const pin = process.env.SYSTEM_PASSWORD
  const authHeader = req.headers.authorization || ''
  if (pin && authHeader !== pin) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const record = await readTravelRecord()
    const state = normalizeTravelState(record)

    if (req.method === 'GET') {
      const id = getRequestId(req)
      if (id) {
        const item = state.details[id]
        if (!item) return res.status(404).json({ error: '没有找到这条历史行程。' })
        return res.status(200).json({ item })
      }
      return res.status(200).json({ history: state.index })
    }

    if (req.method === 'POST') {
      const item = req.body?.item
      if (!item?.plan) return res.status(400).json({ error: '缺少要保存的行程。' })

      const nextItem = {
        ...item,
        id: item.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        savedAt: item.savedAt || new Date().toISOString()
      }
      const nextSummary = summarizeTravelItem(nextItem)
      const nextIndex = [
        nextSummary,
        ...state.index.filter((saved) => saved.id !== nextSummary.id && (saved.destination !== nextSummary.destination || saved.dateRange !== nextSummary.dateRange))
      ].slice(0, MAX_HISTORY_ITEMS)
      const allowedIds = new Set(nextIndex.map((saved) => saved.id))
      const nextDetails = {
        ...Object.fromEntries(Object.entries(state.details).filter(([id]) => allowedIds.has(id))),
        [nextItem.id]: nextItem
      }

      await writeTravelState({ index: nextIndex, details: nextDetails })
      return res.status(200).json({ success: true, history: nextIndex, item: nextSummary })
    }

    if (req.method === 'DELETE') {
      const id = getRequestId(req)
      const nextIndex = id ? state.index.filter((item) => item.id !== id) : []
      const nextDetails = id
        ? Object.fromEntries(Object.entries(state.details).filter(([itemId]) => itemId !== id))
        : {}
      await writeTravelState({ index: nextIndex, details: nextDetails })
      return res.status(200).json({ success: true, history: nextIndex })
    }

    return res.status(405).json({ error: 'Method Not Allowed' })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return res.status(500).json({ error: '旅行历史同步失败。', detail: message })
  }
}

function normalizeTravelState(record = {}) {
  const details = record[TRAVEL_DETAILS_FIELD] && typeof record[TRAVEL_DETAILS_FIELD] === 'object'
    ? { ...record[TRAVEL_DETAILS_FIELD] }
    : {}
  const index = []

  for (const item of Array.isArray(record[TRAVEL_INDEX_FIELD]) ? record[TRAVEL_INDEX_FIELD] : []) {
    const summary = normalizeSummary(item)
    if (summary) index.push(summary)
  }

  for (const item of Array.isArray(record[LEGACY_TRAVEL_FIELD]) ? record[LEGACY_TRAVEL_FIELD] : []) {
    if (!item?.id && !item?.plan) continue
    const id = item.id || `${item.destination || 'trip'}-${item.savedAt || Date.now()}`
    const detail = { ...item, id }
    if (!details[id]) details[id] = detail
    const summary = summarizeTravelItem(detail)
    if (summary) index.push(summary)
  }

  for (const item of Object.values(details)) {
    const summary = summarizeTravelItem(item)
    if (summary) index.push(summary)
  }

  const seen = new Set()
  const normalizedIndex = index
    .filter((item) => {
      if (!item?.id || seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
    .sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')))
    .slice(0, MAX_HISTORY_ITEMS)

  return { index: normalizedIndex, details }
}

function normalizeSummary(item) {
  if (!item?.id) return null
  return {
    id: item.id,
    destination: item.destination || '未知目的地',
    dateRange: item.dateRange || '',
    savedAt: item.savedAt || '',
    activeVariant: item.activeVariant || 'classic',
    title: item.title || '',
    dayCount: Number(item.dayCount || 0),
    hotelName: item.hotelName || ''
  }
}

function summarizeTravelItem(item) {
  if (!item?.id) return null
  const plan = item.plan || {}
  const activeVariant = item.activeVariant || plan.plans?.[0]?.variant || 'classic'
  const activePlan = plan.plans?.find((entry) => entry.variant === activeVariant) || plan.plans?.[0]
  const firstHotel = item.form?.hotelStays?.[0]?.name || item.form?.hotelArea || ''
  return normalizeSummary({
    id: item.id,
    destination: item.destination || plan.meta?.destination || item.form?.destination,
    dateRange: item.dateRange || plan.meta?.dateRange || `${item.form?.startDate || ''} 至 ${item.form?.endDate || ''}`.trim(),
    savedAt: item.savedAt,
    activeVariant,
    title: activePlan?.title || '',
    dayCount: activePlan?.days?.length || 0,
    hotelName: firstHotel
  })
}

async function writeTravelState(state) {
  await writeTravelRecord({
    [TRAVEL_INDEX_FIELD]: state.index,
    [TRAVEL_DETAILS_FIELD]: state.details,
    [LEGACY_TRAVEL_FIELD]: []
  })
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
