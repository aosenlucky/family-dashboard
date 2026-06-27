import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { jsonrepair } from 'jsonrepair'

const MODEL_NAME = process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro'
const REQUEST_TIMEOUT_MS = Number(process.env.TRAVEL_LINK_TIMEOUT_MS || 3500)
const DEEPSEEK_TIMEOUT_MS = Math.min(Number(process.env.TRAVEL_DEEPSEEK_TIMEOUT_MS || 85000), 85000)
const IMAGE_REQUEST_TIMEOUT_MS = Number(process.env.TRAVEL_IMAGE_TIMEOUT_MS || 1500)
const WEATHER_REQUEST_TIMEOUT_MS = Number(process.env.TRAVEL_WEATHER_TIMEOUT_MS || 2500)
const FORECAST_HORIZON_DAYS = 16
const SHOULD_FETCH_REFERENCE_LINKS = process.env.TRAVEL_FETCH_LINKS !== 'false'
const MAX_REFERENCE_LINKS = Number(process.env.TRAVEL_MAX_REFERENCE_LINKS || 2)

export const config = {
  maxDuration: 300
}

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

    return res.status(200).json(await createTravelPlan(input))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const isTimeout = /abort|timeout|timed out/i.test(message)
    return res.status(isTimeout ? 504 : 500).json({
      error: isTimeout ? 'DeepSeek 生成超时，请减少行程天数或先粘贴关键攻略文字后重试。' : '生成行程失败。',
      detail: message
    })
  }
}

function parseJsonContent(content) {
  const clean = String(content || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  const candidates = [clean, sliceJsonObject(clean)].filter(Boolean)
  const errors = []
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate)
    } catch (error) {
      errors.push(error)
      try {
        return JSON.parse(jsonrepair(candidate))
      } catch (repairError) {
        errors.push(repairError)
      }
    }
  }
  throw new Error(`DeepSeek 返回内容不是可解析的 JSON：${errors.at(-1)?.message || 'unknown parse error'}`)
}

function sliceJsonObject(value) {
  const start = value.indexOf('{')
  const end = value.lastIndexOf('}')
  return start >= 0 && end > start ? value.slice(start, end + 1) : ''
}

function normalizePlan(plan, input = {}) {
  const safePlan = plan && typeof plan === 'object' ? plan : {}
  const meta = safePlan.meta && typeof safePlan.meta === 'object' ? safePlan.meta : {}
  const extracted = safePlan.extractedStrategy && typeof safePlan.extractedStrategy === 'object' ? safePlan.extractedStrategy : {}
  const critique = safePlan.critique && typeof safePlan.critique === 'object' ? safePlan.critique : {}
  const plans = Array.isArray(safePlan.plans) ? safePlan.plans.filter(Boolean) : []
  return {
    ...safePlan,
    meta: {
      destination: input.destination || meta.destination || '目的地',
      dateRange: meta.dateRange || `${input.startDate || ''} 至 ${input.endDate || ''}`.trim(),
      generatedAt: meta.generatedAt || new Date().toISOString(),
      assumptions: Array.isArray(meta.assumptions) ? meta.assumptions : [],
      warnings: Array.isArray(meta.warnings) ? meta.warnings : []
    },
    extractedStrategy: {
      places: Array.isArray(extracted.places) ? extracted.places : [],
      restaurants: Array.isArray(extracted.restaurants) ? extracted.restaurants : [],
      notes: Array.isArray(extracted.notes) ? extracted.notes : [],
      rejectedItems: Array.isArray(extracted.rejectedItems) ? extracted.rejectedItems : [],
      selectionRationale: Array.isArray(extracted.selectionRationale) ? extracted.selectionRationale : []
    },
    grouping: safePlan.grouping && typeof safePlan.grouping === 'object' ? safePlan.grouping : { byArea: {}, byTheme: {} },
    plans: plans.length ? plans.map((item, index) => normalizeVariantPlan(item, input, index)) : [normalizeVariantPlan({}, input, 0)],
    weather: normalizeWeather(safePlan.weather),
    critique: {
      initialIssues: Array.isArray(critique.initialIssues) ? critique.initialIssues : [],
      revisionsApplied: Array.isArray(critique.revisionsApplied) ? critique.revisionsApplied : []
    }
  }
}

function normalizeWeather(weather) {
  const safeWeather = weather && typeof weather === 'object' ? weather : {}
  return {
    summary: safeWeather.summary || '天气信息将在生成后补充。',
    source: safeWeather.source || '',
    days: Array.isArray(safeWeather.days) ? safeWeather.days : [],
    advice: Array.isArray(safeWeather.advice) ? safeWeather.advice : []
  }
}

function normalizeVariantPlan(plan, input, index) {
  const variant = ['classic', 'photoFood', 'familyRelaxed'].includes(plan.variant) ? plan.variant : input.selectedVariants?.[index] || 'classic'
  const days = Array.isArray(plan.days) ? plan.days : []
  return {
    ...plan,
    variant,
    title: plan.title || `${input.destination || '目的地'}旅行安排`,
    positioning: plan.positioning || '按照家人的节奏整理出的旅行安排。',
    heroImageUrl: plan.heroImageUrl || '',
    heroImageAlt: plan.heroImageAlt || `${input.destination || '目的地'}旅行照片`,
    totalFatigueLevel: ['low', 'medium', 'high'].includes(plan.totalFatigueLevel) ? plan.totalFatigueLevel : 'medium',
    bestFor: plan.bestFor || '',
    days: days.map((day, dayIndex) => ({
      day: day.day || dayIndex + 1,
      date: day.date || input.startDate || '',
      theme: day.theme || '轻松游览',
      areaFocus: day.areaFocus || '',
      summary: day.summary || '',
      slots: Array.isArray(day.slots) ? day.slots : [],
      dailyBudgetHint: day.dailyBudgetHint || '',
      riskCheck: day.riskCheck || ''
    }))
  }
}

export async function createTravelPlan(input, options = {}) {
  if (input.useMock) {
    options.onProgress?.({ stage: 'mock', message: '正在整理示例行程。' })
    return enrichPlanImages(await enrichPlanWeather(buildMockPlan(input), input), input.destination)
  }

  const apiKey = getDeepSeekApiKey()
  if (!apiKey) {
    throw new Error('没有找到 DEEPSEEK_API_KEY，真实行程无法生成。请在 Vercel 环境变量中配置 DEEPSEEK_API_KEY。')
  }

  options.onProgress?.({ stage: 'references', message: '正在读取攻略材料和参考链接。' })
  const normalizedInput = await prepareInputMaterials(input)
  options.onProgress?.({ stage: 'deepseek', message: 'DeepSeek 正在推理行程，请保持页面打开。' })
  const content = options.stream
    ? await requestDeepSeekStream(apiKey, normalizedInput, options.onProgress, options)
    : await requestDeepSeek(apiKey, normalizedInput, options)

  options.onProgress?.({ stage: 'normalize', message: '正在整理行程结构。' })
  const plan = await enrichPlanWeather(normalizePlan(parseJsonContent(content), input), input)
  options.onProgress?.({ stage: 'images', message: '正在补充封面图和天气。' })
  return enrichPlanImages(plan, input.destination)
}

async function requestDeepSeek(apiKey, input, options = {}) {
  const response = await fetchWithTimeout('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(buildDeepSeekRequest(input, false, options))
  }, DEEPSEEK_TIMEOUT_MS)

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`DeepSeek 请求失败：${response.status} ${detail}`)
  }

  const payload = await response.json()
  const content = payload.choices?.[0]?.message?.content
  if (!content) throw new Error('DeepSeek 返回内容为空。')
  return content
}

async function requestDeepSeekStream(apiKey, input, onProgress, options = {}) {
  const response = await fetchWithTimeout('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(buildDeepSeekRequest(input, true, options))
  }, DEEPSEEK_TIMEOUT_MS)

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`DeepSeek 请求失败：${response.status} ${detail}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('DeepSeek 流式响应不可读。')
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''
  let lastProgressAt = Date.now()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() || ''
    for (const part of parts) {
      const lines = part.split('\n').filter((line) => line.startsWith('data:'))
      for (const line of lines) {
        const data = line.replace(/^data:\s*/, '').trim()
        if (!data || data === '[DONE]') continue
        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta
          if (delta?.content) content += delta.content
          if (Date.now() - lastProgressAt > 2500) {
            lastProgressAt = Date.now()
            onProgress?.({ stage: 'deepseek', message: 'DeepSeek 仍在生成行程内容。' })
          }
        } catch {}
      }
    }
  }

  if (!content.trim()) throw new Error('DeepSeek 流式返回内容为空。')
  return content
}

function buildDeepSeekRequest(input, stream, options = {}) {
  const compact = Boolean(options.compact)
  const prompt = options.prompt || (compact ? buildCompactTravelPlannerPrompt(input) : buildTravelPlannerPrompt(input))
  const maxTokens = options.maxTokens || (compact ? Math.min(Number(process.env.TRAVEL_MAX_TOKENS || 4200), 4200) : Number(process.env.TRAVEL_MAX_TOKENS || 9000))
  const reasoningEffort = options.reasoningEffort || (compact
    ? process.env.TRAVEL_COMPACT_REASONING_EFFORT || 'medium'
    : process.env.TRAVEL_REASONING_EFFORT || 'high')
  return {
    model: MODEL_NAME,
    messages: [
      { role: 'system', content: '你是一个只返回严格 JSON 的家庭旅行规划 API。不要输出 Markdown 代码块。' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.35,
    max_tokens: maxTokens,
    reasoning_effort: reasoningEffort,
    thinking: { type: 'enabled' },
    response_format: { type: 'json_object' },
    stream
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

export async function createTravelPlanFoundation(input, options = {}) {
  const apiKey = getDeepSeekApiKey()
  if (!apiKey) throw new Error('没有找到 DEEPSEEK_API_KEY，真实行程无法生成。')
  const normalizedInput = await prepareInputMaterials(input)
  const content = await requestDeepSeekStream(apiKey, normalizedInput, options.onProgress, {
    prompt: buildTravelFoundationPrompt(normalizedInput),
    maxTokens: Number(process.env.TRAVEL_FOUNDATION_MAX_TOKENS || 3200),
    reasoningEffort: process.env.TRAVEL_WORKFLOW_REASONING_EFFORT || 'high'
  })
  return parseJsonContent(content)
}

export async function createTravelPlanSkeleton(input, foundation, options = {}) {
  const apiKey = getDeepSeekApiKey()
  if (!apiKey) throw new Error('没有找到 DEEPSEEK_API_KEY，真实行程无法生成。')
  const content = await requestDeepSeekStream(apiKey, input, options.onProgress, {
    prompt: buildTravelSkeletonPrompt(input, foundation),
    maxTokens: Number(process.env.TRAVEL_SKELETON_MAX_TOKENS || 3600),
    reasoningEffort: process.env.TRAVEL_WORKFLOW_REASONING_EFFORT || 'high'
  })
  return parseJsonContent(content)
}

export async function createTravelPlanDay(input, foundation, dayContext, options = {}) {
  const apiKey = getDeepSeekApiKey()
  if (!apiKey) throw new Error('没有找到 DEEPSEEK_API_KEY，真实行程无法生成。')
  const content = await requestDeepSeekStream(apiKey, input, options.onProgress, {
    prompt: buildTravelDayPrompt(input, foundation, dayContext),
    maxTokens: Number(process.env.TRAVEL_DAY_MAX_TOKENS || 4200),
    reasoningEffort: process.env.TRAVEL_WORKFLOW_REASONING_EFFORT || 'high'
  })
  return parseJsonContent(content)
}

export async function finalizeTravelPlanWorkflow(input, foundation, dayResults = [], skeleton = null) {
  const selectedVariants = Array.isArray(input.selectedVariants) && input.selectedVariants.length ? input.selectedVariants : ['classic']
  const planDaysByVariant = new Map(selectedVariants.map((variant) => [variant, []]))
  const critique = { initialIssues: [], revisionsApplied: [] }

  for (const result of dayResults) {
    for (const item of result?.plans || []) {
      const variant = item.variant || 'classic'
      if (!planDaysByVariant.has(variant)) planDaysByVariant.set(variant, [])
      if (item.day) planDaysByVariant.get(variant).push(item.day)
    }
    if (Array.isArray(result?.critique?.initialIssues)) critique.initialIssues.push(...result.critique.initialIssues)
    if (Array.isArray(result?.critique?.revisionsApplied)) critique.revisionsApplied.push(...result.critique.revisionsApplied)
  }

  const plans = selectedVariants.map((variant) => {
    const guidance = foundation?.variantGuidance?.[variant] || {}
    return {
      variant,
      title: guidance.title || `${input.destination}旅行安排`,
      positioning: guidance.positioning || '按家人的节奏整理出的旅行安排。',
      heroImageUrl: '',
      heroImageAlt: guidance.heroImageAlt || `${input.destination}核心景点`,
      totalFatigueLevel: guidance.totalFatigueLevel || inferPlanFatigue(planDaysByVariant.get(variant)),
      bestFor: guidance.bestFor || '',
      days: (planDaysByVariant.get(variant) || []).sort((a, b) => Number(a.day || 0) - Number(b.day || 0))
    }
  })

  const rawPlan = {
    meta: {
      destination: input.destination,
      dateRange: `${input.startDate || ''} 至 ${input.endDate || ''}`,
      generatedAt: new Date().toISOString(),
      assumptions: Array.isArray(foundation?.meta?.assumptions) ? foundation.meta.assumptions : [],
      warnings: Array.isArray(foundation?.meta?.warnings) ? foundation.meta.warnings : []
    },
    extractedStrategy: {
      places: Array.isArray(foundation?.extractedStrategy?.places) ? foundation.extractedStrategy.places : [],
      restaurants: Array.isArray(foundation?.extractedStrategy?.restaurants) ? foundation.extractedStrategy.restaurants : [],
      notes: Array.isArray(foundation?.extractedStrategy?.notes) ? foundation.extractedStrategy.notes : [],
      rejectedItems: Array.isArray(foundation?.extractedStrategy?.rejectedItems) ? foundation.extractedStrategy.rejectedItems : [],
      selectionRationale: uniqueText([
        ...(foundation?.extractedStrategy?.selectionRationale || []),
        ...(skeleton?.routeChecks || [])
      ]).slice(0, 10)
    },
    grouping: foundation?.grouping || { byArea: {}, byTheme: {} },
    routeSkeleton: Array.isArray(skeleton?.tripSkeleton) ? skeleton.tripSkeleton : [],
    plans,
    weather: { summary: '', source: '', days: [], advice: [] },
    critique: {
      initialIssues: uniqueText([...(foundation?.critique?.initialIssues || []), ...critique.initialIssues]).slice(0, 8),
      revisionsApplied: uniqueText([...(foundation?.critique?.revisionsApplied || []), ...critique.revisionsApplied]).slice(0, 8)
    }
  }

  const normalized = normalizePlan(rawPlan, input)
  return enrichPlanImages(await enrichPlanWeather(normalized, input), input.destination)
}

function inferPlanFatigue(days = []) {
  const levels = days.flatMap((day) => day.slots || []).map((slot) => slot.fatigueLevel)
  if (levels.includes('high')) return 'high'
  if (levels.includes('medium')) return 'medium'
  return 'low'
}

async function prepareInputMaterials(input) {
  const referenceUrls = uniqueUrls([...(input.referenceLinks || []), ...extractLinksFromText(input.strategyText)])
  const referenceMaterials = SHOULD_FETCH_REFERENCE_LINKS
    ? await resolveReferenceLinks(referenceUrls)
    : referenceUrls.map((url) => ({
        url,
        status: 'linked',
        error: '当前配置为不抓取链接正文；请把关键攻略文字粘贴到输入框，AI 会优先使用。'
      }))
  if (!referenceMaterials.length) return input
  return {
    ...input,
    referenceMaterials,
    strategyText: [
      input.strategyText?.trim(),
      SHOULD_FETCH_REFERENCE_LINKS
        ? '以下是服务端解析参考链接得到的材料。请注意优先级低于用户直接粘贴的自制攻略文本，但高于你自行补充的常识信息：'
        : '以下是用户提供的参考链接。当前配置未抓取链接正文；请只把这些链接作为参考线索，不要声称已经读取链接正文：',
      referenceMaterials.map(formatReferenceMaterial).join('\n\n')
    ].filter(Boolean).join('\n\n')
  }
}

function extractLinksFromText(text) {
  return String(text || '').match(/https?:\/\/[^\s，。；、]+/g) || []
}

function uniqueUrls(urls) {
  return [...new Set(urls.map((url) => String(url || '').trim()).filter(Boolean))].slice(0, 6)
}

async function resolveReferenceLinks(urls) {
  return Promise.all(uniqueUrls(urls).slice(0, MAX_REFERENCE_LINKS).map(resolveReferenceLink))
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
    const content = decodeHtml(extractReadableContent(html)).slice(0, 4200)
    return {
      url,
      resolvedUrl: response.url,
      title: title.slice(0, 240),
      description: description.slice(0, 700),
      content,
      status: response.ok ? 'ok' : 'partial',
      error: response.ok ? undefined : `HTTP ${response.status}`
    }
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

function extractReadableContent(html) {
  return uniqueText([
    extractJsonLdText(html),
    extractMetaStateText(html),
    stripHtml(html)
  ]).join('\n')
}

function extractJsonLdText(html) {
  return [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => normalizeScriptText(match[1]))
    .join('\n')
}

function extractMetaStateText(html) {
  const usefulPattern = /(?:note|detail|feed|share|initial|state|apollo|ld\+json)/i
  return [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)]
    .filter((match) => usefulPattern.test(match[0]) || /title|desc|description|tag|poi|location|address/i.test(match[1]))
    .map((match) => match[1])
    .slice(0, 4)
    .map(normalizeScriptText)
    .join('\n')
}

function normalizeScriptText(value) {
  return String(value || '')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\"/g, '"')
    .replace(/\\n|\\r|\\t/g, ' ')
    .replace(/https?:\/\/[^\s"'<>]+/g, ' ')
    .replace(/[{}[\](),;:=|<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 3200)
}

function buildTravelFoundationPrompt(input) {
  const foundationInput = {
    destination: input.destination,
    startDate: input.startDate,
    endDate: input.endDate,
    travelers: input.travelers,
    hotelArea: input.hotelArea,
    hotelStays: input.hotelStays,
    budget: input.budget,
    pace: input.pace,
    interests: input.interests,
    selectedVariants: input.selectedVariants,
    strategyText: String(input.strategyText || '').slice(0, 7000),
    feedback: input.feedback
  }

  return `
你是一个严谨、会自我审查的家庭旅行总规划师。请先做全局规划，不要生成每日完整行程。

用户输入：
${JSON.stringify(foundationInput, null, 2)}

要求：
1. 只输出严格 JSON。
2. 目的地 "${input.destination}" 是硬约束；如果参考链接与目的地冲突，必须忽略并写入 warnings/rejectedItems。
3. 深度分析用户需求、攻略文本、酒店位置、同行人、预算、节奏和兴趣。
4. 输出候选地点池、餐厅池、区域分组、主题分组、每个版本的风格指导、整体路线原则。
5. 不要输出每天的上午/午餐/下午/晚餐/晚上安排，每日安排由后续步骤单独生成。
6. 质量优先，可以使用 high reasoning，但最终 JSON 要紧凑。

返回 JSON：
{
  "meta": { "destination": "string", "assumptions": ["string"], "warnings": ["string"] },
  "extractedStrategy": {
    "places": [{ "id": "string", "name": "string", "type": "attraction | restaurant | cafe | shopping | hotel | transport | experience | other", "area": "string", "priority": 1, "estimatedStayMinutes": 90, "notes": "string", "sourceHint": "string", "familyFit": "high | medium | low" }],
    "restaurants": [{ "id": "string", "name": "string", "type": "restaurant | cafe | snack | other", "area": "string", "priority": 1, "estimatedStayMinutes": 60, "notes": "string", "sourceHint": "string", "familyFit": "high | medium | low" }],
    "notes": ["string"],
    "rejectedItems": ["string"],
    "selectionRationale": ["string"]
  },
  "grouping": { "byArea": { "区域名": ["地点名"] }, "byTheme": { "主题名": ["地点名"] } },
  "routePrinciples": ["string"],
  "variantGuidance": {
    "classic": { "title": "string", "positioning": "string", "totalFatigueLevel": "low | medium | high", "bestFor": "string", "heroImageAlt": "string" },
    "photoFood": { "title": "string", "positioning": "string", "totalFatigueLevel": "low | medium | high", "bestFor": "string", "heroImageAlt": "string" },
    "familyRelaxed": { "title": "string", "positioning": "string", "totalFatigueLevel": "low | medium | high", "bestFor": "string", "heroImageAlt": "string" }
  },
  "critique": { "initialIssues": ["string"], "revisionsApplied": ["string"] }
}`
}

function buildTravelSkeletonPrompt(input, foundation) {
  const dates = enumerateDateStrings(input.startDate, input.endDate)
  const compactFoundation = {
    extractedStrategy: foundation?.extractedStrategy,
    grouping: foundation?.grouping,
    routePrinciples: foundation?.routePrinciples,
    variantGuidance: foundation?.variantGuidance,
    critique: foundation?.critique
  }
  const skeletonInput = {
    destination: input.destination,
    dates,
    hotelStays: input.hotelStays,
    hotelArea: input.hotelArea,
    travelers: input.travelers,
    pace: input.pace,
    budget: input.budget,
    interests: input.interests,
    selectedVariants: input.selectedVariants
  }

  return `
你是整趟旅行的路线总控。请基于全局规划，先生成 ${dates.length} 天路线骨架，后续每天详细行程必须遵守它。

用户旅行信息：
${JSON.stringify(skeletonInput, null, 2)}

全局规划：
${JSON.stringify(compactFoundation, null, 2)}

骨架要求：
1. 只输出严格 JSON。
2. 每一天必须对应一个 date，不要漏天，不要多天。
3. 每一天必须有 primaryArea、theme、anchorPlaces、mealArea、hotel、transportLogic、avoidRepeating、fatigueTarget。
4. anchorPlaces 是当天核心地点，后续每日详情必须优先使用；不同天不要重复核心地点。
5. 相邻天区域要有逻辑：同区域集中、远距离移动安排在换酒店或轻松日，不要每天跨很远。
6. 若 7 天以上，要安排节奏波峰波谷：连续两天高强度后必须有较轻松的一天。
7. 若用户有多酒店，骨架必须体现换酒店当天的交通和低强度安排。
8. 不要生成上午/午餐/下午/晚餐/晚上 slot，只生成路线骨架。

返回 JSON：
{
  "tripSkeleton": [{
    "day": 1,
    "date": "YYYY-MM-DD",
    "theme": "string",
    "primaryArea": "string",
    "anchorPlaces": ["string"],
    "mealArea": "string",
    "hotel": "string",
    "transportLogic": "string",
    "avoidRepeating": ["string"],
    "fatigueTarget": "low | medium | high",
    "whyThisDay": "string"
  }],
  "globalUsedPlacePolicy": ["string"],
  "routeChecks": ["string"]
}`
}

function buildTravelDayPrompt(input, foundation, dayContext = {}) {
  const selectedVariants = Array.isArray(input.selectedVariants) && input.selectedVariants.length ? input.selectedVariants : ['classic']
  const compactFoundation = {
    extractedStrategy: foundation?.extractedStrategy,
    grouping: foundation?.grouping,
    routePrinciples: foundation?.routePrinciples,
    variantGuidance: foundation?.variantGuidance,
    critique: foundation?.critique
  }
  const tripSkeleton = Array.isArray(dayContext.tripSkeleton?.tripSkeleton)
    ? dayContext.tripSkeleton.tripSkeleton
    : Array.isArray(dayContext.tripSkeleton)
      ? dayContext.tripSkeleton
      : []
  const dayInput = {
    destination: input.destination,
    date: dayContext.date,
    dayIndex: dayContext.dayIndex,
    dayCount: dayContext.dayCount,
    skeletonDay: dayContext.skeletonDay,
    tripSkeleton,
    usedPlaces: dayContext.usedPlaces || [],
    usedAreas: dayContext.usedAreas || [],
    travelers: input.travelers,
    hotel: dayContext.hotel || input.hotelArea,
    pace: input.pace,
    budget: input.budget,
    interests: input.interests,
    selectedVariants,
    previousDays: dayContext.previousDays || [],
    feedback: input.feedback
  }

  return `
你是家庭旅行每日行程规划师。请只生成第 ${dayContext.dayIndex} 天的详细安排，并对每个用户选择的版本都给出当天安排。

全局规划：
${JSON.stringify(compactFoundation, null, 2)}

当天输入：
${JSON.stringify(dayInput, null, 2)}

要求：
1. 只输出严格 JSON。
2. 当天目的地和地点必须围绕 "${input.destination}"。
3. 每个版本当天必须包含 5 个 slot：上午、午餐、下午、晚餐、晚上。
4. 每个 slot 必须有推荐理由、停留时间、拍照建议、美食建议、家庭友好提醒、备选方案、交通提示、疲劳等级。
5. 必须结合当天酒店 "${dayInput.hotel || ''}" 规划出发、转场和回程。
6. 必须遵守 skeletonDay：当天主题、主区域、核心地点和疲劳目标不能随意偏离。
7. 不要重复 usedPlaces 中已经作为核心游览的地点，除非是酒店、交通或用户反馈明确要求。
8. 必须参考 tripSkeleton，保证当天和前后天区域衔接自然，不要突然跨很远。
9. 深度检查饭点是否合理、是否绕路、是否过累；修正后再输出。
10. 文案生活化、具体、可执行。不要堆砌模板话。
11. 不要输出其他天。

返回 JSON：
{
  "plans": [{
    "variant": "classic | photoFood | familyRelaxed",
    "day": {
      "day": 1,
      "date": "YYYY-MM-DD",
      "theme": "string",
      "areaFocus": "string",
      "summary": "string",
      "slots": [{ "timeLabel": "上午 | 午餐 | 下午 | 晚餐 | 晚上", "placeName": "string", "area": "string", "reason": "string", "stayMinutes": 90, "photoTips": "string", "foodTips": "string", "familyFriendlyTips": "string", "backupPlan": "string", "transportHint": "string", "fatigueLevel": "low | medium | high" }],
      "dailyBudgetHint": "string",
      "riskCheck": "string"
    }
  }],
  "critique": { "initialIssues": ["string"], "revisionsApplied": ["string"] }
}`
}

function buildCompactTravelPlannerPrompt(input) {
  const compactInput = {
    destination: input.destination,
    startDate: input.startDate,
    endDate: input.endDate,
    travelers: input.travelers,
    hotelArea: input.hotelArea,
    hotelStays: input.hotelStays,
    budget: input.budget,
    pace: input.pace,
    interests: input.interests,
    selectedVariants: input.selectedVariants,
    feedback: input.feedback,
    strategyText: String(input.strategyText || '').slice(0, 3200),
    previousPlan: input.previousPlan ? {
      meta: input.previousPlan.meta,
      plans: (input.previousPlan.plans || []).map((plan) => ({
        variant: plan.variant,
        title: plan.title,
        days: (plan.days || []).map((day) => ({
          day: day.day,
          date: day.date,
          theme: day.theme,
          slots: (day.slots || []).map((slot) => ({
            timeLabel: slot.timeLabel,
            placeName: slot.placeName,
            area: slot.area
          }))
        }))
      }))
    } : undefined
  }

  return `
你是一个严谨、会自我审查的家庭旅行规划师。请在保持深度判断的前提下，输出紧凑但可直接渲染的 JSON。

用户输入：
${JSON.stringify(compactInput, null, 2)}

核心要求：
1. 只输出严格 JSON，不要 Markdown。
2. 目的地 "${input.destination}" 是硬约束；如果参考内容与目的地冲突，忽略冲突并写入 warnings/rejectedItems。
3. 只生成 selectedVariants 中的版本。每个版本每天必须有 5 个 slot：上午、午餐、下午、晚餐、晚上。
4. 每个 slot 必须包含 placeName、area、reason、stayMinutes、photoTips、foodTips、familyFriendlyTips、backupPlan、transportHint、fatigueLevel。
5. 交通提示必须结合当天 hotelStays；如果只有一个酒店，默认每天从该酒店出发并回到该酒店。
6. 对饭点、绕路、疲劳做自我批判并修正，但只把结论写进 critique，避免长篇推理。
7. 文案要生活化、具体、可执行；每个说明控制在 18 个中文字符以内。
8. heroImageUrl 留空，weather 可留空对象，服务端会补天气和图片。
9. extractedStrategy 只保留最多 8 个核心地点、5 个餐厅；grouping 可简短。

必须返回这个 JSON 形状：
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
    "heroImageUrl": "",
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
  "weather": { "summary": "", "source": "", "days": [], "advice": [] },
  "critique": { "initialIssues": ["string"], "revisionsApplied": ["string"] }
}`
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
2. 目的地是硬约束，最终 meta.destination、标题、地点池和每日行程都必须围绕用户输入的 destination：${input.destination}。如果参考链接正文与该目的地不一致，必须忽略冲突内容，并在 warnings 或 rejectedItems 里说明“参考链接疑似与目的地不一致”。
3. 只生成用户勾选的版本：classic、photoFood、familyRelaxed。
4. 每套行程按天展示，每天必须包含上午、午餐、下午、晚餐、晚上 5 个 slot。
5. 每个地点必须包含推荐理由、停留时间、拍照建议、美食建议、家庭友好提醒、备选方案、交通提示、疲劳等级。
6. 信息优先级必须严格遵守：用户直接填写的目的地/日期/酒店/反馈 > 用户直接粘贴的攻略文本 > 服务端解析出的参考链接内容 > 用户提供但未解析正文的链接线索 > AI 根据常识补充的信息。
7. hotelStays 表示多日旅行的酒店安排。每天必须根据该日期对应酒店规划出发、回程和交通提示；如果只有一个酒店，则默认全程相同。
8. 用户 feedback 可以是自然语言精确编辑指令，例如“把 Day 2 上午清水寺改成伏见稻荷”。若 previousPlan 存在，必须尽量保留未被用户点名修改的内容。
9. priority 是候选点优先级，1 最低、5 最高。不要把它当作时间顺序。
10. heroImageUrl 可以留空，服务端会用真实图库搜索补图；heroImageAlt 请写行程核心景点描述。

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
  "weather": { "summary": "string", "source": "string", "days": [{ "date": "YYYY-MM-DD", "condition": "string", "temperatureMin": 10, "temperatureMax": 20, "precipitationProbability": 30 }], "advice": ["string"] },
  "critique": { "initialIssues": ["string"], "revisionsApplied": ["string"] }
}`
}

async function enrichPlanWeather(plan, input) {
  const weather = await fetchTravelWeather(input.destination, input.startDate, input.endDate)
  return { ...plan, weather }
}

async function fetchTravelWeather(destination, startDate, endDate) {
  try {
    const geo = await geocodeDestination(destination)
    if (!geo) return buildWeatherFallback(startDate, endDate, '暂时没有定位到目的地，建议出发前再看一次天气。')
    const useSeasonal = daysFromToday(startDate) > FORECAST_HORIZON_DAYS
    const endpoint = useSeasonal ? 'https://seasonal-api.open-meteo.com/v1/seasonal' : 'https://api.open-meteo.com/v1/forecast'
    const dailyParams = useSeasonal
      ? 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum'
      : 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
    const url = [
      endpoint,
      `?latitude=${encodeURIComponent(geo.latitude)}`,
      `&longitude=${encodeURIComponent(geo.longitude)}`,
      `&start_date=${encodeURIComponent(startDate)}`,
      `&end_date=${encodeURIComponent(endDate)}`,
      `&daily=${dailyParams}`,
      '&timezone=auto'
    ].join('')
    const response = await fetchWithTimeout(url, {}, WEATHER_REQUEST_TIMEOUT_MS)
    if (!response.ok) return buildWeatherFallback(startDate, endDate, useSeasonal ? '远期天气趋势暂时不可用，建议临近出发前再刷新。' : '出行日期可能离现在较远，天气预报暂未开放，建议临近出发前再确认。')
    const data = await response.json()
    const days = (data.daily?.time || []).map((date, index) => ({
      date,
      condition: weatherCodeLabel(getDailyValue(data.daily?.weather_code, index)),
      temperatureMin: Math.round(Number(getDailyValue(data.daily?.temperature_2m_min, index) ?? 0)),
      temperatureMax: Math.round(Number(getDailyValue(data.daily?.temperature_2m_max, index) ?? 0)),
      precipitationProbability: useSeasonal
        ? precipitationProbabilityFromSum(getDailyValue(data.daily?.precipitation_sum, index))
        : Math.round(Number(getDailyValue(data.daily?.precipitation_probability_max, index) ?? 0)),
      precipitationLabel: useSeasonal
        ? `降水趋势 ${formatPrecipitationSum(getDailyValue(data.daily?.precipitation_sum, index))}`
        : ''
    }))
    if (!days.length) return buildWeatherFallback(startDate, endDate, '出行日期可能离现在较远，天气预报暂未开放，建议临近出发前再确认。')
    return buildWeatherSummary(days, geo.name || destination, useSeasonal)
  } catch {
    return buildWeatherFallback(startDate, endDate, '天气服务暂时不可用，建议出发前再刷新一次。')
  }
}

async function geocodeDestination(destination) {
  const known = knownDestinationGeo(destination)
  if (known) return known
  const candidates = uniqueText([destination, translateImageTerm(destination), `${destination} China`]).slice(0, 2)
  for (const candidate of candidates) {
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(candidate)}&count=1&language=zh&format=json`
      const response = await fetchWithTimeout(url, {}, WEATHER_REQUEST_TIMEOUT_MS)
      if (!response.ok) continue
      const data = await response.json()
      if (data.results?.[0]) return data.results[0]
    } catch {}
  }
  return null
}

function knownDestinationGeo(destination) {
  const text = String(destination || '')
  const known = [
    { keys: ['曲阜', '孔庙', '孔府', '孔林', '三孔', 'Qufu'], name: '曲阜', latitude: 35.5809, longitude: 116.9865 },
    { keys: ['北京', 'Beijing'], name: '北京', latitude: 39.9042, longitude: 116.4074 },
    { keys: ['上海', 'Shanghai'], name: '上海', latitude: 31.2304, longitude: 121.4737 },
    { keys: ['西安', 'Xian', "Xi'an"], name: '西安', latitude: 34.3416, longitude: 108.9398 },
    { keys: ['成都', 'Chengdu'], name: '成都', latitude: 30.5728, longitude: 104.0668 },
    { keys: ['杭州', 'Hangzhou'], name: '杭州', latitude: 30.2741, longitude: 120.1551 },
    { keys: ['苏州', 'Suzhou'], name: '苏州', latitude: 31.2989, longitude: 120.5853 },
    { keys: ['广州', 'Guangzhou'], name: '广州', latitude: 23.1291, longitude: 113.2644 },
    { keys: ['深圳', 'Shenzhen'], name: '深圳', latitude: 22.5431, longitude: 114.0579 },
    { keys: ['三亚', 'Sanya'], name: '三亚', latitude: 18.2528, longitude: 109.5119 },
    { keys: ['京都', 'Kyoto'], name: '京都', latitude: 35.0116, longitude: 135.7681 },
    { keys: ['东京', 'Tokyo'], name: '东京', latitude: 35.6762, longitude: 139.6503 },
    { keys: ['大阪', 'Osaka'], name: '大阪', latitude: 34.6937, longitude: 135.5023 },
    { keys: ['奈良', 'Nara'], name: '奈良', latitude: 34.6851, longitude: 135.8048 }
  ]
  return known.find((item) => item.keys.some((key) => text.toLowerCase().includes(key.toLowerCase()))) || null
}

function getDailyValue(value, index) {
  return Array.isArray(value) ? value[index] : value
}

function daysFromToday(dateString) {
  const target = new Date(`${dateString}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (Number.isNaN(target.getTime())) return 0
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

function precipitationProbabilityFromSum(value) {
  const amount = Number(value || 0)
  return Math.max(0, Math.min(90, Math.round(amount * 18)))
}

function formatPrecipitationSum(value) {
  const amount = Number(value || 0)
  return `${Number.isFinite(amount) ? amount.toFixed(amount >= 10 ? 0 : 1) : '0'}mm`
}

function buildWeatherSummary(days, destination, isSeasonal = false) {
  const min = Math.min(...days.map((day) => day.temperatureMin))
  const max = Math.max(...days.map((day) => day.temperatureMax))
  const rainyDays = days.filter((day) => day.precipitationProbability >= 45)
  const hotDays = days.filter((day) => day.temperatureMax >= 30)
  const advice = [
    isSeasonal ? '这是远期天气趋势预估，适合做衣物和节奏准备，出发前 1-3 天建议再看精确预报。' : '这是临近天气预报，可用于安排室内外顺序。',
    rainyDays.length ? '有较高降雨风险，建议带轻便雨具，鞋子优先选防滑好走的。' : '降雨风险不高，但长时间户外仍建议带一把轻便伞。',
    hotDays.length ? '白天温度偏高，上午优先安排户外，午后多留室内和休息点。' : '温度整体适中，可以按原计划安排步行，但仍要预留补水和休息。',
    '天气会影响排队和拍照体验，出发前一天建议再刷新确认。'
  ]
  return {
    summary: `${destination}行程期间约 ${min}°C - ${max}°C，${rainyDays.length ? '有降雨风险' : '整体适合出行'}`,
    source: isSeasonal ? 'Open-Meteo 远期趋势' : 'Open-Meteo',
    days,
    advice
  }
}

function buildWeatherFallback(startDate, endDate, reason) {
  return {
    summary: '天气预报暂时不可用',
    source: 'Open-Meteo',
    days: enumerateDateStrings(startDate, endDate).slice(0, 7).map((date) => ({
      date,
      condition: '待确认',
      temperatureMin: 0,
      temperatureMax: 0,
      precipitationProbability: 0
    })),
    advice: [reason, '建议把雨具、防晒、舒适鞋作为默认准备项。']
  }
}

function weatherCodeLabel(code) {
  const value = Number(code)
  if ([0].includes(value)) return '晴'
  if ([1, 2, 3].includes(value)) return '多云'
  if ([45, 48].includes(value)) return '雾'
  if ([51, 53, 55, 56, 57].includes(value)) return '小雨'
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(value)) return '雨'
  if ([71, 73, 75, 77, 85, 86].includes(value)) return '雪'
  if ([95, 96, 99].includes(value)) return '雷阵雨'
  return '待确认'
}

function enumerateDateStrings(startDate, endDate) {
  const cursor = new Date(`${startDate}T00:00:00`)
  const last = new Date(`${endDate}T00:00:00`)
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(last.getTime())) return []
  const dates = []
  while (cursor <= last && dates.length < 30) {
    dates.push(formatDateString(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

function formatDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

async function enrichPlanImages(plan, destination) {
  const enrichedPlans = await Promise.all((plan.plans || []).map(async (item) => {
    const leadPlace = getPlanLeadPlace(item)
    const image = await searchTravelImage(`${destination} ${leadPlace} travel landmark`, destination, leadPlace)
    return {
      ...item,
      heroImageUrl: image?.url || trustedExistingImage(item.heroImageUrl, destination) || curatedTravelImage(destination, leadPlace)?.url || fallbackTravelImage(destination),
      heroImageAlt: image?.alt || item.heroImageAlt || `${destination}${leadPlace}宣传照片`,
      heroImageCredit: image?.credit || ''
    }
  }))
  return { ...plan, plans: enrichedPlans }
}

function trustedExistingImage(url, destination) {
  const value = String(url || '').trim()
  if (!value || /loremflickr\.com|\/bg\.jpg/i.test(value)) return ''
  if (/曲阜|孔庙|孔府|孔林|三孔/i.test(destination || '') && !/qufu|confuc|kong|wikimedia|wikipedia/i.test(value)) return ''
  return value
}

function getPlanLeadPlace(plan) {
  const firstPlace = (plan.days || []).flatMap((day) => day.slots || []).find((slot) => !['午餐', '晚餐'].includes(slot.timeLabel))
  return firstPlace?.placeName || plan.title || '旅行'
}

async function searchTravelImage(_query, destination, leadPlace) {
  const keywords = buildImageKeywords(destination, leadPlace)
  const query = `${keywords.join(' ')} travel landmark`
  const curated = curatedTravelImage(destination, leadPlace)
  if (curated) return curated
  const results = await Promise.all([
    searchUnsplash(query),
    searchPexels(query),
    searchCommonsImage(query),
    searchWikipediaImage(leadPlace),
    searchWikipediaImage(destination)
  ])
  return results.find(Boolean) || null
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
    ['三亚', 'Sanya China'],
    ['曲阜', 'Qufu Shandong China Confucius Temple'],
    ['孔庙', 'Temple of Confucius Qufu'],
    ['孔府', 'Kong Family Mansion Qufu'],
    ['孔林', 'Cemetery of Confucius Qufu'],
    ['三孔', 'Qufu Three Confucian Sites'],
    ['尼山', 'Nishan Qufu']
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
    const response = await fetchWithTimeout(url, { headers: { Authorization: `Client-ID ${key}` } }, IMAGE_REQUEST_TIMEOUT_MS)
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
    const response = await fetchWithTimeout(url, { headers: { Authorization: key } }, IMAGE_REQUEST_TIMEOUT_MS)
    if (!response.ok) return null
    const data = await response.json()
    const photo = data.photos?.[0]
    return photo ? { url: photo.src?.large2x || photo.src?.large, alt: photo.alt || query, credit: `Pexels · ${photo.photographer || ''}` } : null
  } catch {
    return null
  }
}

async function searchCommonsImage(query) {
  if (!query) return null
  try {
    const url = [
      'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*',
      '&generator=search&gsrnamespace=6&gsrlimit=8',
      `&gsrsearch=${encodeURIComponent(query)}`,
      '&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=1600'
    ].join('')
    const response = await fetchWithTimeout(url, { headers: { 'User-Agent': 'family-travel-planner/1.0' } }, IMAGE_REQUEST_TIMEOUT_MS)
    if (!response.ok) return null
    const data = await response.json()
    const pages = Object.values(data.query?.pages || {})
    const image = pages
      .map((page) => page.imageinfo?.[0])
      .filter((info) => info?.thumburl && /^image\/(jpeg|png|webp)$/i.test(info.mime || '') && Number(info.width || 0) >= 900)
      .sort((a, b) => Number(b.width || 0) - Number(a.width || 0))[0]
    return image ? { url: image.thumburl || image.url, alt: query, credit: 'Wikimedia Commons' } : null
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
  const results = await Promise.all(endpoints.map(async (endpoint) => {
    try {
      const response = await fetchWithTimeout(endpoint, { headers: { 'User-Agent': 'family-travel-planner/1.0' } }, IMAGE_REQUEST_TIMEOUT_MS)
      if (!response.ok) return null
      const data = await response.json()
      if (data.thumbnail?.source) return { url: data.thumbnail.source.replace(/\/\d+px-/, '/1200px-'), alt: data.title || query, credit: 'Wikipedia' }
    } catch {
      return null
    }
    return null
  }))
  return results.find(Boolean) || null
}

function fallbackTravelImage(destination) {
  const text = String(destination || '')
  if (/京都|日本|奈良|大阪|东京/.test(text)) return 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1600&q=84'
  if (/海|岛|三亚|冲绳/.test(text)) return 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=84'
  if (/山|谷|川|湖|林|自然/.test(text)) return 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=84'
  return 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=84'
}

function curatedTravelImage(destination, leadPlace) {
  const text = `${destination || ''} ${leadPlace || ''}`
  if (/曲阜|孔庙|孔府|孔林|三孔|Confucius|Qufu/i.test(text)) {
    return {
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Qufu_Confucian_Temple_49189-Qufu_%2849055643376%29.jpg/1920px-Qufu_Confucian_Temple_49189-Qufu_%2849055643376%29.jpg',
      alt: '曲阜孔庙建筑照片',
      credit: 'Wikimedia Commons'
    }
  }
  return null
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
