<template>
  <article class="food-card" :class="[`food-card-${food.kind}`, { 'food-card-eaten': food.status === 'eaten' }]">
    <button class="food-card-open" :aria-label="`查看${food.title}`" @click="$emit('open', food)">
      <FoodPhoto v-if="food.attachments?.length" :attachment="food.attachments[0]" :alt="`${food.title}的收藏截图`" />
      <div class="food-card-top"><span class="food-location"><i class="ph ph-map-pin" aria-hidden="true"></i>{{ [food.city, food.area].filter(Boolean).join(' · ') || '地点待补' }}</span><span class="food-kind">{{ kindLabel }}</span></div>
      <div class="food-card-title"><h2>{{ food.title }}</h2><i class="ph" :class="food.kind === 'guide' ? 'ph-map-trifold' : food.kind === 'dish' ? 'ph-bowl-food' : 'ph-fork-knife'" aria-hidden="true"></i></div>
      <p v-if="food.dishes" class="food-card-dishes">{{ food.dishes }}</p>
      <p v-if="food.reason" class="food-card-reason">“{{ food.reason }}”</p>
      <p v-else-if="food.kind === 'guide'" class="food-card-reason">先收好这一篇，到了再慢慢挑。</p>
      <p v-else-if="!food.dishes" class="food-card-reason">给下一顿饭，留一个小期待。</p>
      <p v-if="food.status === 'eaten'" class="food-card-visited"><i class="ph ph-check-circle" aria-hidden="true"></i>{{ food.visitedOn ? food.visitedOn.replaceAll('-', '.') + ' · ' : '' }}{{ food.verdict === 'again' ? '还想再来' : food.verdict === 'once' ? '尝过就好' : '已经尝过' }}</p>
      <div class="food-card-byline"><span>{{ food.author }} 收下</span><span>{{ sourceLabel }}</span></div>
    </button>
    <div class="food-card-actions"><a v-if="food.kind === 'place'" :href="mapUrl" target="_blank" rel="noopener noreferrer"><i class="ph ph-map-pin-line" aria-hidden="true"></i> 地图找店</a><button v-else @click="$emit('open', food)"><i class="ph ph-book-open-text" aria-hidden="true"></i> 看看收藏</button><button v-if="food.status === 'want' && food.kind !== 'guide'" :disabled="readOnly" @click="$emit('visit', food)"><i class="ph ph-check" aria-hidden="true"></i> 吃过了</button><button v-else @click="$emit('open', food)">查看详情 <i class="ph ph-arrow-up-right" aria-hidden="true"></i></button></div>
  </article>
</template>

<script setup>
import { computed } from 'vue';
import FoodPhoto from './FoodPhoto.vue';
import { foodMapUrl } from './model.js';
const props = defineProps({ food: { type: Object, required: true }, readOnly: Boolean });
defineEmits(['open', 'visit']);
const kindLabel = computed(() => ({ place: '想去的店', guide: '一篇攻略', dish: '想吃的味道' })[props.food.kind] || '美食收藏');
const mapUrl = computed(() => foodMapUrl(props.food));
const sourceLabel = computed(() => { try { const host = new URL(props.food.sourceUrl).hostname; return /xiaohongshu|xhslink/.test(host) ? '小红书收藏' : /dianping/.test(host) ? '大众点评收藏' : '链接收藏'; } catch { return props.food.attachments?.length ? '截图收藏' : '随手记下'; } });
</script>
