export default async function handler(req, res) {
  const { method, headers, body } = req

  const pin = process.env.SYSTEM_PASSWORD
  const apiKey = process.env.JSONBIN_API_KEY
  const binId = process.env.JSONBIN_BIN_ID
  const authHeader = headers.authorization || ''

  if (pin && authHeader !== pin) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (method === 'GET') {
    try {
      const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
        headers: { 'X-Master-Key': apiKey }
      })
      const data = await response.json()
      return res.status(200).json(data.record || {})
    } catch (error) {
      return res.status(500).json({ error: 'Failed to read JSONBin', detail: getErrorMessage(error) })
    }
  }

  if (method === 'POST') {
    try {
      if (body?.action === 'notify') {
        const result = await sendPushNotifications(body.title, body.content)
        const failed = result.results.filter((item) => !item.ok)
        console.log('[push-notify]', JSON.stringify({
          success: failed.length === 0,
          configured: result.configured,
          results: result.results
        }))
        return res.status(200).json({
          success: failed.length === 0,
          message: failed.length ? 'Some push notifications failed' : 'Push notifications sent',
          ...result
        })
      }

      const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Master-Key': apiKey },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        return res.status(502).json({ error: 'Failed to write JSONBin', detail: await safeResponseText(response) })
      }

      return res.status(200).json({ success: true })
    } catch (error) {
      return res.status(500).json({ error: 'Failed to process request', detail: getErrorMessage(error) })
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' })
}

async function sendPushNotifications(title = '家庭提醒', content = '') {
  const tokens = getPushTokens()
  if (!tokens.length) {
    return {
      configured: false,
      results: [{ ok: false, provider: 'none', error: 'Missing PUSHPLUS_TOKEN or SERVERCHAN_KEY' }]
    }
  }

  const results = await Promise.all(tokens.map((token) => sendPushToken(token, title, content)))
  return { configured: true, results }
}

function getPushTokens() {
  const raw = [
    process.env.SERVERCHAN_KEY,
    process.env.PUSHPLUS_TOKEN,
    process.env.PUSHPLUS_KEY,
    process.env.PUSHPLUS_TOKENS,
    process.env.pushplus_Token,
    process.env.pushplus_token
  ].filter(Boolean).join(',')

  return [...new Set(raw.split(/[,，;\n\r]+/).map((item) => item.trim()).filter(Boolean))]
}

async function sendPushToken(token, title, content) {
  if (token.startsWith('SCT')) return sendServerChan(token, title, content)
  return sendPushPlus(token, title, content)
}

async function sendServerChan(token, title, content) {
  const cleanText = String(content || '').replace(/<br\s*\/?>/gi, '\n\n').replace(/<[^>]+>/g, '')
  const response = await fetch(`https://sctapi.ftqq.com/${token}.send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, desp: cleanText })
  })
  return parsePushResponse(response, 'serverchan')
}

async function sendPushPlus(token, title, content) {
  const response = await fetch('https://www.pushplus.plus/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, title, content, template: 'html' })
  })
  return parsePushResponse(response, 'pushplus')
}

async function parsePushResponse(response, provider) {
  const text = await safeResponseText(response)
  let payload = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {}

  const pushPlusOk = provider === 'pushplus' && payload && [200, 0].includes(Number(payload.code))
  const serverChanOk = provider === 'serverchan' && payload && [0, 200].includes(Number(payload.code))
  const ok = response.ok && (pushPlusOk || serverChanOk || !payload)

  return {
    ok,
    provider,
    status: response.status,
    code: payload?.code,
    message: payload?.msg || payload?.message || text.slice(0, 300)
  }
}

async function safeResponseText(response) {
  try {
    return await response.text()
  } catch {
    return ''
  }
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}
