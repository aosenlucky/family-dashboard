import { createHmac, timingSafeEqual } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { validateCoupons, validateCouponTrash } from '../src/features/coupons/model.js'
import { validateFoods, validateFoodTrash } from '../src/features/food/model.js'

export const REVISION_FIELD = '_familyRevision'
export const WEALTH_FIELDS = new Set(['salaryBank', 'salaryDay', 'usdRate', 'loans', 'transfers', 'assets', 'stocks', 'equity', 'paymentChecks', 'wealthSettings'])
const SECRET_FIELDS = new Set(['llmApiKey', 'wealthPassword', REVISION_FIELD])
const PRIVATE_KEY = /^(?:.*(?:password|secret|apikey|accesskey|accesstoken|authtoken)|token|privateDiary|privateDiaries|diaryVault|diary|diaries|diaryPassword|recoveryCode)$/i
export const fail = (status, message) => { throw Object.assign(new Error(message), { status }) }
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b))

export function requireFamily(req, { allowDemo = false } = {}) {
  const pin = process.env.SYSTEM_PASSWORD
  if (!pin) fail(503, '家庭访问尚未配置，请设置 SYSTEM_PASSWORD。')
  const authorization = req.headers?.authorization || ''
  if (same(authorization, pin)) return 'real'
  if (allowDemo && process.env.DEMO_PASSWORD && same(authorization, process.env.DEMO_PASSWORD)) return 'demo'
  fail(401, '请先打开家门。')
}

function signingKey(mode) {
  return createHmac('sha256', process.env.WEALTH_TOKEN_SECRET || process.env.SYSTEM_PASSWORD || '')
    .update(`family-wealth-v1:${mode}:${process.env.WEALTH_PASSWORD || ''}:${process.env.DEMO_WEALTH_PASSWORD || ''}`).digest()
}
export function createWealthToken(mode = 'real') {
  const expiresAt = Date.now() + 15 * 60 * 1000
  const payload = Buffer.from(JSON.stringify({ scope: 'family-wealth', mode, expiresAt })).toString('base64url')
  const signature = createHmac('sha256', signingKey(mode)).update(payload).digest('base64url')
  return { token: `${payload}.${signature}`, expiresAt }
}
export function isWealthUnlocked(req, mode = 'real') {
  const token = req.headers?.['x-wealth-token']
  if (typeof token !== 'string' || token.length > 1024 || !process.env.SYSTEM_PASSWORD) return false
  try {
    const [payload, signature, extra] = token.split('.')
    if (extra || !same(signature, createHmac('sha256', signingKey(mode)).update(payload).digest('base64url'))) return false
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return value.scope === 'family-wealth' && value.mode === mode && Number.isSafeInteger(value.expiresAt) && value.expiresAt > Date.now()
  } catch { return false }
}
export function requireWealth(req, mode = 'real') {
  if (!isWealthUnlocked(req, mode)) fail(403, '请先解锁家庭理财，再进行完整备份或恢复。')
}
export function isFinanceEntry(item, collection) {
  if (!item || typeof item !== 'object') return false
  if (collection === 'todos') return item.sourceType === 'loan-transfer' || String(item.sourceKey || '').startsWith('loan-transfer:')
  if (collection === 'trash') return WEALTH_FIELDS.has(item.collection) || (item.collection === 'todos' && isFinanceEntry(item.item, 'todos'))
  return false
}
export function visibleMain(record = {}, wealthUnlocked = false) {
  const visible = Object.fromEntries(Object.entries(record).filter(([key]) => !SECRET_FIELDS.has(key) && (wealthUnlocked || !WEALTH_FIELDS.has(key))))
  if (!wealthUnlocked) {
    for (const collection of ['todos', 'trash']) {
      if (Array.isArray(visible[collection])) visible[collection] = visible[collection].filter((item) => !isFinanceEntry(item, collection))
    }
  }
  return redactSecrets(visible)
}
export function redactSecrets(value) {
  if (Array.isArray(value)) return value.map(redactSecrets)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).filter(([key]) => !PRIVATE_KEY.test(key)).map(([key, child]) => [key, redactSecrets(child)]))
}
export function mergeMain(incoming, current, wealthUnlocked) {
  if (!incoming || Array.isArray(incoming) || typeof incoming !== 'object') fail(400, '记录格式不正确。')
  try { validateCoupons(incoming.coupons); validateCouponTrash(incoming.trash); validateFoods(incoming.foodPlaces); validateFoodTrash(incoming.trash) } catch (error) { fail(400, error.message) }
  if (!wealthUnlocked) {
    for (const field of WEALTH_FIELDS) {
      if (Object.hasOwn(incoming, field) && !isDeepStrictEqual(incoming[field], current[field])) fail(403, '理财尚未解锁，不能修改理财数据。')
    }
  }
  const next = visibleMain(incoming, wealthUnlocked)
  if (!wealthUnlocked) {
    for (const collection of ['todos', 'trash']) {
      if (Object.hasOwn(incoming, collection) && !Array.isArray(incoming[collection])) fail(400, '待办与回收站的数据格式不正确。')
      const hidden = (Array.isArray(current[collection]) ? current[collection] : []).filter((item) => isFinanceEntry(item, collection))
      for (const item of incoming[collection] || []) {
        const protectedId = item?.id !== undefined && hidden.some((saved) => String(saved.id) === String(item.id))
        if ((isFinanceEntry(item, collection) || protectedId) && !hidden.some((saved) => isDeepStrictEqual(saved, item))) fail(403, '理财尚未解锁，不能修改财务待办或回收记录。')
      }
      if (hidden.length) next[collection] = [...(next[collection] || []), ...hidden]
    }
  }
  for (const field of [...SECRET_FIELDS, ...(!wealthUnlocked ? WEALTH_FIELDS : [])]) {
    if (field !== REVISION_FIELD && Object.hasOwn(current, field)) next[field] = current[field]
  }
  delete next.wealthPassword
  return next
}
export function requireRevision(revision) {
  if (!Number.isSafeInteger(revision) || revision < 0) fail(428, '缺少有效的数据版本，请刷新页面后重试。')
}
