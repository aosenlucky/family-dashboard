import { createTravelPlanDay, createTravelPlanFoundation, createTravelPlanSkeleton, finalizeTravelPlanWorkflow } from './travel-plan.js'

export const config = {
  maxDuration: 300
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  const pin = process.env.SYSTEM_PASSWORD
  if (pin && req.headers.authorization !== pin) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const { action, input, foundation, skeleton, dayContext, dayResults } = req.body || {}
    if (!input?.destination || !input?.startDate || !input?.endDate) {
      return res.status(400).json({ error: '目的地、开始日期和结束日期必填。' })
    }

    if (input.useMock) {
      return res.status(400).json({ error: '工作流接口不处理示例数据。' })
    }

    if (action === 'foundation') {
      return res.status(200).json({ foundation: await createTravelPlanFoundation(input) })
    }

    if (action === 'skeleton') {
      if (!foundation) return res.status(400).json({ error: '缺少 foundation。' })
      return res.status(200).json({ skeleton: await createTravelPlanSkeleton(input, foundation) })
    }

    if (action === 'day') {
      if (!foundation || !dayContext) return res.status(400).json({ error: '缺少 foundation 或 dayContext。' })
      return res.status(200).json({ dayResult: await createTravelPlanDay(input, foundation, dayContext) })
    }

    if (action === 'finalize') {
      if (!foundation || !Array.isArray(dayResults)) return res.status(400).json({ error: '缺少 foundation 或 dayResults。' })
      return res.status(200).json(await finalizeTravelPlanWorkflow(input, foundation, dayResults, skeleton))
    }

    return res.status(400).json({ error: '未知的旅行生成步骤。' })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const isTimeout = /abort|timeout|timed out/i.test(message)
    return res.status(isTimeout ? 504 : 500).json({
      error: isTimeout ? '当前步骤生成超时。' : '旅行工作流生成失败。',
      detail: message
    })
  }
}
