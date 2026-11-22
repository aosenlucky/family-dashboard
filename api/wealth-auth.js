import { timingSafeEqual } from 'node:crypto'
import { requireFamily, createWealthToken, fail } from './_family-security.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store')
  try {
    if (req.method !== 'POST') fail(405, 'Method Not Allowed')
    const mode = requireFamily(req, { allowDemo: true })
    const password = mode === 'demo' ? process.env.DEMO_WEALTH_PASSWORD || process.env.DEMO_PASSWORD : process.env.WEALTH_PASSWORD
    if (!password) fail(503, '尚未配置理财密码。')
    const input = typeof req.body?.password === 'string' ? req.body.password : ''
    if (!input || Buffer.byteLength(input) !== Buffer.byteLength(password) || !timingSafeEqual(Buffer.from(input), Buffer.from(password))) fail(403, '理财密码错误。')
    return res.status(200).json({ success: true, mode, ...createWealthToken(mode) })
  } catch (error) { return res.status(error.status || 500).json({ error: error.message }) }
}
