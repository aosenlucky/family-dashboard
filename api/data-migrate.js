import { getStorageBackendName, hasSupabaseConfig, readJsonBinFullBackup, restoreFullBackup } from './_data-store.js'

export default async function handler(req, res) {
  const pin = process.env.SYSTEM_PASSWORD
  const authHeader = req.headers.authorization || ''
  if (pin && authHeader !== pin) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  try {
    if (!hasSupabaseConfig()) {
      return res.status(400).json({ error: '请先配置 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY。' })
    }
    if (!process.env.JSONBIN_API_KEY || !process.env.JSONBIN_BIN_ID) {
      return res.status(400).json({ error: '缺少 JSONBIN_API_KEY 或 JSONBIN_BIN_ID，无法从旧数据源迁移。' })
    }

    const backup = await readJsonBinFullBackup()
    const result = await restoreFullBackup(backup)
    return res.status(200).json({
      success: true,
      from: 'jsonbin',
      to: getStorageBackendName(),
      migratedAt: new Date().toISOString(),
      ...result
    })
  } catch (error) {
    return res.status(500).json({
      error: '迁移到 Supabase 失败。',
      detail: error instanceof Error ? error.message : String(error)
    })
  }
}
