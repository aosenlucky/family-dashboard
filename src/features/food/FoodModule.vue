<template>
  <section class="panel module-panel food-module" aria-labelledby="food-module-heading">
    <div class="section-heading">
      <div><h2 id="food-module-heading"><i class="ph ph-fork-knife" aria-hidden="true"></i> 寻味清单</h2><p class="muted">收藏过的心动，下一顿就去尝尝。</p></div>
      <RouterLink class="icon-button add-button" to="/life/food?add=1" aria-label="收藏一个好吃的"><i class="ph ph-plus" aria-hidden="true"></i></RouterLink>
    </div>
    <div class="food-dinner-heading"><h3>今晚吃什么</h3><label><span class="food-label">在哪座城</span><select v-model="city" aria-label="今晚在哪座城市吃饭"><option value="">选择城市</option><option v-for="name in cities" :key="name.key" :value="name.key">{{ name.label }}</option></select></label></div>
    <div v-if="featured.length" class="food-dinner-list">
      <RouterLink v-for="(food, index) in featured" :key="food.id" :to="{ path: '/life/food', query: { food: food.id, city } }" class="food-dinner-item">
        <span class="food-dinner-number" aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</span>
        <span class="food-dinner-copy"><strong>{{ food.title }}</strong><span>{{ food.dishes || food.reason || food.area || '打开看看当时收藏的理由' }}</span></span>
        <i class="ph ph-arrow-up-right" aria-hidden="true"></i>
      </RouterLink>
    </div>
    <div v-else class="food-dinner-empty"><i class="ph ph-bowl-food" aria-hidden="true"></i><p>{{ !items.length ? '先收下一家想一起去的小店。' : !city ? '选一座城，翻翻还没去过的小店。' : '这里还没有待尝的店铺。' }}</p><span v-if="city && items.length">攻略和菜品愿望也在清单里，整理成店铺后就能在这里遇见。</span></div>
    <div v-if="total > 3" class="food-dinner-refresh"><span>{{ city }} · {{ total }} 家还想去</span><button class="text-button" type="button" @click="offset += 3"><i class="ph ph-arrows-clockwise" aria-hidden="true"></i> 换一组</button></div>
    <RouterLink :to="{ path: '/life/food', query: city ? { city } : {} }" class="food-module-link">查看寻味清单 <span>{{ items.length ? `${items.length} 份收藏` : '从一顿饭开始' }} <i class="ph ph-arrow-right" aria-hidden="true"></i></span></RouterLink>
  </section>
</template>

<script setup>
import { computed, onActivated, ref, watch } from 'vue'
import { dinnerCandidates, foodCities, normalizeCity } from './model.js'
const props = defineProps({ items: { type: Array, default: () => [] } })
const readCity = () => { try { return normalizeCity(localStorage.getItem('family-food-city') || '') } catch { return '' } }
const city = ref(readCity()), offset = ref(0)
const cities = computed(() => {
  const names = new Map(foodCities(props.items).map(name => [normalizeCity(name), name]))
  if (city.value && !names.has(city.value)) names.set(city.value, city.value)
  return [...names].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'))
})
const featured = computed(() => dinnerCandidates(props.items, city.value, { offset: offset.value, limit: 3 }))
const total = computed(() => props.items.filter(item => item.kind === 'place' && item.status === 'want' && city.value && normalizeCity(item.city) === city.value).length)
watch(city, value => { offset.value = 0; try { localStorage.setItem('family-food-city', value) } catch {} })
onActivated(() => { city.value = readCity() })
</script>

<style scoped>
.food-module { color:var(--family-ink,#403932); }
.food-dinner-heading { display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 12px; }
.food-dinner-heading h3 { font-size:14px;font-weight:600;margin:0; }
.food-dinner-heading label { display:flex;align-items:center;gap:8px;min-width:0; }
.food-label { color:var(--family-muted,#877c70);font-size:12px; }
.food-dinner-heading select { min-width:0;max-width:150px;min-height:44px;padding:8px 10px;border:1px solid var(--family-border,#e5ddd2);border-radius:11px;background:var(--family-surface,#fffdf9);color:var(--family-ink,#403932);font-size:16px; }
.food-dinner-list { display:grid;gap:8px; }
.food-dinner-item { min-width:0;display:flex;gap:12px;align-items:center;padding:14px 12px;border-radius:13px;background:var(--family-soft,#f6f2eb);text-decoration:none;color:inherit;transition:background .15s; }
.food-dinner-item:hover { background:#eee6dc; }
.food-dinner-item:focus-visible,.food-module-link:focus-visible { outline:2px solid var(--family-accent,#9b7357);outline-offset:3px; }
.food-dinner-number { flex-shrink:0;align-self:flex-start;font:italic 23px/1.25 Georgia,serif;color:var(--family-accent,#9b7357); }
.food-dinner-copy { min-width:0;flex:1;display:grid;gap:5px; }
.food-dinner-copy strong { font-size:14px;font-weight:500;overflow-wrap:anywhere; }
.food-dinner-copy>span { font-size:12px;color:var(--family-muted,#877c70);white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.food-dinner-item>i { flex-shrink:0;color:var(--family-accent,#9b7357); }
.food-dinner-empty { padding:22px 10px;text-align:center;color:var(--family-muted,#877c70); }
.food-dinner-empty>i { font-size:30px;color:var(--family-accent,#9b7357); }
.food-dinner-empty p { font-size:13px;line-height:1.7;margin:10px 0 4px; }
.food-dinner-empty>span { display:block;font-size:12px;line-height:1.7; }
.food-dinner-refresh { display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:4px; }
.food-dinner-refresh>span { font-size:12px;color:var(--family-muted,#877c70); }
.food-module-link { display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:14px;padding-top:14px;border-top:1px solid var(--family-border,#e5ddd2);min-height:44px;font-size:13px;color:var(--family-ink,#403932);text-decoration:none; }
.food-module-link span { display:inline-flex;align-items:center;gap:8px;font-size:12px;color:var(--family-muted,#877c70); }
@media(max-width:400px) { .food-label { display:none; }.food-dinner-heading select { max-width:135px; }.food-module-link { flex-wrap:wrap; } }
@media(prefers-reduced-motion:reduce) { .food-dinner-item { transition:none; } }
</style>
