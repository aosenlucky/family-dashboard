import { getStorageBackendName, readFullBackup, readMainSnapshot, restoreFullBackup, validateBackup } from './_data-store.js'
import { requireFamily, requireWealth, visibleMain, fail } from './_family-security.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store')
  try {
    requireFamily(req)
    requireWealth(req)
    if (req.method === 'GET') return res.status(200).json(await readFullBackup())
    if (req.method !== 'POST') fail(405, 'Method Not Allowed')
    const { action, backup, revision, confirm, restorePointId } = req.body || {}
    if (action === 'preview') {
      const counts = validateBackup(backup)
      const current = await readMainSnapshot()
      return res.status(200).json({ valid: true, counts, exportedAt: backup.exportedAt || null, revision: current.revision })
    }
    if (!['restore', 'rollback'].includes(action)) fail(400, '请选择预览、恢复或回退操作。')
    if (confirm !== true) fail(400, '恢复需要明确确认。')
    if (action === 'rollback' && !restorePointId) fail(400, '请选择一个恢复点。')
    const result = await restoreFullBackup(backup, revision, action === 'rollback' ? { restorePointId } : {})
    return res.status(200).json({ success: true, storageBackend: getStorageBackendName(), ...result })
  } catch (error) {
    return res.status(error.status || 500).json(error.status === 409
      ? { error: error.message, record: visibleMain(error.record, true), revision: error.revision, mode: 'real', wealthUnlocked: true }
      : { error: error.status ? error.message : '数据备份或恢复失败，未完成本次操作。' })
  }
}
