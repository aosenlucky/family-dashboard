export const FOOD_KINDS = ['place', 'guide', 'dish'];
export const FOOD_STATUSES = ['want', 'eaten'];
const LIMITS = { id: 100, title: 160, city: 80, area: 120, address: 300, dishes: 800, reason: 1200, sourceText: 12000, sourceUrl: 3000, notes: 5000, createdAt: 40, updatedAt: 40 };
const text = (value, limit = 200) => typeof value === 'string' ? value.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').trim().slice(0, limit) : '';
const plainObject = value => value && typeof value === 'object' && !Array.isArray(value);
export function isFoodDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value && value >= '1900-01-01' && value <= '2199-12-31';
}
export function safeFoodUrl(value) {
  if (typeof value !== 'string' || value.length > LIMITS.sourceUrl || /[\x00-\x20\x7f]/.test(value)) return '';
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}
export function extractSourceUrl(value) {
  const matches = text(value, LIMITS.sourceText).match(/https?:\/\/[^\s<>"'「」『』，。！？；、（）【】《》]+/gi) || [];
  for (const match of matches) {
    const url = safeFoodUrl(match.replace(/[，。！？；、）】》]+$/u, ''));
    if (url) return url;
  }
  return '';
}
export function normalizeCity(value) {
  return text(value, LIMITS.city).normalize('NFKC').replace(/\s+/g, '').replace(/市$/, '').toLocaleLowerCase('zh-CN');
}
export function normalizeFood(value = {}) {
  const source = plainObject(value) ? value : {};
  const result = Object.fromEntries(Object.entries(LIMITS).map(([field, limit]) => [field, text(source[field], limit)]));
  return {
    ...result, kind: FOOD_KINDS.includes(source.kind) ? source.kind : 'place',
    status: FOOD_STATUSES.includes(source.status) ? source.status : 'want',
    author: source.author === '小悦' ? '小悦' : 'Aosen', sourceUrl: safeFoodUrl(result.sourceUrl),
    visitedOn: isFoodDate(source.visitedOn) ? source.visitedOn : '',
    verdict: ['again', 'once'].includes(source.verdict) ? source.verdict : '',
    attachments: Array.isArray(source.attachments) ? source.attachments.slice(0, 6).map(a => ({
      id: text(a?.id, 100), objectKey: text(a?.objectKey, 300), filename: text(a?.filename, 200),
      contentType: text(a?.contentType, 60), bytes: Number.isSafeInteger(a?.bytes) && a.bytes >= 0 ? a.bytes : 0
    })).filter(a => a.objectKey) : []
  };
}
export function createFood(author = 'Aosen') {
  const now = new Date().toISOString();
  return normalizeFood({ id: crypto.randomUUID(), author, createdAt: now, updatedAt: now });
}
export function validateFoods(items) {
  if (items === undefined) return;
  if (!Array.isArray(items) || items.length > 1000) throw Error('寻味清单最多保存 1000 条记录。');
  const ids = new Set();
  for (const food of items) {
    if (!plainObject(food) || typeof food.id !== 'string' || !food.id.trim() || food.id.length > LIMITS.id || ids.has(food.id)) throw Error('美食记录缺少唯一编号。');
    ids.add(food.id);
    if (typeof food.title !== 'string' || !food.title.trim()) throw Error('请给这份收藏起个名字。');
    if (!FOOD_KINDS.includes(food.kind) || !FOOD_STATUSES.includes(food.status)) throw Error('美食收藏类型或状态不正确。');
    if (!['Aosen', '小悦'].includes(food.author)) throw Error('请选择记录这份美食收藏的人。');
    for (const [field, limit] of Object.entries(LIMITS)) {
      if (food[field] !== undefined && (typeof food[field] !== 'string' || food[field].length > limit)) throw Error('美食收藏内容过长或格式不正确。');
    }
    if (food.sourceUrl && !safeFoodUrl(food.sourceUrl)) throw Error('原文链接须为有效的 http 或 https 网页地址。');
    if (food.visitedOn !== undefined && food.visitedOn !== '' && !isFoodDate(food.visitedOn)) throw Error('吃过日期不正确，请重新核对。');
    if (food.verdict !== undefined && !['', 'again', 'once'].includes(food.verdict)) throw Error('用餐感受选项不正确。');
    if (food.attachments !== undefined && (!Array.isArray(food.attachments) || food.attachments.length > 6)) throw Error('一份美食收藏最多保存 6 张截图。');
    for (const attachment of food.attachments || []) {
      const match = typeof attachment?.objectKey === 'string' && attachment.objectKey.match(/^coupon\/([a-f0-9]{64})\.(jpg|png|webp|gif)$/);
      const mimes = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
      if (!match || attachment.id !== match[1] || typeof attachment.filename !== 'string' || attachment.filename.length > 200
        || attachment.contentType !== mimes[match[2]] || !Number.isSafeInteger(attachment.bytes) || attachment.bytes < 12 || attachment.bytes > 4 * 1024 * 1024) throw Error('美食截图引用不完整或无效，请重新上传原图。');
    }
    if (JSON.stringify(food).length > 30000) throw Error('单条美食收藏内容过长。');
  }
}
export function validateFoodTrash(trash) {
  if (trash === undefined) return;
  if (!Array.isArray(trash)) throw Error('回收站记录格式不正确。');
  for (const entry of trash) if (entry?.collection === 'foodPlaces') validateFoods([entry.item]);
}
export function foodCities(items = []) {
  const seen = new Map();
  for (const item of items) {
    const city = text(item?.city, LIMITS.city), key = normalizeCity(city);
    if (key && !seen.has(key)) seen.set(key, city.replace(/市$/, ''));
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'zh-CN'));
}
export function filterFoods(items = [], { city = '', status = '', query = '' } = {}) {
  const cityKey = normalizeCity(city), search = text(query, 300).toLocaleLowerCase('zh-CN');
  return items.filter(item => (!cityKey || normalizeCity(item.city) === cityKey)
    && (!FOOD_STATUSES.includes(status) || item.status === status)
    && (!search || [item.title, item.city, item.area, item.address, item.dishes, item.reason, item.notes, item.sourceText].some(value => String(value || '').toLocaleLowerCase('zh-CN').includes(search))))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')) || String(a.id).localeCompare(String(b.id)));
}
export function dinnerCandidates(items = [], city = '', { offset = 0, limit = 3 } = {}) {
  if (!normalizeCity(city)) return [];
  const matches = filterFoods(items, { city, status: 'want' }).filter(item => item.kind === 'place');
  if (!matches.length) return [];
  const start = Number.isSafeInteger(offset) ? ((offset % matches.length) + matches.length) % matches.length : 0;
  const count = Number.isSafeInteger(limit) ? Math.max(0, Math.min(limit, matches.length, 20)) : Math.min(3, matches.length);
  return Array.from({ length: count }, (_, index) => matches[(start + index) % matches.length]);
}
export function foodMapUrl(food) {
  if (!food || food.kind !== 'place' || !text(food.title)) return '';
  const params = new URLSearchParams({ keyword: [food.title, food.address || food.area].filter(Boolean).join(' '), view: 'list', callnative: '1' });
  if (text(food.city)) params.set('city', food.city.trim());
  return 'https://uri.amap.com/search?' + params.toString();
}
