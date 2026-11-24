import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { fail } from './_family-security.js'
import { hasPreviewStore } from '../server/preview-store.js'

// Base64 expands to ~5.34 MB, leaving room under EdgeOne's 6 MB request limit.
export const MAX_COUPON_IMAGE_BYTES = 4 * 1024 * 1024
export const COUPON_BUCKET = 'family-coupons'
const KEY = /^coupon\/([a-f0-9]{64})\.(jpg|png|webp|gif)$/
const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }

export function imageKind(bytes) {
  if (bytes.length < 12) fail(400, '图片内容不完整，请重新选择。')
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg'
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'png'
  if (['GIF87a','GIF89a'].includes(bytes.subarray(0, 6).toString())) return 'gif'
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') return 'webp'
  fail(400, '请选择 JPG、PNG、WebP 或 GIF 图片。')
}
export function validateObjectKey(key) {
  if (typeof key !== 'string' || !KEY.test(key)) fail(400, '券图地址无效。')
  return key
}
export function imageFromBody(body = {}) {
  const { data, contentType, filename } = body
  if (typeof data !== 'string' || !data || data.length > Math.ceil(MAX_COUPON_IMAGE_BYTES / 3) * 4 || data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) fail(400, '图片格式无效或超过 4 MB，请换一张较小的截图。')
  const bytes = Buffer.from(data, 'base64')
  if (bytes.toString('base64') !== data) fail(400, '图片编码无效，请重新选择。')
  if (!bytes.length || bytes.length > MAX_COUPON_IMAGE_BYTES) fail(413, '单张券图不能超过 4 MB。')
  const extension = imageKind(bytes), mime = MIME[extension]
  if (contentType && contentType !== mime && !(contentType === 'image/jpg' && mime === 'image/jpeg')) fail(400, '图片格式与文件内容不一致。')
  const hash = createHash('sha256').update(bytes).digest('hex')
  return { bytes, attachment: { id: hash, objectKey: `coupon/${hash}.${extension}`, filename: String(filename || `券图.${extension}`).replace(/[\x00-\x1f\x7f/\\]/g, '').slice(0, 160), contentType: mime, bytes: bytes.length } }
}

export function couponSupabaseConfig() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  let base
  try { base = new URL(process.env.SUPABASE_URL) } catch { fail(503, '券册私有存储尚未配置。') }
  if (base.protocol !== 'https:' || base.username || base.password || !key) fail(503, '券册私有存储尚未配置。')
  return { base: base.origin, key }
}
export async function couponSupabase(path, { method = 'GET', body, headers = {}, binary = false, timeout = 20000, signal } = {}) {
  const { base, key } = couponSupabaseConfig()
  let response
  try {
    response = await fetch(`${base}/${path}`, {
      method, headers: { apikey: key, Authorization: `Bearer ${key}`, ...(body && !binary ? { 'Content-Type': 'application/json' } : {}), ...headers },
      ...(body === undefined ? {} : { body: binary ? body : JSON.stringify(body) }), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout), redirect: 'error'
    })
  } catch { fail(503, '券册存储暂时无法连接，请稍后再试。') }
  if (!response.ok) {
    // Never return Supabase's error body: it can contain object paths or internals.
    const code = response.status
    fail(code === 404 ? 404 : 503, code === 404 ? '没有找到这张券图，请重新上传。' : '券册私有存储尚未就绪或暂时不可用。')
  }
  return response
}
async function requirePrivateBucket(options) {
  const response = await couponSupabase(`storage/v1/bucket/${COUPON_BUCKET}`, options)
  const bucket = await response.json().catch(() => null)
  if (!bucket || bucket.public !== false) fail(503, '券图存储必须设为私有，请先完成券册存储配置。')
}
function previewFile(objectKey) {
  validateObjectKey(objectKey)
  const directory = resolve(process.env.PERSONAL_PREVIEW_DIR, 'coupon-media')
  return { directory, file: join(directory, objectKey.slice('coupon/'.length)) }
}
export async function saveCouponImage(body) {
  const { bytes, attachment } = imageFromBody(body)
  if (hasPreviewStore()) {
    const { directory, file } = previewFile(attachment.objectKey)
    await mkdir(directory, { recursive: true })
    await writeFile(file, bytes, { mode: 0o600, flag: 'wx' }).catch(error => { if (error.code !== 'EEXIST') throw error })
    return attachment
  }
  await requirePrivateBucket()
  // Content-addressed objects are immutable: an identical upload writes identical bytes.
  await couponSupabase(`storage/v1/object/${COUPON_BUCKET}/${attachment.objectKey}`, { method: 'POST', body: bytes, binary: true, headers: { 'Content-Type': attachment.contentType, 'x-upsert': 'true', 'Cache-Control': 'private, no-store' } })
  return attachment
}
export async function readCouponImage(objectKey, { signal } = {}) {
  validateObjectKey(objectKey)
  let bytes
  if (hasPreviewStore()) {
    try { bytes = await readFile(previewFile(objectKey).file) } catch (error) { if (error.code === 'ENOENT') fail(404, '没有找到这张券图，请重新上传。'); throw error }
  } else {
    await requirePrivateBucket({ signal })
    const response = await couponSupabase(`storage/v1/object/authenticated/${COUPON_BUCKET}/${objectKey}`, { signal })
    const length = Number(response.headers.get('content-length'))
    if (length > MAX_COUPON_IMAGE_BYTES) fail(413, '券图超过 4 MB，无法读取。')
    if (response.body?.getReader) {
      const reader = response.body.getReader(), chunks = []
      let size = 0
      try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > MAX_COUPON_IMAGE_BYTES) fail(413, '券图超过 4 MB，无法读取。'); chunks.push(Buffer.from(part.value)) } }
      catch (error) { await reader.cancel().catch(() => {}); throw error }
      bytes = Buffer.concat(chunks)
    } else bytes = Buffer.from(await response.arrayBuffer())
  }
  if (bytes.length > MAX_COUPON_IMAGE_BYTES) fail(413, '券图超过 4 MB，无法读取。')
  const kind = imageKind(bytes), hash = createHash('sha256').update(bytes).digest('hex')
  if (`coupon/${hash}.${kind}` !== objectKey) fail(409, '券图校验未通过，请重新上传原图。')
  return { bytes, contentType: MIME[kind], hash }
}
