import { createTravelPlan } from '../../api/travel-plan.js'

const EDGEONE_TIMEOUT_MS = Number(process.env.TRAVEL_EDGEONE_TIMEOUT_MS || 112000)

export default async function onRequest(context) {
  try {
    const request = context.request || context
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method Not Allowed' }, 405)
    }

    const pin = process.env.SYSTEM_PASSWORD
    const authorization = request.headers.get('authorization') || ''
    if (pin && authorization !== pin) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const input = await request.json().catch(() => ({}))
    if (!input.destination || !input.startDate || !input.endDate) {
      return jsonResponse({ error: '目的地、开始日期和结束日期必填。' }, 400)
    }

    const plan = await withTimeout(
      createTravelPlan(input, { stream: true, compact: true }),
      EDGEONE_TIMEOUT_MS,
      'EdgeOne 函数即将超过 120 秒上限，请减少旅行天数或先粘贴核心攻略文字后重试。'
    )
    return jsonResponse(plan, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const isTimeout = /abort|timeout|timed out|120 秒上限/i.test(message)
    return jsonResponse({
      error: isTimeout ? '生成行程超时。' : '生成行程失败。',
      detail: message
    }, isTimeout ? 504 : 500)
  }
}

function jsonResponse(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  })
}

function withTimeout(promise, timeoutMs, message) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}
