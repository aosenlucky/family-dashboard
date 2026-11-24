// Plain date strings are calendar dates, not UTC instants. Shared by the UI and tests.
export const COUPON_STATUSES = ['wish', 'unused', 'booked', 'used', 'refunded'];
export const COUPON_CATEGORIES = ['hotel', 'attraction', 'other'];
export function isCouponDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value && value >= '1900-01-01' && value <= '2199-12-31';
}
export function dayKey(now = new Date(), timeZone = 'Asia/Shanghai') {
  if (isCouponDate(now)) return now;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now));
  return ['year', 'month', 'day'].map(type => parts.find(p => p.type === type)?.value).join('-');
}
export function monthBefore(value) {
  if (!isCouponDate(value)) return '';
  const [year, month, day] = value.split('-').map(Number);
  const previous = new Date(Date.UTC(year, month - 2, 1));
  const last = new Date(Date.UTC(previous.getUTCFullYear(), previous.getUTCMonth() + 1, 0)).getUTCDate();
  previous.setUTCDate(Math.min(day, last));
  return previous.toISOString().slice(0, 10);
}
export function daysUntil(value, today = dayKey()) {
  if (!isCouponDate(value) || !isCouponDate(today)) return null;
  return Math.round((Date.parse(value + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000);
}
const text = (v, max = 200) => typeof v === 'string' ? v.trim().slice(0, max) : '';
export function normalizeCoupon(input = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const reminder = source.reminder || {};
  return {
    id: text(source.id, 100), title: text(source.title), merchant: text(source.merchant), location: text(source.location),
    category: COUPON_CATEGORIES.includes(source.category) ? source.category : 'hotel',
    summary: text(source.summary, 1200), status: COUPON_STATUSES.includes(source.status) ? source.status : 'wish',
    expiresOn: isCouponDate(source.expiresOn) ? source.expiresOn : '',
    bookingDeadline: isCouponDate(source.bookingDeadline) ? source.bookingDeadline : '',
    deadlineConfirmed: source.deadlineConfirmed === true,
    plannedOn: isCouponDate(source.plannedOn) ? source.plannedOn : '',
    advertisedPrice: text(source.advertisedPrice, 30), paidPrice: text(source.paidPrice, 30),
    rules: text(source.rules, 5000), notes: text(source.notes, 5000),
    author: source.author === '小悦' ? '小悦' : 'Aosen',
    attachments: Array.isArray(source.attachments) ? source.attachments.slice(0, 6).map(a => ({
      id: text(a?.id, 100), objectKey: text(a?.objectKey, 300), filename: text(a?.filename, 200),
      contentType: text(a?.contentType, 60), bytes: Number.isSafeInteger(a?.bytes) && a.bytes >= 0 ? a.bytes : 0
    })).filter(a => a.objectKey) : [],
    reminder: { enabled: reminder.enabled !== false, sevenDays: reminder.sevenDays === true,
      recipients: Array.isArray(reminder.recipients) ? [...new Set(reminder.recipients.filter(id => ['aosen', 'xiaoyue'].includes(id)))] : ['aosen', 'xiaoyue'] },
    createdAt: text(source.createdAt, 40), updatedAt: text(source.updatedAt, 40), usedAt: text(source.usedAt, 40)
  };
}
export function createCoupon(author = 'Aosen') {
  const now = new Date().toISOString();
  return normalizeCoupon({ id: crypto.randomUUID(), author, createdAt: now, updatedAt: now });
}
export function activeDeadline(coupon) {
  const candidates = [];
  if (coupon.status !== 'booked' && isCouponDate(coupon.bookingDeadline)) candidates.push({ date: coupon.bookingDeadline, type: 'booking', kind: 'booking', label: '预约截止' });
  if (isCouponDate(coupon.expiresOn)) candidates.push({ date: coupon.expiresOn, type: 'expiry', kind: 'expiry', label: '使用截止' });
  return candidates.sort((a, b) => a.date.localeCompare(b.date))[0] || null;
}
export function couponState(coupon, today = dayKey()) {
  if (['wish', 'used', 'refunded'].includes(coupon.status)) return coupon.status;
  if (isCouponDate(coupon.expiresOn) && coupon.expiresOn < today) return 'expired';
  return coupon.status === 'booked' ? 'booked' : 'unused';
}
export function couponSort(a, b) {
  const first = activeDeadline(a)?.date || '9999-12-31', second = activeDeadline(b)?.date || '9999-12-31';
  return first.localeCompare(second) || (b.createdAt || '').localeCompare(a.createdAt || '') || String(a.id).localeCompare(String(b.id));
}
export function couponCalendarEvents(coupons = []) {
  return coupons.flatMap(coupon => {
    if (!['unused', 'booked'].includes(coupon.status)) return [];
    const events = [], deadline = activeDeadline(coupon), name = coupon.title || coupon.merchant || '待使用的券';
    if (deadline && coupon.deadlineConfirmed) events.push({ id: `coupon-deadline-${coupon.id}`, couponId: coupon.id,
      name: `${name} · ${deadline.label}`, date: deadline.date, type: 'event', sourceType: 'coupon' });
    if (isCouponDate(coupon.plannedOn)) events.push({ id: `coupon-plan-${coupon.id}`, couponId: coupon.id,
      name: `${name} · 计划使用`, date: coupon.plannedOn, type: 'event', sourceType: 'coupon' });
    return events;
  });
}
export function validateCoupons(coupons) {
  if (coupons === undefined) return;
  if (!Array.isArray(coupons) || coupons.length > 500) throw Error('券册最多保存 500 条记录。');
  const ids = new Set();
  for (const coupon of coupons) {
    if (!coupon || typeof coupon !== 'object' || typeof coupon.id !== 'string' || !coupon.id || coupon.id.length > 100 || ids.has(coupon.id)) throw Error('券记录缺少唯一编号。');
    ids.add(coupon.id);
    if (!COUPON_STATUSES.includes(coupon.status) || !COUPON_CATEGORIES.includes(coupon.category)) throw Error('券类型或状态不正确。');
    if (!(coupon.title || coupon.merchant) || typeof (coupon.title || coupon.merchant) !== 'string') throw Error('请填写券的名称。');
    for (const field of ['expiresOn', 'bookingDeadline', 'plannedOn']) if (coupon[field] && !isCouponDate(coupon[field])) throw Error('券日期不正确，请重新核对。');
    if (typeof coupon.deadlineConfirmed !== 'boolean') throw Error('请确认券日期的核对状态。');
    if (coupon.plannedOn && coupon.expiresOn && coupon.plannedOn > coupon.expiresOn) throw Error('计划使用日期不能晚于券有效期。');
    if (coupon.attachments !== undefined && (!Array.isArray(coupon.attachments) || coupon.attachments.length > 6)) throw Error('一张券最多保存 6 张截图。');
    for (const attachment of coupon.attachments || []) {
      const match = typeof attachment?.objectKey === 'string' && attachment.objectKey.match(/^coupon\/([a-f0-9]{64})\.(jpg|png|webp|gif)$/);
      const mimes = {jpg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif'};
      if (!match || typeof attachment.id !== 'string' || attachment.id !== match[1] || typeof attachment.filename !== 'string'
        || attachment.filename.length > 200 || attachment.contentType !== mimes[match[2]]
        || !Number.isSafeInteger(attachment.bytes) || attachment.bytes < 12 || attachment.bytes > 4 * 1024 * 1024) throw Error('券截图引用不完整或无效，请重新上传原图。');
    }
    const reminder = coupon.reminder;
    if (!reminder || typeof reminder !== 'object' || typeof reminder.enabled !== 'boolean' || typeof reminder.sevenDays !== 'boolean'
      || !Array.isArray(reminder.recipients) || reminder.recipients.length > 2 || reminder.recipients.some(id => !['aosen','xiaoyue'].includes(id))) throw Error('券提醒设置不完整，请重新选择接收人。');
    for (const field of ['title','merchant','location','summary','rules','notes','advertisedPrice','paidPrice']) {
      if (coupon[field] !== undefined && typeof coupon[field] !== 'string') throw Error('券文本字段格式不正确。');
    }
    if (JSON.stringify(coupon).length > 20000) throw Error('单条券记录内容过长。');
  }
}
export function validateCouponTrash(trash) {
  if (trash === undefined) return;
  if (!Array.isArray(trash)) throw Error('回收站记录格式不正确。');
  for (const entry of trash) if (entry?.collection === 'coupons') validateCoupons([entry.item]);
}
