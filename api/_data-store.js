export const TRAVEL_INDEX_FIELD = 'travelHistoryIndex'
export const TRAVEL_DETAILS_FIELD = 'travelPlanDetails'
export const LEGACY_TRAVEL_FIELD = 'travelHistory'

const MAIN_KEY = 'main'
const MAIN_TABLE = process.env.SUPABASE_MAIN_TABLE || process.env.SUPABASE_TABLE || 'family_records'
const TRAVEL_INDEX_TABLE = process.env.SUPABASE_TRAVEL_INDEX_TABLE || 'travel_history_index'
const TRAVEL_DETAILS_TABLE = process.env.SUPABASE_TRAVEL_DETAILS_TABLE || 'travel_plan_details'

export function getStorageBackendName() {
  return hasSupabaseConfig() ? 'supabase' : 'jsonbin'
}

export function hasSupabaseConfig() {
  return Boolean(process.env.SUPABASE_URL && getSupabaseKey())
}

export async function readMainRecord() {
  if (hasSupabaseConfig()) return readSupabaseMainRecord()
  return readJsonBinRecord(getJsonBinMainId())
}

export async function writeMainRecord(record) {
  if (hasSupabaseConfig()) return writeSupabaseMainRecord(record)

  const mainBinId = getJsonBinMainId()
  if (process.env.JSONBIN_TRAVEL_BIN_ID) return writeJsonBinRecord(mainBinId, record)

  const current = await readJsonBinRecord(mainBinId).catch(() => ({}))
  return writeJsonBinRecord(mainBinId, {
    ...record,
    ...pickTravelFields(current)
  })
}

export async function listTravelSummaries(limit = 60) {
  if (hasSupabaseConfig()) return listSupabaseTravelSummaries(limit)
  return normalizeTravelState(await readTravelRecord()).index.slice(0, limit)
}

export async function getTravelDetail(id) {
  if (!id) return null
  if (hasSupabaseConfig()) return getSupabaseTravelDetail(id)
  return normalizeTravelState(await readTravelRecord()).details[id] || null
}

export async function saveTravelItem(item, maxItems = 60) {
  if (hasSupabaseConfig()) return saveSupabaseTravelItem(item, maxItems)
  const state = normalizeTravelState(await readTravelRecord())
  const nextItem = normalizeTravelDetail(item)
  const summary = summarizeTravelItem(nextItem)
  const index = [
    summary,
    ...state.index.filter((saved) => saved.id !== summary.id && (saved.destination !== summary.destination || saved.dateRange !== summary.dateRange))
  ].slice(0, maxItems)
  const allowedIds = new Set(index.map((saved) => saved.id))
  const details = {
    ...Object.fromEntries(Object.entries(state.details).filter(([id]) => allowedIds.has(id))),
    [nextItem.id]: nextItem
  }
  await writeTravelRecordFromState({ index, details })
  return { summary, index, detail: nextItem }
}

export async function deleteTravelItem(id) {
  if (hasSupabaseConfig()) return deleteSupabaseTravelItem(id)
  const state = normalizeTravelState(await readTravelRecord())
  const index = id ? state.index.filter((item) => item.id !== id) : []
  const details = id ? Object.fromEntries(Object.entries(state.details).filter(([itemId]) => itemId !== id)) : {}
  await writeTravelRecordFromState({ index, details })
  return index
}

export async function readTravelRecord() {
  if (hasSupabaseConfig()) return readSupabaseTravelRecord()
  if (process.env.JSONBIN_TRAVEL_BIN_ID) return readJsonBinRecord(process.env.JSONBIN_TRAVEL_BIN_ID)
  return pickTravelFields(await readJsonBinRecord(getJsonBinMainId()))
}

export async function writeTravelRecord(record) {
  if (hasSupabaseConfig()) return replaceSupabaseTravelRecord(record)
  if (process.env.JSONBIN_TRAVEL_BIN_ID) return writeJsonBinRecord(process.env.JSONBIN_TRAVEL_BIN_ID, record)

  const mainBinId = getJsonBinMainId()
  const current = await readJsonBinRecord(mainBinId).catch(() => ({}))
  return writeJsonBinRecord(mainBinId, {
    ...current,
    ...record
  })
}

export async function readFullBackup() {
  const [main, travel] = await Promise.all([readMainRecord(), readTravelRecord()])
  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    storageBackend: getStorageBackendName(),
    main,
    travel
  }
}

export async function readJsonBinFullBackup() {
  const main = await readJsonBinRecord(getJsonBinMainId())
  const travel = process.env.JSONBIN_TRAVEL_BIN_ID
    ? await readJsonBinRecord(process.env.JSONBIN_TRAVEL_BIN_ID)
    : pickTravelFields(main)
  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    storageBackend: 'jsonbin',
    main: removeTravelFields(main),
    travel
  }
}

export async function restoreFullBackup(backup) {
  if (!backup || typeof backup !== 'object') throw new Error('备份文件格式不正确。')
  const main = backup.main && typeof backup.main === 'object' ? backup.main : null
  const travel = backup.travel && typeof backup.travel === 'object' ? backup.travel : null
  if (!main && !travel) throw new Error('备份文件里没有可恢复的数据。')
  if (main) await writeMainRecord(removeTravelFields(main))
  if (travel) await writeTravelRecord(travel)
  return { mainRestored: Boolean(main), travelRestored: Boolean(travel) }
}

export function pickTravelFields(record = {}) {
  return {
    [LEGACY_TRAVEL_FIELD]: Array.isArray(record[LEGACY_TRAVEL_FIELD]) ? record[LEGACY_TRAVEL_FIELD] : [],
    [TRAVEL_INDEX_FIELD]: Array.isArray(record[TRAVEL_INDEX_FIELD]) ? record[TRAVEL_INDEX_FIELD] : [],
    [TRAVEL_DETAILS_FIELD]: record[TRAVEL_DETAILS_FIELD] && typeof record[TRAVEL_DETAILS_FIELD] === 'object'
      ? record[TRAVEL_DETAILS_FIELD]
      : {}
  }
}

export function normalizeTravelState(record = {}) {
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
    const detail = normalizeTravelDetail(item)
    if (!details[detail.id]) details[detail.id] = detail
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

  return { index: normalizedIndex, details }
}

export function normalizeTravelDetail(item = {}) {
  return {
    ...item,
    id: item.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    savedAt: item.savedAt || new Date().toISOString()
  }
}

export function summarizeTravelItem(item) {
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

function removeTravelFields(record = {}) {
  const { [LEGACY_TRAVEL_FIELD]: _legacy, [TRAVEL_INDEX_FIELD]: _index, [TRAVEL_DETAILS_FIELD]: _details, ...rest } = record
  return rest
}

async function writeTravelRecordFromState(state) {
  return writeTravelRecord({
    [TRAVEL_INDEX_FIELD]: state.index,
    [TRAVEL_DETAILS_FIELD]: state.details,
    [LEGACY_TRAVEL_FIELD]: []
  })
}

async function readSupabaseMainRecord() {
  const config = getSupabaseConfig()
  const rows = await supabaseJson(config, `${config.mainTable}?key=eq.${encodeURIComponent(MAIN_KEY)}&select=value&limit=1`)
  return rows?.[0]?.value && typeof rows[0].value === 'object' ? rows[0].value : {}
}

async function writeSupabaseMainRecord(value) {
  const config = getSupabaseConfig()
  await supabaseJson(config, `${config.mainTable}?on_conflict=key`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ key: MAIN_KEY, value, updated_at: new Date().toISOString() })
  })
}

async function listSupabaseTravelSummaries(limit) {
  const config = getSupabaseConfig()
  const rows = await supabaseJson(config, `${config.travelIndexTable}?select=summary&order=saved_at.desc&limit=${encodeURIComponent(limit)}`)
  return (rows || []).map((row) => normalizeSummary(row.summary)).filter(Boolean)
}

async function getSupabaseTravelDetail(id) {
  const config = getSupabaseConfig()
  const rows = await supabaseJson(config, `${config.travelDetailsTable}?id=eq.${encodeURIComponent(id)}&select=item&limit=1`)
  return rows?.[0]?.item || null
}

async function saveSupabaseTravelItem(item, maxItems) {
  const config = getSupabaseConfig()
  const detail = normalizeTravelDetail(item)
  const summary = summarizeTravelItem(detail)
  const savedAt = safeTimestamp(summary.savedAt)

  await supabaseJson(config, `${config.travelIndexTable}?on_conflict=id`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      id: summary.id,
      destination: summary.destination,
      date_range: summary.dateRange,
      saved_at: savedAt,
      active_variant: summary.activeVariant,
      title: summary.title,
      day_count: summary.dayCount,
      hotel_name: summary.hotelName,
      summary,
      updated_at: new Date().toISOString()
    })
  })

  await supabaseJson(config, `${config.travelDetailsTable}?on_conflict=id`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      id: detail.id,
      item: detail,
      saved_at: savedAt,
      updated_at: new Date().toISOString()
    })
  })

  await pruneSupabaseTravel(config, maxItems)
  return { summary, index: await listSupabaseTravelSummaries(maxItems), detail }
}

async function deleteSupabaseTravelItem(id) {
  const config = getSupabaseConfig()
  if (id) {
    await Promise.all([
      supabaseJson(config, `${config.travelIndexTable}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' }),
      supabaseJson(config, `${config.travelDetailsTable}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' })
    ])
    return listSupabaseTravelSummaries(60)
  }

  await Promise.all([
    supabaseJson(config, `${config.travelIndexTable}?id=not.is.null`, { method: 'DELETE' }),
    supabaseJson(config, `${config.travelDetailsTable}?id=not.is.null`, { method: 'DELETE' })
  ])
  return []
}

async function pruneSupabaseTravel(config, maxItems) {
  const rows = await supabaseJson(config, `${config.travelIndexTable}?select=id&order=saved_at.desc&offset=${encodeURIComponent(maxItems)}`)
  const ids = (rows || []).map((row) => row.id).filter(Boolean)
  if (!ids.length) return
  const filter = `id=in.(${ids.map((id) => `"${String(id).replaceAll('"', '\\"')}"`).join(',')})`
  await Promise.all([
    supabaseJson(config, `${config.travelIndexTable}?${filter}`, { method: 'DELETE' }),
    supabaseJson(config, `${config.travelDetailsTable}?${filter}`, { method: 'DELETE' })
  ])
}

async function readSupabaseTravelRecord() {
  const config = getSupabaseConfig()
  const [indexRows, detailRows] = await Promise.all([
    supabaseJson(config, `${config.travelIndexTable}?select=summary&order=saved_at.desc&limit=500`),
    supabaseJson(config, `${config.travelDetailsTable}?select=id,item&order=saved_at.desc&limit=500`)
  ])
  return {
    [TRAVEL_INDEX_FIELD]: (indexRows || []).map((row) => normalizeSummary(row.summary)).filter(Boolean),
    [TRAVEL_DETAILS_FIELD]: Object.fromEntries((detailRows || []).filter((row) => row.id && row.item).map((row) => [row.id, row.item])),
    [LEGACY_TRAVEL_FIELD]: []
  }
}

async function replaceSupabaseTravelRecord(record) {
  const config = getSupabaseConfig()
  const state = normalizeTravelState(record)
  await deleteSupabaseTravelItem('')
  const summaries = state.index
  const details = state.details

  if (summaries.length) {
    await supabaseJson(config, `${config.travelIndexTable}?on_conflict=id`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(summaries.map((summary) => ({
        id: summary.id,
        destination: summary.destination,
        date_range: summary.dateRange,
        saved_at: safeTimestamp(summary.savedAt),
        active_variant: summary.activeVariant,
        title: summary.title,
        day_count: summary.dayCount,
        hotel_name: summary.hotelName,
        summary,
        updated_at: new Date().toISOString()
      })))
    })
  }

  if (Object.keys(details).length) {
    await supabaseJson(config, `${config.travelDetailsTable}?on_conflict=id`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(Object.values(details).map((item) => ({
        id: item.id,
        item,
        saved_at: safeTimestamp(item.savedAt),
        updated_at: new Date().toISOString()
      })))
    })
  }
}

function getSupabaseConfig() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '')
  const key = getSupabaseKey()
  if (!url || !key) throw new Error('缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY。')
  return {
    url,
    key,
    mainTable: MAIN_TABLE,
    travelIndexTable: TRAVEL_INDEX_TABLE,
    travelDetailsTable: TRAVEL_DETAILS_TABLE
  }
}

function getSupabaseKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || ''
}

async function supabaseJson(config, path, options = {}) {
  const headers = {
    apikey: config.key,
    Authorization: `Bearer ${config.key}`,
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {})
  }
  const response = await fetch(`${config.url}/rest/v1/${path}`, { ...options, headers })
  if (!response.ok) throw new Error(`Supabase 请求失败：${response.status} ${await response.text()}`)
  if (response.status === 204) return null
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

function safeTimestamp(value) {
  const date = value ? new Date(value) : new Date()
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

function getJsonBinMainId() {
  const binId = process.env.JSONBIN_BIN_ID
  if (!process.env.JSONBIN_API_KEY || !binId) throw new Error('缺少 JSONBIN_API_KEY 或 JSONBIN_BIN_ID。')
  return binId
}

async function readJsonBinRecord(binId) {
  const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
    headers: { 'X-Master-Key': process.env.JSONBIN_API_KEY }
  })
  if (!response.ok) throw new Error(`读取 JsonBin 失败：${response.status} ${await response.text()}`)
  const data = await response.json()
  return data.record && typeof data.record === 'object' ? data.record : {}
}

async function writeJsonBinRecord(binId, record) {
  const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Master-Key': process.env.JSONBIN_API_KEY },
    body: JSON.stringify(record)
  })
  if (!response.ok) throw new Error(`写入 JsonBin 失败：${response.status} ${await response.text()}`)
}
