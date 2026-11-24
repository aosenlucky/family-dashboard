export function fetchCouponBackupMedia(key, { fetcher = fetch, authorization = sessionStorage.getItem('family_auth_token') || '' } = {}) {
  if (!/^coupon\/[a-f0-9]{64}\.(jpg|png|webp|gif)$/.test(key)) throw Error('无效券附件路径。');
  return fetcher('/api/coupon-media?key=' + encodeURIComponent(key), { headers: { Authorization: authorization }, credentials: 'omit', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(60000) });
}
export async function uploadCouponBackupMedia(bytes, mime, api) {
  if (bytes.length > 4 * 1024 * 1024) throw Error('券截图超过 4 MB，请先检查备份文件。');
  let binary = '';
  for (let start = 0; start < bytes.length; start += 16384) binary += String.fromCharCode(...bytes.subarray(start, start + 16384));
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[mime];
  if (!extension) throw Error('券截图格式不受支持。');
  const result = await api('/api/coupon-media', { method: 'POST', body: JSON.stringify({ filename: '券截图.' + extension, contentType: mime, data: btoa(binary) }) });
  if (!result.attachment?.objectKey) throw Error('没有确认券截图已保存，请重试。');
  return result.attachment;
}
