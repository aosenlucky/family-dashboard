export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  const sitePin = process.env.SYSTEM_PASSWORD || ''
  const demoPin = process.env.DEMO_PASSWORD || ''
  const authHeader = req.headers.authorization || ''
  const isRealSession = Boolean(sitePin && authHeader === sitePin)
  const isDemoSession = Boolean(demoPin && authHeader === demoPin && authHeader !== sitePin)

  if (!isRealSession && !isDemoSession) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const expectedPassword = isDemoSession
    ? process.env.DEMO_WEALTH_PASSWORD || process.env.DEMO_PASSWORD || ''
    : process.env.WEALTH_PASSWORD || ''

  if (!expectedPassword) {
    return res.status(500).json({
      error: isDemoSession
        ? '缺少 DEMO_WEALTH_PASSWORD 或 DEMO_PASSWORD 环境变量。'
        : '缺少 WEALTH_PASSWORD 环境变量。'
    })
  }

  const inputPassword = String(req.body?.password || '')
  if (!inputPassword || inputPassword !== expectedPassword) {
    return res.status(403).json({ error: '理财密码错误。' })
  }

  return res.status(200).json({
    success: true,
    mode: isDemoSession ? 'demo' : 'real'
  })
}
