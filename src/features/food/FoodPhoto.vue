<template>
  <div ref="host" class="food-photo" :class="{ 'food-photo-ready': url }">
    <img v-if="url" :src="url" :alt="alt" loading="lazy" />
    <span v-else class="food-photo-placeholder"><i class="ph ph-image" aria-hidden="true"></i>{{ failed ? '截图暂时无法读取' : '收藏的截图' }}</span>
  </div>
</template>

<script setup>
import { onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue';
import { readCouponImage } from '../coupons/client.js';
const props = defineProps({ attachment: { type: Object, required: true }, alt: { type: String, default: '美食收藏原始截图' } });
const host = ref(null), url = ref(''), failed = ref(false);
let observer, controller, generation = 0, visible = false, active = true;
function clear() { generation++; controller?.abort(); if (url.value) URL.revokeObjectURL(url.value); url.value = ''; }
async function load() {
  if (!active || !visible || url.value || controller || !props.attachment?.objectKey) return;
  const request = ++generation, abort = new AbortController(); controller = abort; failed.value = false;
  try { const result = await readCouponImage(props.attachment.objectKey, { signal: abort.signal }); if (request !== generation || !active) URL.revokeObjectURL(result); else url.value = result; }
  catch (error) { if (!abort.signal.aborted && request === generation) failed.value = true; }
  finally { if (controller === abort) controller = null; }
}
watch(() => props.attachment?.objectKey, () => { clear(); controller = null; load(); });
onMounted(() => {
  if (typeof IntersectionObserver === 'undefined') { visible = true; load(); return; }
  observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { visible = true; observer.disconnect(); load(); } }, { rootMargin: '160px' });
  observer.observe(host.value);
});
onActivated(() => { active = true; load(); });
onDeactivated(() => { active = false; clear(); controller = null; });
onBeforeUnmount(() => { active = false; observer?.disconnect(); clear(); });
</script>
