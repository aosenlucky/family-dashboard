import { requireFamily, fail } from './_family-security.js'
import { readCouponImage, saveCouponImage } from './_coupon-media.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  try {
    requireFamily(req)
    if (req.method === 'POST') return res.status(200).json({ attachment: await saveCouponImage(req.body) })
    if (req.method === 'GET') {
      const image = await readCouponImage(req.query?.key)
      res.setHeader('Content-Type', image.contentType)
      res.setHeader('Content-Length', String(image.bytes.length))
      res.setHeader('Content-Disposition', 'inline')
      res.status(200).end(image.bytes)
      return
    }
    res.setHeader('Allow', 'GET, POST')
    fail(405, '不支持的券图操作。')
  } catch (error) { return res.status(error.status || 500).json({ error: error.status ? error.message : '券图操作失败，原记录未改动。' }) }
}
