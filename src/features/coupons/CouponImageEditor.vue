<template>
  <dialog ref="dialog" class="coupon-dialog coupon-image-editor" @cancel.prevent="$emit('close')">
    <header class="coupon-dialog-heading"><div><p class="eyebrow">先整理，再上传</p><h2>处理这张截图</h2></div><button class="coupon-icon" aria-label="关闭图片处理" @click="$emit('close')"><i class="ph ph-x"></i></button></header>
    <div class="coupon-dialog-body"><p class="coupon-help">拖动框选需要处理的区域。遮盖会从上传的图片中移除对应内容。</p><div class="coupon-inline-actions"><button :class="['coupon-secondary', { selected: mode === 'mask' }]" :aria-pressed="mode === 'mask'" @click="mode = 'mask'">遮盖敏感信息</button><button :class="['coupon-secondary', { selected: mode === 'crop' }]" :aria-pressed="mode === 'crop'" @click="mode = 'crop'">裁剪</button><button class="coupon-text" @click="reset">恢复原图</button></div><div class="coupon-canvas-wrap"><canvas ref="canvas" aria-label="图片处理画布，拖动选择区域" @pointerdown="begin" @pointermove="move" @pointerup="finish" @pointercancel="cancel" /></div><p v-if="error" class="coupon-error" role="alert">{{ error }}</p></div>
    <footer class="coupon-dialog-footer"><button class="coupon-secondary" @click="$emit('close')">取消</button><button class="coupon-primary" :disabled="busy" @click="save">{{ busy ? '处理中…' : '使用处理后的图片' }}</button></footer>
  </dialog>
</template>
<script setup>
import { nextTick, onMounted, ref } from 'vue';
const props = defineProps({ file: { type: File, required: true } });
const emit = defineEmits(['close', 'save']);
const dialog = ref(null), canvas = ref(null), mode = ref('mask'), error = ref(''), busy = ref(false);
let original, current, start = null, end = null;
async function imageFromFile(file) { const url = URL.createObjectURL(file); try { const image = new Image(); image.src = url; await image.decode(); return image; } finally { URL.revokeObjectURL(url); } }
function redraw() { if (!current || !canvas.value) return; const c = canvas.value; c.width = current.width; c.height = current.height; c.getContext('2d').drawImage(current, 0, 0); if (start && end) { const context = c.getContext('2d'); context.fillStyle = mode.value === 'mask' ? '#252322' : '#92634e55'; context.fillRect(Math.min(start.x, end.x), Math.min(start.y, end.y), Math.abs(end.x - start.x), Math.abs(end.y - start.y)); } }
function point(event) { const c = canvas.value, box = c.getBoundingClientRect(); return { x: Math.max(0, Math.min(c.width, (event.clientX - box.left) * c.width / box.width)), y: Math.max(0, Math.min(c.height, (event.clientY - box.top) * c.height / box.height)) }; }
function begin(event) { canvas.value.setPointerCapture(event.pointerId); start = point(event); end = start; }
function move(event) { if (!start) return; end = point(event); redraw(); }
function cancel() { start = null; end = null; redraw(); }
function finish(event) { if (!start) return; end = point(event); const x = Math.round(Math.min(start.x, end.x)), y = Math.round(Math.min(start.y, end.y)), width = Math.round(Math.abs(end.x - start.x)), height = Math.round(Math.abs(end.y - start.y)); if (width < 8 || height < 8) return cancel(); const next = document.createElement('canvas'); next.width = mode.value === 'crop' ? width : current.width; next.height = mode.value === 'crop' ? height : current.height; const context = next.getContext('2d'); if (mode.value === 'crop') context.drawImage(current, x, y, width, height, 0, 0, width, height); else { context.drawImage(current, 0, 0); context.fillStyle = '#252322'; context.fillRect(x, y, width, height); } current = next; start = null; end = null; redraw(); }
function reset() { current = original; start = null; end = null; redraw(); }
async function save() { busy.value = true; try { redraw(); const output = await new Promise(resolve => canvas.value.toBlob(resolve, 'image/png')); if (!output) throw Error('图片处理失败，请重试。'); emit('save', new File([output], props.file.name.replace(/\.[^.]+$/, '') + '-整理.png', { type: 'image/png' })); } catch (e) { error.value = e.message; } finally { busy.value = false; } }
onMounted(async () => { await nextTick(); dialog.value.showModal(); try { original = await imageFromFile(props.file); current = original; redraw(); } catch { error.value = '无法读取图片，请取消后重新选择。'; } });
</script>
