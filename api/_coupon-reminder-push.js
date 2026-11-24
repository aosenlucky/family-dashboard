const tokens = value => String(value || '').split(/[,，;\n\r]+/).map(v => v.trim()).filter(Boolean)
export function reminderRecipients(env = process.env, preview = false) {
  if (preview) return [{ id: 'aosen', label: 'Aosen', simulated: true }, { id: 'xiaoyue', label: '小悦', simulated: true }]
  const result = []
  if (env.COUPON_AOSEN_TOKEN) result.push({ id: 'aosen', label: 'Aosen', token: env.COUPON_AOSEN_TOKEN.trim(), accessKey: env.COUPON_AOSEN_PUSHPLUS_ACCESS_KEY || env.COUPON_PUSHPLUS_ACCESS_KEY })
  if (env.COUPON_XIAOYUE_TOKEN) result.push({ id: 'xiaoyue', label: '小悦', token: env.COUPON_XIAOYUE_TOKEN.trim(), accessKey: env.COUPON_XIAOYUE_PUSHPLUS_ACCESS_KEY || env.COUPON_PUSHPLUS_ACCESS_KEY })
  if (!result.length) {
    const legacy = tokens([env.SERVERCHAN_KEY, env.PUSHPLUS_TOKEN, env.PUSHPLUS_KEY, env.PUSHPLUS_TOKENS, env.pushplus_Token, env.pushplus_token].filter(Boolean).join(','))[0]
    if (legacy) result.push({ id: 'aosen', label: '现有家庭通知渠道（未区分成员）', token: legacy, accessKey: env.COUPON_PUSHPLUS_ACCESS_KEY, shared: true })
  }
  // A duplicated token is one destination; expose the shared nature instead of sending twice.
  for (const r of result) if (result.some(other => other.id !== r.id && other.token === r.token)) r.shared = true
  return result
}
export function publicRecipients(recipients) { return recipients.map(({ id, label, shared, simulated }) => ({ id, label, ...(shared ? { shared: true } : {}), ...(simulated ? { simulated: true } : {}) })) }
export function notificationText(events, coupons, siteUrl = process.env.COUPON_SITE_URL || 'https://senyuefamily.top') {
  let link = ''
  try { const url = new URL(siteUrl); if (url.protocol === 'https:' && !url.username && !url.password) link = `${url.origin}/#/life/coupons` } catch {}
  const lines = events.map(e => {
    const coupon = coupons.find(c => String(c.id) === e.couponId)
    const name = String(coupon?.merchant || coupon?.title || '收藏的券').replace(/[\r\n<>\[\]()`*_~]/g, ' ').slice(0, 70)
    return `· ${name}：${e.kind === 'booking' ? '预约截止' : '使用截止'} ${e.deadline}`
  })
  return { title: `拾光小笺 · ${events.length} 张券可以安排了`, content: `一起看看哪个日子合适。\n${lines.join('\n')}\n${link ? `查看套餐与使用规则：${link}` : '请打开家庭网站查看套餐与使用规则。'}` }
}
export async function sendReminder(recipient, notification, { fetcher = fetch } = {}) {
  const token = recipient.token, provider = token?.startsWith('SCT') ? 'serverchan' : 'pushplus'
  if (!token) return { status: 'failed', provider, reason: '接收渠道尚未配置。' }
  try {
    const response = await fetcher(provider === 'serverchan' ? `https://sctapi.ftqq.com/${encodeURIComponent(token)}.send` : 'https://www.pushplus.plus/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(12000),
      body: JSON.stringify(provider === 'serverchan' ? { title: notification.title, desp: notification.content } : { token, title: notification.title, content: notification.content, template: 'txt' })
    })
    let payload
    try { payload = await response.json() } catch { return { status: 'unknown', provider, reason: '平台响应无法核对，暂不自动重发。' } }
    const ok = response.ok && (provider === 'pushplus' ? Number(payload.code) === 200 : Number(payload.code) === 0)
    if (ok) {
      const rawId = provider === 'pushplus' ? payload.data : payload.data?.pushid
      return { status: 'accepted', provider, providerMessageId: typeof rawId === 'string' || typeof rawId === 'number' ? String(rawId).slice(0, 150) : '', reason: '平台已接收，尚不代表收件人已读。' }
    }
    return { status: response.status >= 500 ? 'unknown' : 'failed', provider, reason: response.status >= 500 ? '平台暂时异常，发送结果待核对。' : '平台拒绝了消息，请检查接收渠道或额度。' }
  } catch { return { status: 'unknown', provider, reason: '请求超时或网络中断，结果未知，暂不自动重发。' } }
}
export async function queryReminder(recipient, batch, { fetcher = fetch } = {}) {
  if (batch.provider !== 'pushplus' || !batch.providerMessageId || !recipient.accessKey) return null
  try {
    const response = await fetcher(`https://www.pushplus.plus/api/open/message/sendMessageResult?shortCode=${encodeURIComponent(batch.providerMessageId)}`, { headers: { 'access-key': recipient.accessKey }, redirect: 'error', signal: AbortSignal.timeout(8000) })
    const payload = await response.json()
    if (!response.ok || Number(payload.code) !== 200) return null
    if (Number(payload.data?.status) === 2) return { status: 'sent', reason: '平台报告发送成功，不代表收件人已读。' }
    if (Number(payload.data?.status) === 3) return { status: 'failed', reason: '平台报告发送失败，稍后重试。' }
    return null
  } catch { return null }
}
