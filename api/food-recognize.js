import { requireFamily, fail } from './_family-security.js'
import { recognizeFood } from './_food-recognition.js'
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store')
  try {
    requireFamily(req)
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); fail(405, '请通过整理按钮提交资料。') }
    return res.status(200).json(await recognizeFood(req.body))
  } catch (error) { return res.status(error.status || 500).json({ error: error.status ? error.message : '整理未完成，仍可手动填写保存。' }) }
}
