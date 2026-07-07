import { readMainRecord, writeMainRecord } from './_data-store.js'

export default async function handler(req, res) {
  const { method, headers, body } = req

  const pin = process.env.SYSTEM_PASSWORD
  const demoPin = process.env.DEMO_PASSWORD
  const authHeader = headers.authorization || ''
  const isDemoMode = Boolean(demoPin && authHeader === demoPin && authHeader !== pin)

  if (pin && authHeader !== pin && !isDemoMode) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (method === 'GET') {
    try {
      if (isDemoMode) return res.status(200).json({ mode: 'demo', record: buildDemoRecord() })
      return res.status(200).json(await readMainRecord())
    } catch (error) {
      return res.status(500).json({ error: 'Failed to read data store', detail: getErrorMessage(error) })
    }
  }

  if (method === 'POST') {
    try {
      if (isDemoMode) {
        return res.status(200).json({
          success: true,
          mode: 'demo',
          readOnly: true,
          message: '演示模式为只读数据，本次保存已跳过。'
        })
      }

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

      await writeMainRecord(body)
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

function buildDemoRecord() {
  const demoPassword = process.env.DEMO_WEALTH_PASSWORD || process.env.DEMO_PASSWORD || 'demo'
  return {
    wealthPassword: demoPassword,
    salaryBank: '招商银行演示户',
    salaryDay: 15,
    usdRate: 7.25,
    loans: [
      {
        id: 101,
        owner: '共同',
        type: '房贷',
        bank: '演示住房贷款',
        isAutoCalc: true,
        baseLeft: 1260000,
        baseMonthly: 6800,
        baseDate: '2026-01',
        rate: 3.1,
        day: 20,
        monthly: 0,
        left: 0
      },
      {
        id: 102,
        owner: 'Aosen',
        type: '消费贷',
        bank: '短期周转演示',
        isAutoCalc: false,
        left: 68000,
        monthly: 4200,
        rate: 3.6,
        day: 10
      }
    ],
    transfers: [
      { from: '招商银行演示户', to: '家庭生活户', amount: 12000, day: 15, expire: '长期' },
      { from: '招商银行演示户', to: '投资账户', amount: 8000, day: 16, expire: '长期' },
      { from: '家庭生活户', to: '房贷还款户', amount: 6800, day: 19, expire: '长期' }
    ],
    assets: [
      { id: 201, owner: '共同', type: 'house', name: '家庭住房估值（演示）', value: 3200000 },
      { id: 202, owner: '共同', type: 'cash', name: '现金与货币基金（演示）', value: 260000 },
      { id: 203, owner: '小悦', type: 'fund', name: '长期基金组合（演示）', value: 180000 }
    ],
    stocks: [
      { symbol: '600519', name: '价值蓝筹A', market: 'CN', owner: '共同', costPrice: 1360, currentPrice: 1518, shares: 20 },
      { symbol: 'BABA', name: '全球互联网样本', market: 'US', owner: 'Aosen', costPrice: 78, currentPrice: 103, shares: 80 },
      { symbol: 'AAPL', name: '全球科技样本', market: 'US', owner: '小悦', costPrice: 168, currentPrice: 214, shares: 25 }
    ],
    equity: {
      pricePerShare: 8.2,
      dividendRate: 0.72,
      members: [
        { name: '家庭演示账户', principal: 320000 },
        { name: '长期成长账户', principal: 180000 }
      ]
    },
    photoTypes: ['自然风景', '城市建筑', '浪漫旅行', '人物写真', '美食探店', '日常记录'],
    photos: [
      {
        url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=82',
        desc: '山谷里的清晨',
        tempCity: '演示旅行',
        type: '自然风景'
      },
      {
        url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=82',
        desc: '海边散步',
        tempCity: '演示海岛',
        type: '浪漫旅行'
      },
      {
        url: 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=82',
        desc: '家的一个下午',
        tempCity: '温馨家园',
        type: '日常记录'
      }
    ],
    goals: [
      { name: '亲子旅行基金（演示）', target: 80000, current: 36000 },
      { name: '家庭学习基金（演示）', target: 30000, current: 12000 }
    ],
    dates: [
      { name: '结婚纪念日（演示）', date: '2026-10-26', type: 'anniversary' },
      { name: '宝宝预产期（演示）', date: '2026-12-18', type: 'baby' }
    ],
    todos: [
      { id: 301, text: '整理本周家庭菜单（演示）', completed: false },
      { id: 302, text: '确认周末短途路线（演示）', completed: true }
    ],
    milestones: [
      { id: 401, date: '2026-01-01', title: '家庭空间演示版上线', desc: '用于对外展示，不包含真实资产。', icon: 'ph-sparkle' }
    ],
    habits: [
      {
        id: 501,
        name: '每天阅读 30 分钟（演示）',
        growthValue: 42,
        lastWatered: '',
        stage1Days: 7,
        stage1Reward: '电影之夜',
        stage2Days: 21,
        stage2Reward: '短途旅行',
        stage3Days: 100,
        stage3Reward: '大旅行'
      }
    ],
    llmApiKey: '',
    books: [
      {
        id: 'demo-book-1',
        title: '如何把生活过成作品',
        author: '演示作者',
        cover: '',
        note: '演示模式中的读书笔记，不包含真实内容。'
      }
    ]
  }
}
