import { createTravelPlan } from './travel-plan.js'

export const config = {
  maxDuration: 300
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  const pin = process.env.SYSTEM_PASSWORD
  if (pin && req.headers.authorization !== pin) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const input = req.body || {}
  if (!input.destination || !input.startDate || !input.endDate) {
    return res.status(400).json({ error: '目的地、开始日期和结束日期必填。' })
  }

  res.statusCode = 200
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()

  const heartbeat = setInterval(() => {
    sendEvent(res, 'ping', { at: Date.now() })
  }, 3000)

  try {
    sendEvent(res, 'progress', { stage: 'start', message: '行程生成已开始。' })
    const plan = await createTravelPlan(input, {
      stream: true,
      onProgress: (payload) => sendEvent(res, 'progress', payload)
    })
    sendEvent(res, 'result', plan)
  } catch (error) {
    sendEvent(res, 'error', {
      error: '生成行程失败。',
      detail: error instanceof Error ? error.message : String(error)
    })
  } finally {
    clearInterval(heartbeat)
    res.end()
  }
}

function sendEvent(res, event, payload) {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}
