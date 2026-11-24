<template>
  <button class="coupon-ticket" :class="[`ticket-${coupon.category || 'other'}`, { 'ticket-compact': compact, 'ticket-list': list, 'ticket-archived': archived }]" :aria-label="`${coupon.title || coupon.merchant}，${stateLabel(state)}，${deadline ? deadline.label + dateText(deadline.date) : '日期待补充'}，查看详情`" @click="$emit('open', coupon)">
    <span class="ticket-band"><span>{{ categoryLabel(coupon.category) }} · {{ coupon.location || '地点待补' }}</span><span>{{ stateLabel(state) }}</span></span>
    <span class="ticket-body">
      <span class="ticket-main"><span class="ticket-kicker">OUR LITTLE GETAWAYS</span><strong class="ticket-title">{{ coupon.title || coupon.merchant || '还没取名字的券' }}</strong><span class="ticket-summary">{{ coupon.summary || '收好这份期待，找个好日子出发。' }}</span><span class="ticket-bottom"><span>{{ coupon.author || '我们' }}收藏<template v-if="coupon.plannedOn"> · {{ dateText(coupon.plannedOn) }}出发</template></span><span v-if="coupon.rules" class="ticket-rule">查看使用规则</span></span></span>
      <span class="ticket-stub"><span class="stub-caption">{{ deadline?.label || '有效日期' }}</span><strong v-if="deadline" class="stub-date">{{ deadline.date.slice(5).replace('-', '.') }}</strong><strong v-else class="stub-unknown">待补充</strong><span v-if="deadline" class="stub-year">{{ deadline.date.slice(0, 4) }}</span><span class="stub-count" :class="{ urgent: remaining !== null && remaining >= 0 && remaining <= 7 }">{{ remaining === null ? '先收好，慢慢安排' : remaining < 0 ? '已超过截止日' : remaining === 0 ? '今天截止' : `还有 ${remaining} 天` }}</span><i class="ph ph-arrow-up-right" aria-hidden="true"></i></span>
    </span>
  </button>
</template>
<script setup>
import { computed } from 'vue';
import { activeDeadline, couponState, dayKey } from './model.js';
import { categoryLabel, stateLabel, dateText, daysBetween } from './client.js';
import './coupons.css';
const props = defineProps({ coupon: { type: Object, required: true }, compact: Boolean, list: Boolean, today: String });
defineEmits(['open']);
const deadline = computed(() => activeDeadline(props.coupon));
const state = computed(() => couponState(props.coupon, props.today || dayKey()));
const archived = computed(() => ['used', 'refunded', 'expired'].includes(state.value));
const remaining = computed(() => daysBetween(props.today || dayKey(), deadline.value?.date));
</script>
