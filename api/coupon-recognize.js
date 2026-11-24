import { requireFamily, fail } from './_family-security.js'
import { recognizeCoupons } from './_coupon-recognition.js'
export default async function handler(req, res) {
  res.setHeader('Cache-Control','private, no-store')
  try {
    requireFamily(req)
    if (req.method !== 'POST') { res.setHeader('Allow','POST'); fail(405,'请通过识别按钮提交截图。') }
    return res.status(200).json(await recognizeCoupons(req.body))
  } catch (error) { return res.status(error.status || 500).json({error:error.status ? error.message : '识别未完成，截图已保留，可手动填写。'}) }
}
