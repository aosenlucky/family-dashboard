export const TRAVEL_INDEX_FIELD = 'travelHistoryIndex'
export const TRAVEL_DETAILS_FIELD = 'travelPlanDetails'
export const LEGACY_TRAVEL_FIELD = 'travelHistory'

const MAIN_KEY = 'main'
const TRAVEL_KEY = 'travel'

export function getStorageBackendName() {
  return hasSupabaseConfig() ? 'supabase' : 'jsonbin'
}

export async function readMainRecord() {
  if (hasSupabaseConfig()) return readSupabaseRecord(MAIN_KEY)
  return readJsonBinRecord(getJsonBinMainId())
}

export async function writeMainRecord(record) {
  if (hasSupabaseConfig()) return writeSupabaseRecord(MAIN_KEY, record)

  const mainBinId = getJsonBinMainId()
  if (process.env.JSONBIN_TRAVEL_BIN_ID) return writeJsonBinRecord(mainBinId, record)

  const current = await readJsonBinRecord(mainBinId).catch(() => ({}))
  return writeJsonBinRecord(mainBinId, {
    ...record,
    ...pickTravelFields(current)
  })
}

export async function readTravelRecord() {
  if (hasSupabaseConfig()) return readSupabaseRecord(TRAVEL_KEY)
  if (process.env.JSONBIN_TRAVEL_BIN_ID) return readJsonBinRecord(process.env.JSONBIN_TRAVEL_BIN_ID)
  return pickTravelFields(await readJsonBinRecord(getJsonBinMainId()))
}

export async function writeTravelRecord(record) {
  if (hasSupabaseConfig()) return writeSupabaseRecord(TRAVEL_KEY, record)
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
    version: 2,
    exportedAt: new Date().toISOString(),
    storageBackend: getStorageBackendName(),
    main,
    travel
  }
}

export async function restoreFullBackup(backup) {
  if (!backup || typeof backup !== 'object') throw new Error('备份文件格式不正确。')
  const main = backup.main && typeof backup.main === 'object' ? backup.main : null
  const travel = backup.travel && typeof backup.travel === 'object' ? backup.travel : null
  if (!main && !travel) throw new Error('备份文件里没有可恢复的数据。')
  if (main) await writeMainRecord(main)
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

function hasSupabaseConfig() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

function getSupabaseConfig() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const table = process.env.SUPABASE_TABLE || 'family_records'
  if (!url || !key) throw new Error('缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY。')
  return { url, key, table }
}

async function readSupabaseRecord(key) {
  const config = getSupabaseConfig()
  const response = await fetch(`${config.url}/rest/v1/${config.table}?key=eq.${encodeURIComponent(key)}&select=value`, {
    headers: supabaseHeaders(config)
  })
  if (!response.ok) throw new Error(`读取 Supabase 失败：${response.status} ${await response.text()}`)
  const rows = await response.json()
  return rows?.[0]?.value && typeof rows[0].value === 'object' ? rows[0].value : {}
}

async function writeSupabaseRecord(key, value) {
  const config = getSupabaseConfig()
  const response = await fetch(`${config.url}/rest/v1/${config.table}?on_conflict=key`, {
    method: 'POST',
    headers: {
      ...supabaseHeaders(config),
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() })
  })
  if (!response.ok) throw new Error(`写入 Supabase 失败：${response.status} ${await response.text()}`)
}

function supabaseHeaders(config) {
  return {
    apikey: config.key,
    Authorization: `Bearer ${config.key}`
  }
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
