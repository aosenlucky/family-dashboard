import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCoupon, activeDeadline, couponState, couponCalendarEvents, monthBefore, daysUntil, isCouponDate, validateCoupons } from '../src/features/coupons/model.js';
import { mergeChanges, blankFamily } from '../src/features/family/model.js';
const coupon = fields => normalizeCoupon({ id:'one', title:'小住两晚', status:'unused', ...fields });
test('calendar month thresholds handle leap years, month ends and invalid input', () => {
  assert.equal(monthBefore('2028-03-31'),'2028-02-29');
  assert.equal(monthBefore('2027-03-31'),'2027-02-28');
  assert.equal(monthBefore('2027-01-30'),'2026-12-30');
  assert.equal(monthBefore('2027-02-29'),'');
  assert.equal(isCouponDate('2026-13-01'),false);
  assert.equal(daysUntil('2026-12-01','2026-11-24'),7);
});
test('booking and use deadlines remain independent and dates are not invented', () => {
  const value = coupon({expiresOn:'2026-12-30',bookingDeadline:'2026-12-01'});
  assert.equal(activeDeadline(value).type,'booking');
  assert.equal(activeDeadline({...value,status:'booked'}).date,'2026-12-30');
  assert.equal(couponState(value,'2026-12-05'),'unused');
  assert.equal(couponState(value,'2026-12-31'),'expired');
  assert.equal(couponState({...value,status:'used'},'2026-12-31'),'used');
  assert.equal(activeDeadline(coupon()),null);
  assert.equal(coupon().deadlineConfirmed,false);
});
test('calendar entries are derived, disappear after use, and include only confirmed deadlines', () => {
  const value=coupon({expiresOn:'2026-12-30',plannedOn:'2026-12-04'});
  assert.equal(couponCalendarEvents([value]).length,1);
  assert.equal(couponCalendarEvents([{...value,deadlineConfirmed:true}]).length,2);
  assert.equal(couponCalendarEvents([{...value,status:'used'}]).length,0);
  assert.equal(couponCalendarEvents([{...value,status:'wish'}]).length,0);
});
test('server rejects duplicate IDs, impossible dates and plans beyond expiry', () => {
  assert.throws(()=>validateCoupons([coupon(),coupon()]),/唯一编号/);
  assert.throws(()=>validateCoupons([{...coupon(),expiresOn:'2026-02-30'}]),/日期/);
  assert.throws(()=>validateCoupons([coupon({plannedOn:'2026-12-10',expiresOn:'2026-12-09'})]),/计划使用/);
  validateCoupons([coupon()]);
});
test('per-coupon reminder choices survive normalization and legacy data still validates', () => {
  assert.deepEqual(coupon().reminder, { enabled:true, thirtyDays:true, sevenDays:false, recipients:['aosen','xiaoyue'] });
  const sevenOnly = coupon({reminder:{enabled:true,thirtyDays:false,sevenDays:true,recipients:['aosen']}});
  assert.equal(sevenOnly.reminder.thirtyDays,false); assert.equal(sevenOnly.reminder.sevenDays,true);
  validateCoupons([sevenOnly]);
  const disabled = coupon({reminder:{enabled:false,thirtyDays:false,sevenDays:false,recipients:[]}});
  assert.equal(disabled.reminder.enabled,false); validateCoupons([disabled]);
  const legacy = coupon(); delete legacy.reminder.thirtyDays; validateCoupons([legacy]);
  assert.equal(normalizeCoupon(legacy).reminder.thirtyDays,true);
  assert.throws(()=>validateCoupons([{...sevenOnly,reminder:{...sevenOnly.reminder,thirtyDays:'yes'}}]),/提醒设置/);
  assert.throws(()=>validateCoupons([{...sevenOnly,reminder:{...sevenOnly.reminder,sevenDays:false}}]),/30 天或 7 天/);
});
test('coupons participate in existing independent record merging and overlapping edits conflict', () => {
  const base=blankFamily(),local=structuredClone(base),remote=structuredClone(base);
  local.coupons=[coupon()];remote.coupons=[coupon({id:'two'})];
  assert.equal(mergeChanges(base,local,remote).record.coupons.length,2);
  base.coupons=[coupon()];local.coupons=[coupon({title:'本机'})];remote.coupons=[coupon({title:'另一台'})];
  assert.deepEqual(mergeChanges(base,local,remote).conflicts,['coupons']);
});
