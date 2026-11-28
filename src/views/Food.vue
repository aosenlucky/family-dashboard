<template>
  <main class="food-page">
    <RouterLink to="/life" class="food-back"><i class="ph ph-arrow-left" aria-hidden="true"></i> 回到生活</RouterLink>
    <header class="food-heading">
      <div><p class="eyebrow">A TASTE OF THE DAYS AHEAD</p><h1>寻味清单<span>把心动的味道，留给下一次相聚。</span></h1></div>
      <button class="food-primary" :disabled="readOnly" @click="newFood"><i class="ph ph-plus" aria-hidden="true"></i> 收一个好味道</button>
    </header>
    <div v-if="editor && !editorVisible" class="food-banner" role="status"><span>还有一份正在整理的收藏。</span><button class="food-secondary" @click="resumeEditor">继续整理</button></div>
    <div v-if="pendingVisitFood && !selected" class="food-banner" role="status"><span>还有一条探店感受未保存。</span><button class="food-secondary" @click="openVisit(pendingVisitFood)">继续记下</button></div>
    <div v-if="notice" class="food-banner" role="status"><span>{{ notice }}</span><button v-if="undo" class="food-text" :disabled="!!busy" @click="undoAction">撤销</button><button class="food-icon" aria-label="收起提示" @click="notice = ''"><i class="ph ph-x" aria-hidden="true"></i></button></div>
    <p v-if="error" class="food-error" role="alert">{{ error }}</p>
    <section class="food-collection-intro" aria-label="收藏概览"><div><span class="food-intro-mark"><i class="ph ph-fork-knife" aria-hidden="true"></i></span><p><strong>{{ foods.filter(food => food.status === 'want').length }}</strong> 份想吃的期待<span>{{ foods.filter(food => food.status === 'eaten').length }} 次尝过的好时光</span></p></div><p>平时找一顿好饭，出门寻一座城的滋味。</p></section>
    <div class="food-toolbar">
      <label class="food-city"><i class="ph ph-map-pin" aria-hidden="true"></i><span class="sr-only">查看哪个城市</span><select v-model="city" @change="rememberCity"><option value="">所有城市</option><option v-for="name in cities" :key="name.key" :value="name.key">{{ name.label }}</option><option value="__unknown">地点待补</option></select></label>
      <div class="food-tabs" aria-label="收藏状态"><button v-for="tab in tabs" :key="tab.id" :class="{ active: status === tab.id }" :aria-pressed="status === tab.id" @click="status = tab.id">{{ tab.label }}</button></div>
      <label class="food-search"><i class="ph ph-magnifying-glass" aria-hidden="true"></i><input v-model="query" aria-label="搜索店名、菜品或收藏内容" placeholder="找店名、菜品或一句话" /></label>
    </div>
    <div class="food-results-heading"><p>{{ city && city !== '__unknown' ? cityLabel + ' · ' : '' }}{{ status === 'eaten' ? '吃过的味道' : status === 'want' ? '下一顿的小期待' : '我们收下的味道' }} <span>{{ filtered.length }}</span></p><button v-if="query || city || status !== 'want'" class="food-text" @click="resetFilters">清除筛选</button></div>
    <div v-if="filtered.length" class="food-card-grid"><FoodCard v-for="food in filtered" :key="food.id" :food="food" :read-only="readOnly" @open="openDetails" @visit="openVisit" /></div>
    <section v-else class="food-empty"><i class="ph ph-bowl-food" aria-hidden="true"></i><h2>{{ query || city ? '这里还没有找到想吃的' : status === 'eaten' ? '尝过的好味道，慢慢留下来' : '下一顿好吃的，从这里收起' }}</h2><p>{{ query || city ? '换个城市或关键词，也可以先收下一个新发现。' : '粘贴一段分享文字，放进一张截图，或者记下朋友推荐的小店。' }}</p><button class="food-secondary" :disabled="readOnly" @click="newFood">收一个好味道</button></section>
    <p class="food-page-footnote"><i class="ph ph-users-two" aria-hidden="true"></i> 一起收藏、一起寻味。攻略会完整保留，选定一家店后再加入日常吃饭的候选。</p>

    <dialog v-if="editor && editorVisible" ref="editorDialog" class="food-dialog food-editor" @cancel.prevent="closeEditor">
      <form @submit.prevent="saveEditor">
        <header class="food-dialog-heading"><div><p class="eyebrow">SAVE A LITTLE APPETITE</p><h2>{{ editor.isNew ? '收一个好味道' : '整理这份收藏' }}</h2></div><button type="button" class="food-icon" aria-label="关闭收藏编辑" :disabled="!!busy" @click="closeEditor"><i class="ph ph-x" aria-hidden="true"></i></button></header>
        <fieldset class="food-dialog-body" :disabled="!!busy">
          <div class="food-import">
            <label class="food-field">从分享文字或链接开始<textarea v-model="editor.draft.sourceText" rows="3" maxlength="12000" placeholder="粘贴小红书、点评或其他地方的分享内容，也可以直接在下方填写。" @blur="fillSourceUrl" /></label>
            <div v-if="files.length || editor.draft.attachments.length" class="food-files">
              <div v-for="file in files" :key="file.id" class="food-file"><img :src="file.url" alt="准备保存的美食截图" /><label><input v-model="recognitionSelection" type="checkbox" :value="file.id" /> 用于识别</label><button type="button" class="food-text" :disabled="!!file.attachment" @click="processingFile = file">裁剪 / 遮盖</button><button type="button" class="food-file-remove food-icon" aria-label="移除这张截图" @click="removeFile(file.id)"><i class="ph ph-x" aria-hidden="true"></i></button><span v-if="file.error" class="food-error">上传失败，可重试</span></div>
              <div v-for="attachment in editor.draft.attachments" :key="attachment.objectKey" class="food-file"><button type="button" class="food-file-preview" aria-label="查看已保存的截图" @click="viewAttachment(attachment)"><FoodPhoto :attachment="attachment" /></button><label><input v-model="recognitionSelection" type="checkbox" :value="attachment.objectKey" /> 用于识别</label><button type="button" class="food-file-remove food-icon" aria-label="移除已保存截图" @click="removeAttachment(attachment.objectKey)"><i class="ph ph-x" aria-hidden="true"></i></button></div>
            </div>
            <div class="food-import-actions"><label class="food-secondary food-file-select"><i class="ph ph-image" aria-hidden="true"></i> 加截图<input type="file" accept="image/jpeg,image/png,image/webp" multiple @change="selectFiles" /></label><button type="button" class="food-secondary" :disabled="!editor.draft.sourceText.trim() && !recognitionSelection.length" @click="recognize"><i class="ph ph-sparkle" aria-hidden="true"></i> {{ busy === 'recognize' ? '正在整理…' : '整理文字和截图' }}</button></div>
            <p class="food-help">{{ isPreview ? '本机预览不会发送资料，可体验文字整理；截图先保存，正式站再启用识别。' : '点击整理会将分享文字及勾选截图发送给 DeepSeek，结果由你核对。仅保存不会识别。' }}链接会原样收好，不自动读取原帖。</p>
            <p v-if="progress" class="food-progress" role="status">{{ progress }}</p>
            <div v-if="recognitionMessage" class="food-recognition" role="status"><strong>{{ recognitionMessage }}</strong><ul v-if="warnings.length"><li v-for="(warning, index) in warnings" :key="index">{{ warning }}</li></ul></div>
          </div>
          <div v-if="duplicates.length" class="food-duplicate" role="status"><i class="ph ph-bookmark-simple" aria-hidden="true"></i><span>这条链接已经收在「{{ duplicates[0].title }}」里。如果这次记的是另一家店，也可以继续保存。</span></div>
          <div class="food-form-grid">
            <label class="food-field full">名称<input v-model="editor.draft.title" maxlength="160" placeholder="店名、一篇美食攻略，或想尝的味道" /><small v-if="evidence.title">原文：{{ evidence.title }}</small></label>
            <label class="food-field">在哪座城<input v-model="editor.draft.city" maxlength="80" @input="cityTouched = true" placeholder="还不确定可以留空" list="food-city-options" /><datalist id="food-city-options"><option v-for="name in foodCities(foods)" :key="name" :value="name" /></datalist><small v-if="evidence.city">原文：{{ evidence.city }}</small></label>
            <label class="food-field">收下的是什么<select v-model="editor.draft.kind" @change="kindTouched = true"><option value="place">一家店</option><option value="guide">一篇攻略 / 多家店</option><option value="dish">一种想吃的味道</option></select></label>
            <label class="food-field full">想吃什么<textarea v-model="editor.draft.dishes" rows="2" maxlength="800" placeholder="比如：蟹黄面、桂花米糕，或者那份刚出炉的烧饼" /><small v-if="evidence.dishes">原文：{{ evidence.dishes }}</small></label>
            <label class="food-field full">为什么想去<input v-model="editor.draft.reason" maxlength="1200" placeholder="比如：适合下班后一起吃，窗边能看见湖" /></label>
            <label class="food-field">谁收下的<select v-model="editor.draft.author"><option>Aosen</option><option>小悦</option></select></label>
          </div>
          <p v-if="editor.draft.kind !== 'place'" class="food-help food-kind-help">{{ editor.draft.kind === 'guide' ? '攻略先完整收好。之后可以从详情里单独记下一家店，方便“今晚吃什么”帮你挑选。' : '先记下想吃的味道，找到合适的店后可改为“一家店”。' }}</p>
          <details class="food-more"><summary>地址、原链接与补充信息</summary><div class="food-form-grid"><label class="food-field">区域 / 商圈<input v-model="editor.draft.area" maxlength="120" placeholder="比如：西湖边" /></label><label class="food-field full">详细地址<input v-model="editor.draft.address" maxlength="300" placeholder="知道分店地址时再补充" /><small v-if="evidence.address">原文：{{ evidence.address }}</small></label><label class="food-field full">原链接<input v-model="editor.draft.sourceUrl" type="url" maxlength="3000" placeholder="https://…" /></label><label class="food-field full">补充记下<textarea v-model="editor.draft.notes" rows="3" maxlength="5000" placeholder="排队、预约，或者自己的探店感受" /></label></div></details>
          <p v-if="editorError" class="food-error" role="alert">{{ editorError }} <button type="button" class="food-text" @click="pauseEditor">保留输入并收起</button></p>
          <div v-if="discardRequested" class="food-discard" role="alert"><p>这份收藏还有未保存的修改。</p><div class="food-actions"><button type="button" class="food-secondary" @click="discardRequested = false">继续整理</button><button type="button" class="food-secondary" @click="pauseEditor">保留输入</button><button type="button" class="food-danger" @click="finishEditor">放弃修改</button></div></div>
        </fieldset>
        <footer class="food-dialog-footer"><span class="food-help">先收好，以后慢慢补充。</span><button type="button" class="food-secondary" :disabled="!!busy" @click="closeEditor">取消</button><button class="food-primary" :disabled="!!busy">{{ busy === 'save' ? '保存中…' : '收进清单' }}</button></footer>
      </form>
    </dialog>

    <dialog v-if="selected" ref="detailDialog" class="food-dialog food-detail" @cancel.prevent="!busy && closeDetails()">
      <header class="food-dialog-heading"><div><p class="eyebrow">{{ selected.status === 'eaten' ? 'A TASTE TO REMEMBER' : 'SOMETHING TO LOOK FORWARD TO' }}</p><h2>{{ selected.title }}</h2></div><button class="food-icon" aria-label="关闭收藏详情" :disabled="!!busy" @click="closeDetails"><i class="ph ph-x" aria-hidden="true"></i></button></header>
      <div class="food-dialog-body">
        <div class="food-detail-meta"><span><i class="ph ph-map-pin" aria-hidden="true"></i>{{ [selected.city, selected.area].filter(Boolean).join(' · ') || '地点待补' }}</span><span>{{ kindLabels[selected.kind] }}</span><span>{{ selected.author }} 收下</span></div>
        <blockquote v-if="selected.reason" class="food-reason-quote">{{ selected.reason }}</blockquote>
        <section v-if="selected.dishes" class="food-detail-copy"><h3>想尝的味道</h3><p>{{ selected.dishes }}</p></section>
        <section v-if="selected.address" class="food-detail-copy"><h3>店在哪里</h3><p>{{ selected.address }}</p></section>
        <div class="food-actions"><a v-if="selected.kind === 'place'" class="food-secondary" :href="foodMapUrl(selected)" target="_blank" rel="noopener noreferrer"><i class="ph ph-map-pin-line" aria-hidden="true"></i> 地图找店</a><a v-if="selected.sourceUrl" class="food-secondary" :href="selected.sourceUrl" target="_blank" rel="noopener noreferrer"><i class="ph ph-arrow-up-right" aria-hidden="true"></i> 看原帖</a><button v-if="selected.kind === 'guide'" class="food-secondary" :disabled="!!busy || readOnly" @click="extractPlace"><i class="ph ph-plus" aria-hidden="true"></i> 从攻略记下一家店</button></div>
        <p v-if="selected.kind === 'place' && !selected.address" class="food-help">地图会按店名和城市搜索，出发前记得核对分店。</p>
        <section v-if="selected.status === 'eaten' && !visiting" class="food-visit-memory"><i class="ph ph-check-circle" aria-hidden="true"></i><div><strong>{{ selected.verdict === 'again' ? '还想再来' : selected.verdict === 'once' ? '尝过就好' : '已经尝过' }}</strong><p>{{ selected.visitedOn ? selected.visitedOn.replaceAll('-', '.') : '这次的味道已收好' }}</p></div><button class="food-text" :disabled="readOnly || !!busy" @click="startVisit">补一句感受</button></section>
        <form v-if="visiting" class="food-visit-form" @submit.prevent="saveVisit"><fieldset :disabled="!!busy"><h3>把这次的味道记下来</h3><div class="food-form-grid"><label class="food-field">哪天吃的<input v-model="visitDraft.visitedOn" type="date" required /></label><label class="food-field">感觉怎么样<select v-model="visitDraft.verdict"><option value="">先记一笔</option><option value="again">还想再来</option><option value="once">尝过就好</option></select></label><label class="food-field full">想记下的话<textarea v-model="visitDraft.notes" rows="2" maxlength="5000" placeholder="不写也可以直接记下这次" /></label></div><div class="food-actions"><button class="food-primary" :disabled="!!busy">{{ busy === 'visit' ? '保存中…' : '记下这次' }}</button><button type="button" class="food-text" :disabled="!!busy" @click="pauseVisit">取消</button></div></fieldset></form>
        <section v-if="selected.notes && !visiting" class="food-detail-copy"><h3>随手记下</h3><p>{{ selected.notes }}</p></section>
        <details v-if="selected.sourceText" class="food-more"><summary>收下时的原文</summary><p class="food-original-text">{{ selected.sourceText }}</p></details>
        <section v-if="selected.attachments.length" class="food-detail-copy"><h3>收下的截图 <span class="food-help">登录后可查看</span></h3><div class="food-detail-images"><button v-for="(attachment, index) in selected.attachments" :key="attachment.objectKey" :aria-label="`放大原始截图 ${index + 1}`" @click="viewAttachment(attachment)"><FoodPhoto :attachment="attachment" :alt="`美食收藏截图 ${index + 1}`" /></button></div></section>
        <p v-if="detailError" class="food-error" role="alert">{{ detailError }} <button v-if="detailError.includes('更新') || detailError.includes('冲突')" class="food-text" @click="closeDetails">返回查看保存状态</button></p>
        <details class="food-more"><summary>更多操作</summary><div class="food-actions"><button v-if="selected.status === 'eaten'" class="food-secondary" :disabled="!!busy || readOnly" @click="restoreWant">重新放回想吃</button><button class="food-danger" :disabled="!!busy || readOnly" @click="deleteFood">移到回收站</button></div></details>
      </div>
      <footer class="food-dialog-footer"><button class="food-secondary" :disabled="!!busy || readOnly" @click="editFood(selected)">编辑收藏</button><button v-if="selected.status === 'want' && selected.kind !== 'guide' && !visiting" class="food-primary" :disabled="!!busy || readOnly" @click="startVisit">吃过了</button><button v-else-if="!visiting" class="food-secondary" :disabled="!!busy" @click="closeDetails">收好</button></footer>
    </dialog>

    <dialog v-if="imageViewer" ref="imageDialog" class="food-dialog food-original" @cancel.prevent="closeImage"><header class="food-dialog-heading"><h2>原始截图</h2><button class="food-icon" aria-label="关闭原始截图" @click="closeImage"><i class="ph ph-x" aria-hidden="true"></i></button></header><div class="food-original-body"><p v-if="imageViewer.loading" role="status">正在读取截图…</p><p v-if="imageViewer.error" class="food-error" role="alert">{{ imageViewer.error }} <button class="food-secondary" @click="viewAttachment(imageViewer.attachment)">重试</button></p><img v-if="imageViewer.url" :src="imageViewer.url" alt="美食收藏的原始截图" /></div></dialog>
    <CouponImageEditor v-if="processingFile" :file="processingFile.file" @close="processingFile = null" @save="replaceFile" />
  </main>
</template>

<script setup>
import { computed, inject, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import FoodCard from '../features/food/FoodCard.vue';
import FoodPhoto from '../features/food/FoodPhoto.vue';
import CouponImageEditor from '../features/coupons/CouponImageEditor.vue';
import { couponRequest, readCouponImage, uploadCouponFile } from '../features/coupons/client.js';
import { dayKey } from '../features/coupons/model.js';
import { createFood, normalizeFood, normalizeCity, foodCities, filterFoods, foodMapUrl, extractSourceUrl, safeFoodUrl, validateFoods } from '../features/food/model.js';
import '../features/coupons/coupons.css';
import '../features/food/food.css';

const familyData = inject('familyData'), revision = inject('familyRevision'), commitFamily = inject('commitFamily'), trashItem = inject('trashItem');
const currentMember = inject('currentMember', ref('Aosen')), readOnly = inject('isDemoMode', ref(false));
const route = useRoute(), router = useRouter();
const isPreview = import.meta.env.VITE_PERSONAL_PREVIEW === '1';
const clone = value => JSON.parse(JSON.stringify(value));
const foods = computed(() => (familyData.value.foodPlaces || []).map(normalizeFood));
const city = ref(''), status = ref('want'), query = ref(''), busy = ref(''), notice = ref(''), error = ref(''), undo = ref(null);
const tabs = [{ id: 'want', label: '想吃' }, { id: 'eaten', label: '吃过' }, { id: 'all', label: '全部' }];
const kindLabels = { place: '一家店', guide: '一篇攻略', dish: '一种味道' };
const cities = computed(() => { const names = new Map(foodCities(foods.value).map(name => [normalizeCity(name), name])); if (city.value && city.value !== '__unknown' && !names.has(city.value)) names.set(city.value, city.value); return [...names].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label, 'zh-CN')); });
const cityLabel = computed(() => cities.value.find(name => name.key === city.value)?.label || city.value);
const filtered = computed(() => filterFoods(city.value === '__unknown' ? foods.value.filter(food => !food.city) : foods.value, { city: city.value === '__unknown' ? '' : city.value, status: status.value, query: query.value }));
const editor = ref(null), editorVisible = ref(false), editorDialog = ref(null), editorError = ref(''), discardRequested = ref(false), kindTouched = ref(false), cityTouched = ref(false);
const files = ref([]), recognitionSelection = ref([]), evidence = ref({}), warnings = ref([]), recognitionMessage = ref(''), progress = ref(''), processingFile = ref(null);
const duplicates = computed(() => { const url = editor.value && safeFoodUrl(editor.value.draft.sourceUrl || extractSourceUrl(editor.value.draft.sourceText)); return url ? foods.value.filter(food => food.id !== editor.value.draft.id && food.sourceUrl === url) : []; });
let initialEditor = '', detailSnapshot, detailVersion, lastAttempt = null;
const selectedId = ref(''), selected = computed(() => foods.value.find(food => food.id === selectedId.value)), detailDialog = ref(null), detailError = ref('');
const visiting = ref(false), visitDraft = ref({ visitedOn: '', verdict: '', notes: '' });
const pendingVisits = ref({});
const pendingVisitFood = computed(() => foods.value.find(food => pendingVisits.value[food.id]));
let initialVisit = '';
const imageViewer = ref(null), imageDialog = ref(null); let imageRequest = 0;

function readRememberedCity() { try { return normalizeCity(localStorage.getItem('family-food-city') || ''); } catch { return ''; } }
async function rememberCity() {
  try { if (city.value && city.value !== '__unknown') localStorage.setItem('family-food-city', city.value); else localStorage.removeItem('family-food-city'); } catch {}
  if (route.path === '/life/food') await router.replace({ path: route.path, query: { ...route.query, city: city.value && city.value !== '__unknown' ? city.value : undefined } });
}
function resetFilters() { city.value = ''; status.value = 'want'; query.value = ''; rememberCity(); }
function fillSourceUrl() { if (editor.value && !editor.value.draft.sourceUrl.trim()) editor.value.draft.sourceUrl = extractSourceUrl(editor.value.draft.sourceText); }
async function newFood() {
  if (readOnly.value) return;
  if (editor.value) return resumeEditor();
  await closeDetails();
  const draft = createFood(currentMember.value);
  if (city.value && city.value !== '__unknown') draft.city = cityLabel.value;
  editor.value = { isNew: true, draft, snapshot: clone(familyData.value), revision: revision.value };
  resetRecognition(); initialEditor = JSON.stringify(draft); await resumeEditor();
}
async function editFood(food) {
  if (readOnly.value) return;
  if (editor.value) { await closeDetails(); return resumeEditor(); }
  await closeDetails();
  editor.value = { isNew: false, draft: clone(food), snapshot: clone(familyData.value), revision: revision.value };
  resetRecognition(); kindTouched.value = true; cityTouched.value = true;
  recognitionSelection.value = food.attachments.slice(0, 3).map(attachment => attachment.objectKey);
  initialEditor = JSON.stringify(editor.value.draft); await resumeEditor();
}
async function extractPlace() {
  if (!selected.value || readOnly.value) return;
  if (editor.value) { await closeDetails(); return resumeEditor(); }
  const source = clone(selected.value); await closeDetails();
  const draft = createFood(currentMember.value);
  Object.assign(draft, { city: source.city, sourceText: source.sourceText, sourceUrl: source.sourceUrl, attachments: source.attachments, kind: 'place' });
  editor.value = { isNew: true, draft, snapshot: clone(familyData.value), revision: revision.value };
  resetRecognition(); kindTouched.value = true; cityTouched.value = true; initialEditor = JSON.stringify(draft);
  await resumeEditor();
}
function resetRecognition() { evidence.value = {}; warnings.value = []; recognitionMessage.value = ''; progress.value = ''; kindTouched.value = false; cityTouched.value = false; recognitionSelection.value = []; editorError.value = ''; }
async function resumeEditor() { editorVisible.value = true; discardRequested.value = false; await nextTick(); if (editorDialog.value && !editorDialog.value.open) editorDialog.value.showModal(); }
function pauseEditor() { editorDialog.value?.close(); editorVisible.value = false; discardRequested.value = false; }
function hasDraftChanges() { return editor.value && (JSON.stringify(editor.value.draft) !== initialEditor || files.value.length > 0); }
function closeEditor() { if (busy.value) return; if (hasDraftChanges()) discardRequested.value = true; else finishEditor(); }
function releaseFiles() { files.value.forEach(file => URL.revokeObjectURL(file.url)); files.value = []; recognitionSelection.value = []; }
function finishEditor() { lastAttempt = null; editorDialog.value?.close(); editor.value = null; editorVisible.value = false; discardRequested.value = false; editorError.value = ''; processingFile.value = null; resetRecognition(); releaseFiles(); }
function selectFiles(event) {
  editorError.value = '';
  for (const file of Array.from(event.target.files || [])) {
    if (files.value.length + editor.value.draft.attachments.length >= 6) { editorError.value = '每份收藏最多附 6 张截图。'; break; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) { editorError.value = '请选择 4 MB 以内的 JPG、PNG 或 WebP 截图。'; continue; }
    const id = crypto.randomUUID(); files.value.push({ id, file, url: URL.createObjectURL(file), attachment: null, error: '' });
    if (recognitionSelection.value.length < 3) recognitionSelection.value.push(id);
  }
  event.target.value = '';
}
function removeFile(id) { recognitionSelection.value = recognitionSelection.value.filter(value => value !== id); const index = files.value.findIndex(file => file.id === id); if (index >= 0) { URL.revokeObjectURL(files.value[index].url); files.value.splice(index, 1); } }
function removeAttachment(key) { recognitionSelection.value = recognitionSelection.value.filter(value => value !== key); editor.value.draft.attachments = editor.value.draft.attachments.filter(attachment => attachment.objectKey !== key); }
function replaceFile(file) { const target = processingFile.value; if (!target) return; if (file.size > 4 * 1024 * 1024) { editorError.value = '处理后的图片超过 4 MB，请再裁剪一些。'; processingFile.value = null; return; } URL.revokeObjectURL(target.url); target.file = file; target.url = URL.createObjectURL(file); target.attachment = null; target.error = ''; processingFile.value = null; }
async function uploadFiles() {
  for (let index = 0; index < files.value.length; index++) {
    const item = files.value[index]; if (item.attachment) continue;
    progress.value = `正在保存截图 ${index + 1} / ${files.value.length}…`; item.error = '';
    try { item.attachment = await uploadCouponFile(item.file); } catch (error) { item.error = error.message; throw error; }
  }
  return [...new Map([...editor.value.draft.attachments, ...files.value.map(file => file.attachment).filter(Boolean)].map(attachment => [attachment.objectKey, attachment])).values()];
}
async function recognize() {
  if (busy.value) return; busy.value = 'recognize'; editorError.value = '';
  try {
    if (recognitionSelection.value.length > 3) throw Error('一次最多勾选 3 张截图，其他截图仍会随收藏保存。');
    if (!recognitionSelection.value.length && !editor.value.draft.sourceText.trim()) throw Error('先放入分享文字，或勾选截图。');
    await uploadFiles();
    const keys = [...editor.value.draft.attachments.filter(attachment => recognitionSelection.value.includes(attachment.objectKey)).map(attachment => attachment.objectKey), ...files.value.filter(file => recognitionSelection.value.includes(file.id)).map(file => file.attachment.objectKey)];
    progress.value = '正在整理这份收藏…';
    const result = await couponRequest('/api/food-recognize', { attachmentKeys: [...new Set(keys)], sourceText: editor.value.draft.sourceText, allowExternal: true });
    for (const key of ['title', 'area', 'address', 'dishes']) if (!editor.value.draft[key].trim() && typeof result.draft?.[key] === 'string' && result.draft[key]) editor.value.draft[key] = result.draft[key];
    if (!kindTouched.value && ['place', 'guide', 'dish'].includes(result.draft?.kind)) editor.value.draft.kind = result.draft.kind;
    fillSourceUrl(); evidence.value = result.evidence || {}; warnings.value = [...(result.warnings || [])];
    if (result.draft?.city) { if (!editor.value.draft.city.trim() || !cityTouched.value) editor.value.draft.city = result.draft.city; else if (normalizeCity(editor.value.draft.city) !== normalizeCity(result.draft.city)) warnings.value.push(`识别出的城市为“${result.draft.city}”，与你填写的“${editor.value.draft.city}”不同，请核对。`); }
    recognitionMessage.value = result.source === 'preview' ? '本机预览已整理可确认的信息，请核对后保存。' : '已填入空白项，你写下的内容保持不变。请核对后保存。';
  } catch (error) { editorError.value = error.message + ' 输入和截图仍保留，可以直接填写并保存。'; }
  finally { busy.value = ''; progress.value = ''; }
}
async function saveEditor() {
  if (busy.value || readOnly.value) return; busy.value = 'save'; editorError.value = '';
  try {
    fillSourceUrl(); const state = editor.value, draft = clone(state.draft);
    if (draft.sourceUrl && !safeFoodUrl(draft.sourceUrl)) throw Error('原链接请使用完整的 http 或 https 网址。');
    if (!draft.title.trim()) {
      if (!draft.sourceText.trim() && !draft.sourceUrl && !draft.attachments.length && !files.value.length) throw Error('填一个名称，或者放入分享文字、链接或截图。');
      draft.title = '待整理收藏'; draft.kind = 'guide';
    }
    const saved = normalizeFood({ ...draft, attachments: await uploadFiles(), updatedAt: new Date().toISOString() });
    validateFoods([saved]);
    const submittedInput = JSON.stringify(state.draft), submittedFiles = JSON.stringify(files.value.map(file => file.id));
    await commitFamily(data => { data.foodPlaces ||= []; const index = data.foodPlaces.findIndex(item => item.id === saved.id); if (!state.isNew && index < 0) throw Error('这份收藏已被移除，请先检查最新记录。'); if (index >= 0) data.foodPlaces[index] = saved; else data.foodPlaces.unshift(saved); lastAttempt = { saved: clone(saved), input: submittedInput, files: submittedFiles }; }, { label: '寻味清单已保存', snapshot: state.snapshot, revision: state.revision });
    finishEditor(); status.value = saved.status; city.value = normalizeCity(saved.city); query.value = ''; await rememberCity();
    notice.value = saved.title === '待整理收藏' ? '已先收好，之后可以补店名与城市。' : '已收好，下一顿饭多了一个小期待。'; undo.value = null;
  } catch (error) { editorError.value = error.message; }
  finally { busy.value = ''; progress.value = ''; }
}
async function openDetails(food, updateUrl = true) {
  if (editorVisible.value) pauseEditor(); stashVisit(); selectedId.value = food.id; detailError.value = ''; visiting.value = false;
  detailSnapshot = clone(familyData.value); detailVersion = revision.value; await nextTick();
  if (detailDialog.value && !detailDialog.value.open) detailDialog.value.showModal();
  if (updateUrl) await router.replace({ path: '/life/food', query: { ...route.query, food: food.id, add: undefined } });
}
async function closeDetails() { stashVisit(); detailDialog.value?.close(); selectedId.value = ''; visiting.value = false; if (route.path === '/life/food' && route.query.food) await router.replace({ path: route.path, query: { ...route.query, food: undefined } }); }
function startVisit() { if (!selected.value || readOnly.value) return; const base = { visitedOn: selected.value.status === 'eaten' && selected.value.visitedOn ? selected.value.visitedOn : dayKey(), verdict: selected.value.status === 'eaten' ? selected.value.verdict : '', notes: selected.value.notes }; initialVisit = JSON.stringify(base); visitDraft.value = clone(pendingVisits.value[selected.value.id] || base); visiting.value = true; nextTick(() => detailDialog.value?.querySelector('.food-visit-form input')?.focus()); }
function stashVisit() { if (selectedId.value && visiting.value && JSON.stringify(visitDraft.value) !== initialVisit) pendingVisits.value[selectedId.value] = clone(visitDraft.value); }
function pauseVisit() { stashVisit(); visiting.value = false; }
async function openVisit(food) { await openDetails(food); startVisit(); }
async function updateSelected(mutator, label, operation = 'update') {
  if (busy.value || readOnly.value || !selected.value) return false; busy.value = operation; detailError.value = '';
  const id = selectedId.value;
  try { await commitFamily(data => { const item = data.foodPlaces?.find(food => food.id === id); if (!item) throw Error('这份收藏已被移除，请刷新。'); mutator(item); item.updatedAt = new Date().toISOString(); validateFoods([item]); }, { label, snapshot: detailSnapshot, revision: detailVersion }); detailSnapshot = clone(familyData.value); detailVersion = revision.value; return true; }
  catch (error) { detailError.value = error.message; return false; }
  finally { busy.value = ''; }
}
function rememberUndo(before, after) {
  undo.value = async () => commitFamily(data => { const item = data.foodPlaces?.find(food => food.id === before.id); if (!item || item.updatedAt !== after.updatedAt) throw Error('这份收藏已有新的修改，请在详情中调整。'); for (const key of ['status', 'visitedOn', 'verdict', 'notes']) item[key] = before[key]; item.updatedAt = new Date().toISOString(); }, { label: '已撤销寻味记录修改' });
}
async function saveVisit() {
  const before = clone(selected.value), visit = clone(visitDraft.value);
  if (await updateSelected(item => { item.status = 'eaten'; Object.assign(item, visit); }, '已记下这次寻味', 'visit')) { rememberUndo(before, clone(selected.value)); notice.value = '这次的味道已记下。'; delete pendingVisits.value[before.id]; visiting.value = false; await closeDetails(); }
}
async function restoreWant() {
  const before = clone(selected.value);
  if (await updateSelected(item => { item.status = 'want'; }, '已放回想吃清单')) { rememberUndo(before, clone(selected.value)); notice.value = '已重新放回想吃，之前的感受仍保留。'; await closeDetails(); }
}
async function undoAction() { if (!undo.value || busy.value) return; busy.value = 'undo'; error.value = ''; try { await undo.value(); notice.value = '已撤销这次修改。'; undo.value = null; } catch (errorValue) { error.value = errorValue.message; } finally { busy.value = ''; } }
async function deleteFood() { if (busy.value || readOnly.value) return; busy.value = 'delete'; try { await trashItem('foodPlaces', selectedId.value); delete pendingVisits.value[selectedId.value]; visiting.value = false; await closeDetails(); } catch (error) { detailError.value = error.message; } finally { busy.value = ''; } }
async function viewAttachment(attachment) {
  const request = ++imageRequest; if (imageViewer.value?.url) URL.revokeObjectURL(imageViewer.value.url);
  imageViewer.value = { attachment, url: '', loading: true, error: '' }; await nextTick(); if (imageDialog.value && !imageDialog.value.open) imageDialog.value.showModal();
  try { const url = await readCouponImage(attachment.objectKey); if (request !== imageRequest || !imageViewer.value) { URL.revokeObjectURL(url); return; } imageViewer.value.url = url; }
  catch (error) { if (request === imageRequest && imageViewer.value) imageViewer.value.error = error.message; }
  finally { if (request === imageRequest && imageViewer.value) imageViewer.value.loading = false; }
}
function closeImage() { imageRequest++; if (imageViewer.value?.url) URL.revokeObjectURL(imageViewer.value.url); imageDialog.value?.close(); imageViewer.value = null; }
let routeApplying = false;
async function applyRoute() {
  if (route.path !== '/life/food' || routeApplying) return; routeApplying = true;
  try {
    if (typeof route.query.city === 'string') city.value = normalizeCity(route.query.city);
    if (route.query.add === '1') { await newFood(); await router.replace({ path: route.path, query: { ...route.query, add: undefined } }); }
    else if (typeof route.query.food === 'string') { const food = foods.value.find(item => item.id === route.query.food); if (food && selectedId.value !== food.id) await openDetails(food, false); }
    else if (selectedId.value) { stashVisit(); detailDialog.value?.close(); selectedId.value = ''; visiting.value = false; }
  } finally { routeApplying = false; }
}
function beforeUnload(event) { if (hasDraftChanges() || busy.value || pendingVisitFood.value || visiting.value && JSON.stringify(visitDraft.value) !== initialVisit) { event.preventDefault(); event.returnValue = ''; } }
watch(() => [route.query.food, route.query.add, route.query.city, foods.value.length], applyRoute);
watch(() => revision.value, () => {
  if (busy.value || !editor.value || !lastAttempt) return;
  const received = foods.value.find(food => food.id === lastAttempt.saved.id);
  if (!received || JSON.stringify(received) !== JSON.stringify(lastAttempt.saved)) return;
  if (JSON.stringify(editor.value.draft) === lastAttempt.input && JSON.stringify(files.value.map(file => file.id)) === lastAttempt.files) { finishEditor(); notice.value = '刚才的收藏已重试保存成功。'; }
  else { editor.value.snapshot = clone(familyData.value); editor.value.revision = revision.value; editor.value.isNew = false; initialEditor = JSON.stringify(received); lastAttempt = null; editorError.value = ''; notice.value = '刚才的内容已保存，后来补写的内容仍留在编辑框里。'; }
});
onMounted(() => { city.value = typeof route.query.city === 'string' ? normalizeCity(route.query.city) : readRememberedCity(); applyRoute(); window.addEventListener('beforeunload', beforeUnload); });
onActivated(() => { if (!route.query.city) city.value = readRememberedCity(); applyRoute(); });
onDeactivated(() => { stashVisit(); pauseEditor(); closeImage(); detailDialog.value?.close(); selectedId.value = ''; processingFile.value = null; });
onBeforeRouteLeave(() => { if (busy.value) return false; stashVisit(); pauseEditor(); closeImage(); detailDialog.value?.close(); selectedId.value = ''; });
onBeforeUnmount(() => { window.removeEventListener('beforeunload', beforeUnload); releaseFiles(); closeImage(); });
</script>
