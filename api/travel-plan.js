import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createWorker } from 'tesseract.js'

const MODEL_NAME = 'deepseek-v4-pro'
const OCR_TIMEOUT_MS = 45000
const REQUEST_TIMEOUT_MS = 7000

const mockPlan = {
  meta: {
    destination: '京都',
    dateRange: '2026-06-23 至 2026-06-23',
    generatedAt: new Date().toISOString(),
    assumptions: ['默认酒店为四条河原町酒店', '同行包含 2 位成人', '预算为中等偏舒适'],
    warnings: ['热门寺社建议避开 10 点后的团队客流']
  },
  extractedStrategy: {
    places: [
      { id: 'kiyomizu', name: '清水寺', type: 'attraction', area: '东山', priority: 5, estimatedStayMinutes: 120, notes: '京都经典地标', sourceHint: '示例数据', familyFit: 'medium' },
      { id: 'sannenzaka', name: '二年坂三年坂', type: 'experience', area: '东山', priority: 4, estimatedStayMinutes: 100, notes: '老街氛围集中', sourceHint: '示例数据', familyFit: 'medium' },
      { id: 'kamo', name: '鸭川散步', type: 'experience', area: '四条河原町', priority: 4, estimatedStayMinutes: 45, notes: '晚间低强度收尾', sourceHint: '示例数据', familyFit: 'high' }
    ],
    restaurants: [
      { id: 'pontocho', name: '先斗町晚餐', type: 'restaurant', area: '四条河原町', priority: 3, estimatedStayMinutes: 90, notes: '靠近酒店，选择多', sourceHint: '示例数据', familyFit: 'medium' }
    ],
    notes: ['同一天聚焦东山与四条，减少跨区移动'],
    rejectedItems: ['伏见稻荷夜爬：亲子同行不建议安排太晚'],
    selectionRationale: ['第一天采用东山经典线，保证京都初印象明确。', '晚间回到酒店附近，减少回程压力。']
  },
  grouping: {
    byArea: { 东山: ['清水寺', '二年坂三年坂'], 四条河原町: ['先斗町晚餐', '鸭川散步'] },
    byTheme: { 经典寺社: ['清水寺'], 家庭轻松: ['鸭川散步'] }
  },
  plans: [{
    variant: 'classic',
    title: '经典版：东山寺社与老街',
    positioning: '第一次到京都优先覆盖标志性景点，同时控制移动范围。',
    heroImageUrl: '',
    heroImageAlt: '京都清水寺宣传照片',
    totalFatigueLevel: 'medium',
    bestFor: '想稳妥打卡京都代表性景点的家庭',
    days: [{
      day: 1,
      date: '2026-06-23',
      theme: '东山经典线',
      areaFocus: '东山 + 四条',
      summary: '上午清水寺，下午老街慢逛，晚上鸭川放松。',
      dailyBudgetHint: '中等：门票少，餐饮弹性大。',
      riskCheck: '清水寺坡道较多，需放慢节奏。',
      slots: [
        { timeLabel: '上午', placeName: '清水寺', area: '东山', reason: '京都代表性寺院，适合作为第一站建立城市印象。', stayMinutes: 120, photoTips: '清水舞台侧面和远眺京都市区的位置更出片。', foodTips: '入口附近可补水，正餐建议留到下山后。', familyFriendlyTips: '坡道和台阶多，尽量轻装。', backupPlan: '雨天改为京都国立博物馆。', transportHint: '从当天酒店出发，优先打车或公交到五条坂。', fatigueLevel: 'medium' },
        { timeLabel: '午餐', placeName: '二年坂周边家庭餐厅', area: '东山', reason: '承接上午路线，避免跨区找餐厅。', stayMinutes: 75, photoTips: '饭后再拍老街，人流略少。', foodTips: '优先选择定食或有儿童座椅的店。', familyFriendlyTips: '排队超过 20 分钟就启用备选。', backupPlan: '便利店轻食加咖啡馆休息。', transportHint: '步行可达。', fatigueLevel: 'low' },
        { timeLabel: '下午', placeName: '二年坂三年坂', area: '东山', reason: '老街氛围集中，适合慢逛和买伴手礼。', stayMinutes: 120, photoTips: '坡道转角和木造町屋适合作背景。', foodTips: '可尝试抹茶甜品，但不要连续排队。', familyFriendlyTips: '控制购物时间，留出休息。', backupPlan: '高台寺短线参观。', transportHint: '全程步行，注意坡道。', fatigueLevel: 'medium' },
        { timeLabel: '晚餐', placeName: '先斗町晚餐', area: '四条河原町', reason: '靠近酒店，餐厅选择多，方便结束后回程。', stayMinutes: 90, photoTips: '餐后可拍街灯和鸭川夜景。', foodTips: '选择预约制餐厅，减少等待。', familyFriendlyTips: '避开烟味重的居酒屋。', backupPlan: '高岛屋餐厅层。', transportHint: '从东山打车回四条最省力。', fatigueLevel: 'low' },
        { timeLabel: '晚上', placeName: '鸭川散步', area: '四条河原町', reason: '低强度收尾，给家庭成员恢复体力。', stayMinutes: 45, photoTips: '桥上和河岸灯光适合夜景。', foodTips: '可买甜品或热饮边走边休息。', familyFriendlyTips: '天冷或下雨直接回酒店。', backupPlan: '酒店附近便利店补给。', transportHint: '从晚餐地步行，结束后回当天酒店。', fatigueLevel: 'low' }
      ]
    }]
  }],
  critique: {
    initialIssues: ['经典线东山坡道较多，上午和下午连续步行会累'],
    revisionsApplied: ['把晚餐和晚上安排在酒店附近，降低回程压力']
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  try {
    const pin = process.env.SYSTEM_PASSWORD
    if (pin && req.headers.authorization !== pin) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const input = req.body || {}
    if (!input.destination || !input.startDate || !input.endDate) {
      return res.status(400).json({ error: '目的地、开始日期和结束日期必填。' })
    }

    if (input.useMock) {
      return res.status(200).json(await enrichPlanImages(buildMockPlan(input), input.destination))
    }

    const apiKey = getDeepSeekApiKey()
    if (!apiKey) {
      const fallback = await enrichPlanImages(buildMockPlan(input), input.destination || mockPlan.meta.destination)
      fallback.meta.warnings = [...fallback.meta.warnings, '未找到 DEEPSEEK_API_KEY，当前返回示例数据。']
      return res.status(200).json(fallback)
    }

    const normalizedInput = await prepareInputMaterials(input)
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          { role: 'system', content: '你是一个只返回严格 JSON 的家庭旅行规划 API。不要输出 Markdown 代码块。' },
          { role: 'user', content: buildTravelPlannerPrompt(normalizedInput) }
        ],
        temperature: 0.45,
        reasoning_effort: 'high',
        thinking: { type: 'enabled' },
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      const detail = await response.text()
      return res.status(502).json({ error: `DeepSeek 请求失败：${response.status}`, detail })
    }

    const payload = await response.json()
    const content = payload.choices?.[0]?.message?.content
    if (!content) return res.status(502).json({ error: 'DeepSeek 返回内容为空。' })

    const plan = JSON.parse(content)
    return res.status(200).json(await enrichPlanImages(plan, input.destination))
  } catch (error) {
    return res.status(500).json({ error: '生成行程失败。', detail: error instanceof Error ? error.message : String(error) })
  }
}

function getDeepSeekApiKey() {
  if (process.env.DEEPSEEK_API_KEY) return stripQuotes(process.env.DEEPSEEK_API_KEY)
  const secretPath = join(process.env.USERPROFILE || '', '.codex', 'secrets', 'obsidian-knowledge.env')
  if (!existsSync(secretPath)) return ''
  const file = readFileSync(secretPath, 'utf8')
  const line = file.split(/\r?\n/).find((item) => item.replace(/^\uFEFF/, '').trim().startsWith('DEEPSEEK_API_KEY='))
  return line ? stripQuotes(line.replace(/^\uFEFF/, '').split('=').slice(1).join('=').trim()) : ''
}

function buildMockPlan(input = {}) {
  const selected = Array.isArray(input.selectedVariants) && input.selectedVariants.length ? input.selectedVariants : ['classic']
  const template = JSON.parse(JSON.stringify(mockPlan))
  const variantMeta = {
    classic: {
      title: '经典版：东山寺社与老街',
      positioning: '第一次到京都优先覆盖标志性景点，同时控制移动范围。',
      totalFatigueLevel: 'medium',
      bestFor: '想稳妥打卡京都代表性景点的家庭'
    },
    photoFood: {
      title: '拍照美食版：老街光影与鸭川夜色',
      positioning: '把拍照顺光、咖啡甜品和晚餐氛围放在更高优先级。',
      totalFatigueLevel: 'medium',
      bestFor: '希望照片和餐厅体验更完整的家庭'
    },
    familyRelaxed: {
      title: '家庭轻松版：少绕路的东山慢游',
      positioning: '减少坡道连续步行，把休息和回酒店便利性放在前面。',
      totalFatigueLevel: 'low',
      bestFor: '带孩子、长辈或希望节奏更松的家庭'
    }
  }
  template.meta.destination = input.destination || template.meta.destination
  template.meta.dateRange = `${input.startDate || '2026-06-23'} 至 ${input.endDate || input.startDate || '2026-06-23'}`
  template.meta.assumptions = [
    `默认酒店为${input.hotelArea || '四条河原町酒店'}`,
    `同行包含 ${input.travelers?.adults || 2} 位成人、${input.travelers?.children || 0} 位儿童、${input.travelers?.seniors || 0} 位长辈`,
    `节奏偏好：${input.pace || 'balanced'}`
  ]
  const basePlan = template.plans[0]
  template.plans = selected.map((variant) => {
    const meta = variantMeta[variant] || variantMeta.classic
    return {
      ...JSON.parse(JSON.stringify(basePlan)),
      variant,
      ...meta,
      days: basePlan.days.map((day) => ({
        ...day,
        theme: variant === 'photoFood' ? '东山光影与鸭川美食' : variant === 'familyRelaxed' ? '东山慢游与酒店近线' : day.theme,
        summary: variant === 'photoFood'
          ? '上午抓住清水寺光线，下午老街慢拍，晚上把鸭川夜景和晚餐合在一起。'
          : variant === 'familyRelaxed'
            ? '上午只安排核心景点，下午压缩老街停留，晚上保留回酒店休息的弹性。'
            : day.summary
      }))
    }
  })
  return template
}

function stripQuotes(value) {
  return value.replace(/^["']|["']$/g, '')
}

async function prepareInputMaterials(input) {
  const withOcr = await withImageOcrText(input)
  const referenceMaterials = await resolveReferenceLinks(withOcr.referenceLinks || [])
  if (!referenceMaterials.length) return withOcr
  return {
    ...withOcr,
    referenceMaterials,
    strategyText: [
      withOcr.strategyText?.trim(),
      '以下是服务端解析参考链接得到的材料。请注意优先级低于用户直接粘贴的自制攻略文本，但高于你自行补充的常识信息：',
      referenceMaterials.map(formatReferenceMaterial).join('\n\n')
    ].filter(Boolean).join('\n\n')
  }
}

async function withImageOcrText(input) {
  if (!input.strategyImages?.length) return input
  const imageTexts = await Promise.all(input.strategyImages.map(async (image, index) => {
    try {
      const text = await recognizeStrategyImage(dataUrlToBuffer(image.dataUrl))
      return text ? `【攻略图片 ${index + 1}：${image.name}】\n${text}` : `【攻略图片 ${index + 1}：${image.name}】未识别出清晰文字。`
    } catch (error) {
      return `【攻略图片 ${index + 1}：${image.name}】OCR 识别失败：${error instanceof Error ? error.message : String(error)}`
    }
  }))
  return {
    ...input,
    strategyImages: [],
    strategyText: [
      input.strategyText?.trim(),
      imageTexts.length ? `以下是用户上传攻略图片的 OCR 识别结果，请作为攻略材料解析，若识别结果明显有误请谨慎处理：\n${imageTexts.join('\n\n')}` : ''
    ].filter(Boolean).join('\n\n')
  }
}

function dataUrlToBuffer(dataUrl) {
  const [, payload = ''] = dataUrl.split(',')
  return Buffer.from(payload, 'base64')
}

async function recognizeStrategyImage(buffer) {
  return withTimeout(async () => {
    const worker = await createWorker(['chi_sim', 'eng'], 1, {
      workerPath: join(process.cwd(), 'node_modules', 'tesseract.js', 'src', 'worker-script', 'node', 'index.js')
    })
    try {
      const result = await worker.recognize(buffer)
      return result.data.text.trim()
    } finally {
      await worker.terminate()
    }
  }, OCR_TIMEOUT_MS)
}

async function resolveReferenceLinks(urls) {
  const uniqueUrls = [...new Set(urls.map((url) => url.trim()).filter(Boolean))].slice(0, 6)
  return Promise.all(uniqueUrls.map(resolveReferenceLink))
}

async function resolveReferenceLink(url) {
  try {
    const response = await fetchWithTimeout(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.7'
      }
    })
    const html = await response.text()
    const title = decodeHtml(extractMeta(html, 'og:title') || extractTag(html, 'title') || '')
    const description = decodeHtml(extractMeta(html, 'description') || extractMeta(html, 'og:description') || '')
    const content = decodeHtml(stripHtml(html)).slice(0, 2400)
    return { url, resolvedUrl: response.url, title: title.slice(0, 240), description: description.slice(0, 500), content, status: response.ok ? 'ok' : 'partial', error: response.ok ? undefined : `HTTP ${response.status}` }
  } catch (error) {
    return { url, status: 'failed', error: error instanceof Error ? error.message : String(error) }
  }
}

function formatReferenceMaterial(material) {
  return [
    `【参考链接】${material.url}`,
    material.resolvedUrl ? `解析后地址：${material.resolvedUrl}` : '',
    material.title ? `标题：${material.title}` : '',
    material.description ? `摘要：${material.description}` : '',
    material.content ? `正文摘录：${material.content}` : '',
    material.error ? `解析状态：${material.error}` : ''
  ].filter(Boolean).join('\n')
}

function buildTravelPlannerPrompt(input) {
  return `
你是一个严谨、会自我审查的家庭旅行规划师。请根据用户输入和攻略材料，生成可由前端直接渲染的 JSON 行程。

必须遵循工作流：
Step 1：解析用户需求
Step 2：解析自制攻略
Step 3：生成候选地点池
Step 4：按区域和主题分组
Step 5：生成初版行程
Step 6：批判初版行程是否太累、绕路、饭点不合理
Step 7：修正行程
Step 8：输出最终版本

用户需求：
${JSON.stringify(input, null, 2)}

规划要求：
1. 只输出严格 JSON，不要 Markdown，不要解释。
2. 只生成用户勾选的版本：classic、photoFood、familyRelaxed。
3. 每套行程按天展示，每天必须包含上午、午餐、下午、晚餐、晚上 5 个 slot。
4. 每个地点必须包含推荐理由、停留时间、拍照建议、美食建议、家庭友好提醒、备选方案、交通提示、疲劳等级。
5. 信息优先级必须严格遵守：自制攻略文本/图片 OCR > 服务端解析出的参考链接内容 > 用户目的地和偏好 > AI 根据常识补充的信息。
6. hotelStays 表示多日旅行的酒店安排。每天必须根据该日期对应酒店规划出发、回程和交通提示；如果只有一个酒店，则默认全程相同。
7. 用户 feedback 可以是自然语言精确编辑指令，例如“把 Day 2 上午清水寺改成伏见稻荷”。若 previousPlan 存在，必须尽量保留未被用户点名修改的内容。
8. priority 是候选点优先级，1 最低、5 最高。不要把它当作时间顺序。
9. heroImageUrl 可以留空，服务端会用真实图库搜索补图；heroImageAlt 请写行程核心景点描述。

JSON Schema 形状：
{
  "meta": { "destination": "string", "dateRange": "string", "generatedAt": "ISO string", "assumptions": ["string"], "warnings": ["string"] },
  "extractedStrategy": {
    "places": [{ "id": "string", "name": "string", "type": "attraction | restaurant | cafe | shopping | hotel | transport | experience | other", "area": "string", "priority": 1, "estimatedStayMinutes": 90, "notes": "string", "sourceHint": "string", "familyFit": "high | medium | low" }],
    "restaurants": [],
    "notes": ["string"],
    "rejectedItems": ["string"],
    "selectionRationale": ["string"]
  },
  "grouping": { "byArea": { "区域名": ["地点名"] }, "byTheme": { "主题名": ["地点名"] } },
  "plans": [{
    "variant": "classic | photoFood | familyRelaxed",
    "title": "string",
    "positioning": "string",
    "heroImageUrl": "string",
    "heroImageAlt": "string",
    "totalFatigueLevel": "low | medium | high",
    "bestFor": "string",
    "days": [{
      "day": 1,
      "date": "YYYY-MM-DD",
      "theme": "string",
      "areaFocus": "string",
      "summary": "string",
      "slots": [{ "timeLabel": "上午 | 午餐 | 下午 | 晚餐 | 晚上", "placeName": "string", "area": "string", "reason": "string", "stayMinutes": 90, "photoTips": "string", "foodTips": "string", "familyFriendlyTips": "string", "backupPlan": "string", "transportHint": "string", "fatigueLevel": "low | medium | high" }],
      "dailyBudgetHint": "string",
      "riskCheck": "string"
    }]
  }],
  "critique": { "initialIssues": ["string"], "revisionsApplied": ["string"] }
}`
}

async function enrichPlanImages(plan, destination) {
  const enrichedPlans = await Promise.all((plan.plans || []).map(async (item) => {
    const leadPlace = getPlanLeadPlace(item)
    const image = await searchTravelImage(`${destination} ${leadPlace} travel landmark`, destination, leadPlace)
    return {
      ...item,
      heroImageUrl: image?.url || item.heroImageUrl || '/bg.jpg',
      heroImageAlt: image?.alt || item.heroImageAlt || `${destination}${leadPlace}宣传照片`,
      heroImageCredit: image?.credit || ''
    }
  }))
  return { ...plan, plans: enrichedPlans }
}

function getPlanLeadPlace(plan) {
  const firstPlace = (plan.days || []).flatMap((day) => day.slots || []).find((slot) => !['午餐', '晚餐'].includes(slot.timeLabel))
  return firstPlace?.placeName || plan.title || '旅行'
}

async function searchTravelImage(_query, destination, leadPlace) {
  const keywords = buildImageKeywords(destination, leadPlace)
  const query = `${keywords.join(' ')} travel landmark`
  return await searchUnsplash(query) || await searchPexels(query) || await searchLoremFlickr(keywords, destination, leadPlace) || await searchWikipediaImage(leadPlace) || await searchWikipediaImage(destination)
}

function buildImageKeywords(destination, leadPlace) {
  return uniqueText([
    translateImageTerm(leadPlace),
    translateImageTerm(destination),
    leadPlace,
    destination,
    'travel'
  ]).filter(Boolean).slice(0, 5)
}

function translateImageTerm(value = '') {
  const text = String(value).trim()
  if (!text) return ''
  const dictionary = [
    ['清水寺', 'Kiyomizu-dera Kyoto Japan temple'],
    ['二年坂', 'Ninenzaka Sannenzaka Kyoto old street'],
    ['三年坂', 'Ninenzaka Sannenzaka Kyoto old street'],
    ['鸭川', 'Kamo River Kyoto'],
    ['伏见稻荷', 'Fushimi Inari Kyoto torii'],
    ['岚山', 'Arashiyama Kyoto bamboo grove'],
    ['金阁寺', 'Kinkaku-ji Kyoto'],
    ['京都', 'Kyoto Japan'],
    ['东京', 'Tokyo Japan'],
    ['大阪', 'Osaka Japan'],
    ['奈良', 'Nara Japan'],
    ['富士山', 'Mount Fuji Japan'],
    ['箱根', 'Hakone Japan'],
    ['冲绳', 'Okinawa Japan'],
    ['北京', 'Beijing China'],
    ['上海', 'Shanghai China'],
    ['西安', 'Xian China'],
    ['成都', 'Chengdu China'],
    ['杭州', 'Hangzhou China'],
    ['苏州', 'Suzhou China'],
    ['广州', 'Guangzhou China'],
    ['深圳', 'Shenzhen China'],
    ['三亚', 'Sanya China']
  ]
  const hit = dictionary.find(([key]) => text.includes(key))
  return hit?.[1] || text
}

function uniqueText(values) {
  const seen = new Set()
  return values.map((item) => String(item || '').trim()).filter((item) => {
    const key = item.toLowerCase()
    if (!item || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function searchUnsplash(query) {
  const key = process.env.UNSPLASH_ACCESS_KEY
  if (!key) return null
  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&orientation=landscape&per_page=1&content_filter=high`
    const response = await fetchWithTimeout(url, { headers: { Authorization: `Client-ID ${key}` } })
    if (!response.ok) return null
    const data = await response.json()
    const photo = data.results?.[0]
    return photo ? { url: photo.urls?.regular, alt: photo.alt_description || query, credit: `Unsplash · ${photo.user?.name || ''}` } : null
  } catch {
    return null
  }
}

async function searchPexels(query) {
  const key = process.env.PEXELS_API_KEY
  if (!key) return null
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=landscape&per_page=1&locale=zh-CN`
    const response = await fetchWithTimeout(url, { headers: { Authorization: key } })
    if (!response.ok) return null
    const data = await response.json()
    const photo = data.photos?.[0]
    return photo ? { url: photo.src?.large2x || photo.src?.large, alt: photo.alt || query, credit: `Pexels · ${photo.photographer || ''}` } : null
  } catch {
    return null
  }
}

async function searchWikipediaImage(query) {
  if (!query) return null
  const endpoints = [
    `https://zh.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`
  ]
  for (const endpoint of endpoints) {
    try {
      const response = await fetchWithTimeout(endpoint, { headers: { 'User-Agent': 'family-travel-planner/1.0' } }, 4000)
      if (!response.ok) continue
      const data = await response.json()
      if (data.thumbnail?.source) return { url: data.thumbnail.source.replace(/\/\d+px-/, '/1200px-'), alt: data.title || query, credit: 'Wikipedia' }
    } catch {}
  }
  return null
}

async function searchLoremFlickr(keywords, destination, leadPlace) {
  const tags = toFlickrTags(keywords)
  if (!tags) return null
  return {
    url: `https://loremflickr.com/1200/720/${tags}`,
    alt: `${destination}${leadPlace}旅行照片`,
    credit: 'Flickr public image search'
  }
}

function toFlickrTags(keywords) {
  const tags = []
  for (const item of uniqueText(keywords)) {
    const ascii = item
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, ' ')
      .replace(/-/g, '')
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2 && !['and', 'the', 'with'].includes(word))
    tags.push(...ascii)
  }
  return uniqueText(tags).slice(0, 6).join(',')
}

function extractMeta(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`, 'i')
  ]
  return patterns.map((pattern) => html.match(pattern)?.[1]).find(Boolean) || ''
}

function extractTag(html, tag) {
  return html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))?.[1] || ''
}

function stripHtml(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function decodeHtml(value) {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').trim()
}

async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function withTimeout(task, timeoutMs) {
  let timer
  try {
    return await Promise.race([
      task(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`OCR 识别超过 ${Math.round(timeoutMs / 1000)} 秒，已跳过该图片。`)), timeoutMs)
      })
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
