export const photoKey = (photo) => String(photo.id || photo.url || '');
export const photoPlace = photo => [photo.tempCity,photo.city,photo.location].find(v=>typeof v==='string' && v.trim()) || '';
export function safePhotoUrl(value, origin = globalThis.location?.origin || 'http://localhost') {
  if(typeof value!=='string')return '';
  if(/^data:image\/(png|jpe?g|gif|webp|heic|heif);base64,/i.test(value))return value;
  try{const url=new URL(value,origin);return ['https:','http:'].includes(url.protocol)?url.href:'';}catch{return '';}
}
export const photoDate = (photo) => {
  const value = String(photo.date || photo.takenAt || '');
  const day = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return '';
  const parsed = new Date(day + 'T00:00:00.000Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === day ? day : '';
};
export function groupPhotos(photos, {type = '', place = '', month = ''} = {}) {
  const selected = (photos || []).filter(p => p.url && (!type || (p.type || '日常记录') === type) && (!place || (photoPlace(p) || '未记录地点') === place) && (!month || (photoDate(p).slice(0,7) || 'unknown') === month));
  const groups = new Map();
  for (const photo of [...selected].sort((a,b) => photoDate(b).localeCompare(photoDate(a)))) {
    const key = photoDate(photo).slice(0,7) || 'unknown';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(photo);
  }
  return [...groups].map(([key, photos]) => ({key, title:key === 'unknown' ? '日期未记录' : key.replace('-', ' 年 ') + ' 月', photos}));
}
export function nextPhotoIndex(index, direction, length) { return length ? (index + direction + length) % length : -1; }
export async function drainQueue(items, execute, concurrency = 2) {
  let cursor = 0;
  const run = async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      try { await execute(item); } catch (error) { item.status = 'failed'; item.error = error instanceof Error ? error.message : String(error); }
    }
  };
  await Promise.all(Array.from({length:Math.min(concurrency,items.length)},run));
}
