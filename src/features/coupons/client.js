const authHeaders = () => ({ Authorization: sessionStorage.getItem('family_auth_token') || '' });

export async function couponRequest(path, body, { signal } = {}) {
  const response = await fetch(path, { method: body ? 'POST' : 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error', headers: { ...authHeaders(), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal });
  const result = await response.json().catch(() => { throw new Error('服务没有返回有效结果，请稍后重试。'); });
  if (!response.ok || result.success === false) throw new Error(result.error || result.message || '暂时无法完成，请稍后重试。');
  return result;
}

export async function uploadCouponFile(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('请选择 JPG、PNG 或 WebP 截图。');
  if (file.size > 4 * 1024 * 1024) throw new Error('单张截图请控制在 4 MB 以内。');
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('无法读取这张图片，请重新选择。'));
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(file);
  });
  const result = await couponRequest('/api/coupon-media', { filename: file.name, contentType: file.type, data });
  if (!result.attachment?.objectKey) throw new Error('截图上传结果不完整，请重试。');
  return result.attachment;
}

export async function readCouponImage(objectKey, { signal } = {}) {
  const response = await fetch('/api/coupon-media?key=' + encodeURIComponent(objectKey), { headers: authHeaders(), credentials: 'omit', cache: 'no-store', redirect: 'error', signal });
  if (!response.ok) throw new Error('原图暂时无法打开，请检查登录状态后重试。');
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('原图格式不正确，未打开文件。');
  return URL.createObjectURL(blob);
}

export const categoryLabel = category => ({ hotel: '酒店', attraction: '景点', other: '好去处' }[category] || '好去处');
export const stateLabel = state => ({ wish: '想去', unused: '待使用', booked: '已安排', used: '已使用', refunded: '已退款', expired: '已过期' }[state] || '待使用');
export const dateText = date => date ? date.replaceAll('-', '.') : '日期待补';
export function daysBetween(today, date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^\d{4}-\d{2}-\d{2}$/.test(today || '')) return null;
  return Math.round((Date.parse(date + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000);
}
