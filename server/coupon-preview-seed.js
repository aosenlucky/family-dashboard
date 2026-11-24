import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { previewTransaction } from './preview-store.js';
import { normalizeCoupon, dayKey } from '../src/features/coupons/model.js';
import { saveCouponImage } from '../api/_coupon-media.js';

// One-time, local-only augmentation. Never replaces user edits from the previous preview.
export async function seedCouponPreview() {
  if (await previewTransaction(s => !!s.couponPreviewSeedComplete, { write: false })) return;
  const today = dayKey(), offset = days => new Date(Date.parse(today + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
  const make = (id, fields) => normalizeCoupon({ id, author: '小悦', category: 'hotel', status: 'unused', deadlineConfirmed: true,
    createdAt: offset(-10) + 'T10:00:00Z', updatedAt: new Date().toISOString(), ...fields });
  let attachments = [];
  try {
    const bytes = await readFile(resolve('.local/coupon-fixtures/hotel-poster.jpg'));
    attachments = [await saveCouponImage({ filename: '千岛湖酒店海报.jpg', contentType: 'image/jpeg', data: bytes.toString('base64') })];
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const coupons = [
    make('coupon-demo-lake', { title: '把周末留给山湖', merchant: '湖畔小屋', location: '杭州 · 千岛湖', summary: '湖景房两晚 · 双人早餐', expiresOn: offset(25), bookingDeadline: offset(12), paidPrice: '598', rules: '需提前预约；节假日是否可用请先联系商家。', reminder: { enabled: true, sevenDays: true, recipients: ['aosen', 'xiaoyue'] } }),
    make('coupon-demo-forest', { category: 'attraction', title: '去山里走一走', merchant: '山间森林公园', location: '杭州 · 临安', summary: '双人入园 · 森林步道', expiresOn: offset(45), paidPrice: '168', author: 'Aosen', rules: '入园前一天预约。', reminder: { enabled: true, sevenDays: false, recipients: ['aosen'] } }),
    make('coupon-demo-exhibit', { category: 'attraction', status: 'booked', title: '一起看一场展览', merchant: '城市艺术馆', location: '杭州', summary: '双人展览通票', expiresOn: offset(7), bookingDeadline: offset(-1), plannedOn: offset(3), rules: '已经预约下午场，记得携带原平台凭证。', reminder: { enabled: true, sevenDays: true, recipients: ['xiaoyue'] } }),
    make('coupon-demo-poster', { title: '千岛湖璞蔚逸趣度假村', merchant: '千岛湖璞蔚逸趣度假村', location: '千岛湖', summary: '2晚＋双…（海报标题未完整展示）', status: 'wish', deadlineConfirmed: false, advertisedPrice: '389', attachments, notes: '先收藏这份优惠，购买后补充订单与有效期。' }),
    make('coupon-demo-undated', { title: '还想再去看一次海', merchant: '海边小住', location: '宁波', summary: '双人住宿套餐', deadlineConfirmed: false, notes: '有效期还在订单里，待补充。' }),
    make('coupon-demo-memory', { title: '那天的夕阳刚刚好', merchant: '山顶落日观景台', category: 'attraction', location: '杭州', summary: '周末双人观景票', status: 'used', expiresOn: offset(-25), plannedOn: offset(-30), createdAt: offset(-60) + 'T10:00:00Z', notes: '一起走到山顶，等来一整片温柔的光。' })
  ];
  await previewTransaction(s => {
    if (s.couponPreviewSeedComplete) return;
    const main = s.records.main.value;
    main.coupons ||= [];
    for (const coupon of coupons) if (!main.coupons.some(item => item.id === coupon.id)) main.coupons.push(coupon);
    main._familyRevision = (main._familyRevision || 0) + 1;
    s.couponPreviewSeedComplete = true;
    return null;
  });
}
