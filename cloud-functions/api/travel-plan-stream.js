import handler from '../../api/travel-plan.js'
import { runNodeHandler } from '../_node-handler-adapter.js'

export default async function onRequest(context) {
  const request = context.request || context
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405)
  }

  const pin = process.env.SYSTEM_PASSWORD
  if (pin && request.headers.get('authorization') !== pin) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const body = await request.clone().json().catch(() => ({}))
  if (!body.destination || !body.startDate || !body.endDate) {
    return jsonResponse({ error: '目的地、开始日期和结束日期必填。' }, 400)
  }

  return runNodeHandler(handler, context)
}

function jsonResponse(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  })
}
