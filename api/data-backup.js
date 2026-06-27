import { getStorageBackendName, readFullBackup, restoreFullBackup } from './_data-store.js'

export default async function handler(req, res) {
  const pin = process.env.SYSTEM_PASSWORD
  const authHeader = req.headers.authorization || ''
  if (pin && authHeader !== pin) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    if (req.method === 'GET') {
      return res.status(200).json(await readFullBackup())
    }

    if (req.method === 'POST') {
      const result = await restoreFullBackup(req.body?.backup || req.body)
      return res.status(200).json({
        success: true,
        storageBackend: getStorageBackendName(),
        ...result
      })
    }

    return res.status(405).json({ error: 'Method Not Allowed' })
  } catch (error) {
    return res.status(500).json({
      error: '数据备份/恢复失败。',
      detail: error instanceof Error ? error.message : String(error)
    })
  }
}
