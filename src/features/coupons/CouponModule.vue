<template>
  <section class="panel module-panel coupon-module" aria-labelledby="coupon-module-heading">
    <div class="section-heading"><div><h2 id="coupon-module-heading"><i class="ph ph-ticket" aria-hidden="true"></i> 我们的券册</h2><p class="muted">把期待收好，把日子安排好。</p></div><RouterLink class="icon-button add-button" to="/life/coupons?new=1" aria-label="收一张券"><i class="ph ph-plus" aria-hidden="true"></i></RouterLink></div>
    <div v-if="featured.length" class="coupon-module-stack"><CouponCard v-for="coupon in featured" :key="coupon.id" :coupon="coupon" :today="today" compact @open="open" /></div>
    <div v-else class="coupon-module-empty"><i class="ph ph-ticket" aria-hidden="true"></i><p>下一次小旅行，从收一张券开始。</p><RouterLink to="/life/coupons?new=1" class="secondary-button">收一张券</RouterLink></div>
    <RouterLink to="/life/coupons" class="coupon-module-link">打开我们的券册 <span>{{ activeCount ? `${activeCount} 张待使用` : '看看收藏' }} <i class="ph ph-arrow-right" aria-hidden="true"></i></span></RouterLink>
  </section>
</template>
<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import CouponCard from './CouponCard.vue';
import { couponState, couponSort } from './model.js';
const props = defineProps({ items: { type: Array, default: () => [] }, today: String });
const router = useRouter();
const pending = computed(() => props.items.filter(c => ['unused', 'booked'].includes(couponState(c, props.today))).sort(couponSort));
const featured = computed(() => (pending.value.length ? pending.value : props.items.filter(c => c.status === 'wish')).slice(0, 3));
const activeCount = computed(() => pending.value.length);
const open = coupon => router.push({ path: '/life/coupons', query: { coupon: coupon.id } });
</script>
