import { randomUUID } from 'node:crypto'
import { validateCoupons, validateCouponTrash } from '../src/features/coupons/model.js'
import { validateFoods, validateFoodTrash } from '../src/features/food/model.js'
import { hasPreviewStore, previewTransaction } from '../server/preview-store.js'
import { REVISION_FIELD, mergeMain, visibleMain, redactSecrets, requireRevision, fail } from './_family-security.js'

export const TRAVEL_INDEX_FIELD = 'travelHistoryIndex'
export const TRAVEL_DETAILS_FIELD = 'travelPlanDetails'
export const LEGACY_TRAVEL_FIELD = 'travelHistory'

const MAIN_KEY = 'main'
const KEEPALIVE_KEY = '__system_keepalive__'
const MAIN_TABLE = process.env.SUPABASE_MAIN_TABLE || process.env.SUPABASE_TABLE || 'family_records'
const TRAVEL_INDEX_TABLE = process.env.SUPABASE_TRAVEL_INDEX_TABLE || 'travel_history_index'
const TRAVEL_DETAILS_TABLE = process.env.SUPABASE_TRAVEL_DETAILS_TABLE || 'travel_plan_details'
const SENSITIVE_MAIN_FIELDS = new Set(['wealthPassword'])

export function getStorageBackendName() {
  if (hasPreviewStore()) return 'local-preview'
  return hasSupabaseConfig() ? 'supabase' : 'jsonbin'
}

export function hasSupabaseConfig() {
  if (hasPreviewStore()) return false
  return Boolean(process.env.SUPABASE_URL && getSupabaseKey())
}

export async function pingSupabase() {
  const config = getSupabaseConfig()
  const checkedAt = new Date().toISOString()
  const checks = [
    [config.mainTable, 'key'],
    [config.travelIndexTable, 'id'],
    [config.travelDetailsTable, 'id']
  ]

  await Promise.all([
    ...checks.map(([table, column]) => supabaseJson(config, `${table}?select=${column}&limit=1`)),
    supabaseJson(config, `${config.mainTable}?on_conflict=key`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        key: KEEPALIVE_KEY,
        value: { lastSeenAt: checkedAt },
        updated_at: checkedAt
      })
    })
  ])

  return { databaseRequests: checks.length + 1, databaseWrites: 1 }
}

export async function readMainRecord() {
  if (hasPreviewStore()) return previewTransaction((state) => sanitizeMainRecord(state.records.main?.value || {}), { write: false })
  const record = hasSupabaseConfig() ? await readSupabaseMainRecord() : await readJsonBinRecord(getJsonBinMainId())
  return sanitizeMainRecord(record)
}

export async function writeMainRecord(record, revision, { wealthUnlocked = false } = {}) {
  requireRevision(revision)
  if (hasPreviewStore()) return previewTransaction((state) => {
    const current = state.records.main?.value || {}
    checkRevision(current, revision)
    const value = { ...mergeMain(record, current, wealthUnlocked), [REVISION_FIELD]: revision + 1 }
    state.records.main = { key: MAIN_KEY, value, updated_at: new Date().toISOString() }
    return snapshot(value)
  })
  if (!hasSupabaseConfig()) fail(503, '当前存储不支持并发版本校验，暂不可保存。请使用 Supabase。')
  const config = getSupabaseConfig()
  const rows = await supabaseJson(config, `${config.mainTable}?key=eq.main&select=value&limit=1`)
  const current = rows?.[0]?.value || {}
  checkRevision(current, revision)
  const value = { ...mergeMain(record, current, wealthUnlocked), [REVISION_FIELD]: revision + 1 }
  const row = { key: MAIN_KEY, value, updated_at: new Date().toISOString() }
  if (!rows?.length) {
    try {
      await supabaseJson(config, config.mainTable, { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) })
    } catch (error) { if (error.status === 409) throw conflict(await readMainRecord()); throw error }
  } else {
    const filter = revision === 0
      ? `or=(value->>${REVISION_FIELD}.is.null,value->>${REVISION_FIELD}.eq.0)`
      : `value->>${REVISION_FIELD}=eq.${revision}`
    const updated = await supabaseJson(config, `${config.mainTable}?key=eq.main&${filter}`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ value, updated_at: row.updated_at })
    })
    if (!updated?.length) throw conflict(await readMainRecord())
  }
  return snapshot(value)
}

export function snapshot(record = {}) {
  const revision = record[REVISION_FIELD] ?? 0
  if (!Number.isSafeInteger(revision) || revision < 0) fail(503, '服务器数据版本无效，请先检查存储。')
  const { [REVISION_FIELD]: _revision, ...value } = record
  return { record: value, revision }
}
export async function readMainSnapshot() { return snapshot(await readMainRecord()) }
function conflict(record) { return Object.assign(new Error('其他设备已保存新内容，请检查最新版本后重试。'), { status: 409, ...snapshot(record) }) }
function checkRevision(record, revision) { if (snapshot(record).revision !== revision) throw conflict(record) }

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
  const nextItem = normalizeTravelDetail(item)
  const summary = summarizeTravelItem(nextItem)
  const limit = Math.max(1, Math.min(Number.isSafeInteger(maxItems) ? maxItems : 60, 500))
  if (hasPreviewStore()) return previewTransaction((store) => {
    const state = normalizeTravelState(store.travel || {})
    const index = [summary, ...state.index.filter((saved) => saved.id !== summary.id)]
      .sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || ''))).slice(0, limit)
    const allowed = new Set(index.map((saved) => saved.id))
    const details = Object.fromEntries(Object.entries({ ...state.details, [nextItem.id]: nextItem }).filter(([id]) => allowed.has(id)))
    store.travel = { [TRAVEL_INDEX_FIELD]: index, [TRAVEL_DETAILS_FIELD]: details, [LEGACY_TRAVEL_FIELD]: [] }
    return { summary, index, detail: nextItem, revision: advancePreviewRevision(store) }
  })
  if (!hasSupabaseConfig()) fail(503, '当前存储不支持原子旅行保存，请使用 Supabase。')
  return familyRpc('family_travel_mutate', { p_action: 'save', p_detail: nextItem, p_summary: summary, p_id: nextItem.id, p_limit: limit })
}

function advancePreviewRevision(store) {
  const current = store.records.main?.value || {}
  const revision = snapshot(current).revision + 1
  store.records.main = { key: MAIN_KEY, value: { ...current, [REVISION_FIELD]: revision }, updated_at: new Date().toISOString() }
  return revision
}

async function familyRpc(name, args = {}) {
  const config = getSupabaseConfig()
  try {
    return await supabaseJson(config, `rpc/${name}`, { method: 'POST', body: JSON.stringify({
      p_main_table: config.mainTable, p_index_table: config.travelIndexTable, p_detail_table: config.travelDetailsTable, ...args
    }) })
  } catch (error) {
    if (error.status === 404) fail(503, '尚未安装完整的数据安全事务，请先执行 supabase/personal-restore.sql。未更改任何数据。')
    throw error
  }
}

export async function deleteTravelItem(id) {
  if (hasPreviewStore()) return previewTransaction((store) => {
    const state = normalizeTravelState(store.travel || {})
    const index = id ? state.index.filter((item) => item.id !== id) : []
    const details = id ? Object.fromEntries(Object.entries(state.details).filter(([itemId]) => itemId !== id)) : {}
    store.travel = { [TRAVEL_INDEX_FIELD]: index, [TRAVEL_DETAILS_FIELD]: details, [LEGACY_TRAVEL_FIELD]: [] }
    return { index, revision: advancePreviewRevision(store) }
  })
  if (!hasSupabaseConfig()) fail(503, '当前存储不支持原子旅行删除，请使用 Supabase。')
  return familyRpc('family_travel_mutate', { p_action: 'delete', p_detail: null, p_summary: null, p_id: id || '', p_limit: 60 })
}

export async function readTravelRecord() {
  if (hasPreviewStore()) return previewTransaction((state) => state.travel || {}, { write: false })
  if (hasSupabaseConfig()) return readSupabaseTravelRecord()
  if (process.env.JSONBIN_TRAVEL_BIN_ID) return readJsonBinRecord(process.env.JSONBIN_TRAVEL_BIN_ID)
  return pickTravelFields(await readJsonBinRecord(getJsonBinMainId()))
}

export async function writeTravelRecord(record) {
  fail(428, '整库写入需要使用带版本校验的完整恢复。')
}

export async function readFullBackup() {
  let consistent
  if (hasPreviewStore()) consistent = await previewTransaction((state) => ({ record: state.records.main?.value || {}, travel: state.travel || {} }), { write: false })
  else {
    if (!hasSupabaseConfig()) fail(503, '当前存储不支持一致性完整备份，请使用 Supabase。')
    consistent = await familyRpc('family_read_snapshot')
  }
  const { record, revision } = snapshot(consistent.record)
  const travel = consistent.travel
  return {
    version: 4,
    exportedAt: new Date().toISOString(),
    storageBackend: getStorageBackendName(),
    revision,
    main: visibleMain(record, true),
    travel: redactSecrets(travel),
    mediaOrigins: getMediaOrigins()
  }
}

export function getMediaOrigins() {
  if (hasPreviewStore()) return []
  const origins = new Set()
  const candidates = [process.env.OBS_PUBLIC_URL, process.env.OBS_CDN_URL]
  if (process.env.OBS_BUCKET_NAME && process.env.OBS_ENDPOINT) {
    try {
      const endpoint = new URL(process.env.OBS_ENDPOINT.includes('://') ? process.env.OBS_ENDPOINT : `https://${process.env.OBS_ENDPOINT}`)
      candidates.push(`https://${process.env.OBS_BUCKET_NAME}.${endpoint.hostname}`)
    } catch { /* Invalid storage configuration is not a trusted media source. */ }
  }
  for (const candidate of candidates.filter(Boolean)) {
    try { const url = new URL(candidate); if (url.protocol === 'https:' && !url.username && !url.password) origins.add(url.origin) } catch { /* ignore */ }
  }
  return [...origins]
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
    main: sanitizeMainRecord(removeTravelFields(main)),
    travel
  }
}

export async function restoreFullBackup(backup, revision, { restorePointId } = {}) {
  requireRevision(revision)
  if (!restorePointId) validateBackup(backup)
  if (restorePointId && !/^restore-[a-f0-9-]{36}$/.test(restorePointId)) fail(400, '恢复点无效。')
  const pointId = `restore-${randomUUID()}`
  if (hasPreviewStore()) return previewTransaction((state) => {
    const current = state.records.main?.value || {}
    checkRevision(current, revision)
    const target = restorePointId ? state.records[restorePointId]?.value : backup
    validateBackup(target)
    state.records[pointId] = { key: pointId, value: { version: 4, main: visibleMain(current, true), travel: state.travel || {}, exportedAt: new Date().toISOString() } }
    const value = { ...mergeMain(removeTravelFields(target.main), current, true), [REVISION_FIELD]: revision + 1 }
    state.records.main = { key: MAIN_KEY, value, updated_at: new Date().toISOString() }
    state.travel = target.travel || {}
    return { revision: revision + 1, restorePointId: pointId, mainRestored: true, travelRestored: true }
  })
  if (!hasSupabaseConfig()) fail(503, '当前存储不支持原子恢复，请使用 Supabase。')
  const config = getSupabaseConfig()
  try {
    const result = await supabaseJson(config, 'rpc/family_restore_snapshot', { method: 'POST', body: JSON.stringify({
      p_main_table: config.mainTable, p_index_table: config.travelIndexTable, p_detail_table: config.travelDetailsTable,
      p_backup: restorePointId ? null : { ...backup, main: visibleMain(removeTravelFields(backup.main), true), travel: travelForRestore(backup.travel) },
      p_revision: revision, p_point_id: pointId, p_rollback_id: restorePointId || null
    }) })
    if (result?.conflict) throw conflict(result.current || {})
    return result
  } catch (error) {
    if (error.status === 404) fail(503, '尚未安装安全恢复事务，请先执行 supabase/personal-restore.sql。未更改任何数据。')
    throw error
  }
}

export function validateBackup(backup) {
  if (!backup || typeof backup !== 'object' || Array.isArray(backup) || !backup.main || typeof backup.main !== 'object' || Array.isArray(backup.main) || !backup.travel || typeof backup.travel !== 'object' || Array.isArray(backup.travel)) fail(400, '备份必须包含完整 main 和 travel 对象。')
  if (![3, 4].includes(backup.version)) fail(400, '备份版本不受支持。')
  if (Buffer.byteLength(JSON.stringify(backup)) > 32 * 1024 * 1024) fail(413, '备份数据超过 32 MB。')
  const main = backup.main
  try { validateCoupons(main.coupons); validateCouponTrash(main.trash); validateFoods(main.foodPlaces); validateFoodTrash(main.trash) } catch (error) { fail(400, error.message) }
  const photos = Array.isArray(main.photos) ? main.photos.length : Array.isArray(main.gallery) ? main.gallery.length : 0
  return { photos, coupons: (main.coupons || []).length, foodPlaces: (main.foodPlaces || []).length, moments: (main.moments || main.ourMoments || []).length || 0, todos: (main.todos || []).length || 0, travel: normalizeTravelState(backup.travel).index.length }
}
function travelForRestore(travel) {
  const state = normalizeTravelState(travel)
  return { travelHistory: [], travelHistoryIndex: state.index, travelPlanDetails: state.details }
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
  const details = {}
  const index = []

  for (const item of Array.isArray(record[TRAVEL_INDEX_FIELD]) ? record[TRAVEL_INDEX_FIELD] : []) {
    const summary = normalizeSummary(item)
    if (summary) index.push(summary)
  }

  for (const item of Array.isArray(record[LEGACY_TRAVEL_FIELD]) ? record[LEGACY_TRAVEL_FIELD] : []) {
    if (!item?.id && !item?.plan) continue
    const detail = normalizeTravelDetail(item)
    details[detail.id] = detail
    const summary = summarizeTravelItem(detail)
    if (summary) index.push(summary)
  }

  const rawDetails = record[TRAVEL_DETAILS_FIELD] && typeof record[TRAVEL_DETAILS_FIELD] === 'object'
    ? record[TRAVEL_DETAILS_FIELD]
    : {}
  for (const [key, item] of Object.entries(rawDetails)) {
    if (!item || typeof item !== 'object') continue
    const detail = normalizeTravelDetail({ ...item, id: item.id || key })
    details[detail.id] = detail
    const summary = summarizeTravelItem(detail)
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

  const allowedIds = new Set(normalizedIndex.map((item) => item.id))
  const normalizedDetails = Object.fromEntries(
    Object.entries(details).filter(([id, item]) => allowedIds.has(id) && item?.id === id)
  )

  return { index: normalizedIndex, details: normalizedDetails }
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

export function sanitizeMainRecord(record = {}) {
  if (!record || typeof record !== 'object') return {}
  return Object.fromEntries(Object.entries(record).filter(([key]) => !SENSITIVE_MAIN_FIELDS.has(key)))
}

async function readSupabaseMainRecord() {
  const config = getSupabaseConfig()
  const rows = await supabaseJson(config, `${config.mainTable}?key=eq.${encodeURIComponent(MAIN_KEY)}&select=value&limit=1`)
  return rows?.[0]?.value && typeof rows[0].value === 'object' ? rows[0].value : {}
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

async function readSupabaseTravelRecord() {
  return (await familyRpc('family_read_snapshot')).travel
}

export function getSupabaseConfig() {
  if (hasPreviewStore()) fail(503, '隔离预览不能访问真实云数据库。')
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
  if (!response.ok) {
    const detail = await response.text()
    const method = options.method || 'GET'
    throw Object.assign(new Error(`Supabase 请求失败（${method} ${path}）：${response.status} ${detail || response.statusText}`), { status: response.status })
  }
  if (response.status === 204) return null
  const text = await response.text()
  return text ? JSON.parse(text) : null
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
