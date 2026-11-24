<template>
  <main class="life-page">
    <header class="life-heading"><div><p class="eyebrow">OUR EVERYDAY</p><h1>生活点滴</h1></div><label class="member-picker">这台设备的署名<select :value="currentMember" @change="setCurrentMember($event.target.value)"><option>Aosen</option><option>小悦</option></select></label></header>
    <p v-if="actionError" role="alert" class="error-message">{{ actionError }} <button class="text-button" @click="actionError = ''">收起</button></p>
    <div v-if="editor && editorHidden" class="draft-banner" role="status"><span>还有一份没保存的{{ editor.collection === 'moments' ? '小事' : '生活记录' }}，内容已留在这里。</span><button class="secondary-button" @click="resumeEditor">继续编辑</button></div>
    <section class="moments-section panel" aria-labelledby="moments-heading">
      <div class="section-heading"><div><p class="eyebrow">THE LITTLE THINGS</p><h2 id="moments-heading">共同小事</h2><p class="muted">一句话、一张照片，留住被照顾的瞬间。</p></div><button class="primary-button" @click="openEditor('moments')"><i class="ph ph-plus" aria-hidden="true"></i> 留住这一刻</button></div>
      <div v-if="featuredMemory" class="featured-memory"><button v-if="normalizedPhotos(featuredMemory)[0]" class="memory-image" @click="openPhoto(normalizedPhotos(featuredMemory)[0], featuredMemory.text)"><img :src="photoThumb(normalizedPhotos(featuredMemory)[0])" alt="珍藏的小事" loading="lazy" /></button><div class="memory-copy"><p class="eyebrow"><i class="ph-fill ph-bookmark-simple" aria-hidden="true"></i> 我们珍藏的一天 · {{ displayDate(featuredMemory.date) }}</p><p>{{ featuredMemory.text }}</p><span class="muted">{{ featuredMemory.author || '我们' }}记下的</span></div><div class="memory-actions"><button class="text-button" @click="memoryDismissed = true">暂时收起</button><button class="text-button" :disabled="!!busy" @click="muteMemory(featuredMemory.id)">不再回顾这条</button></div></div>
      <div v-if="!moments.length" class="empty-state"><i class="ph ph-heart" aria-hidden="true"></i><p>从今天的一件小事开始。</p><span>好吃的晚饭、一起散的步，都值得留住。</span></div>
      <div v-else class="moment-grid"><article v-for="moment in moments.slice(0, momentLimit)" :key="moment.id" class="moment-card"><div class="moment-meta"><span class="member-avatar">{{ moment.author === '小悦' ? '悦' : moment.author === 'Aosen' ? 'A' : '家' }}</span><span>{{ moment.author || '我们' }}<small>{{ displayDate(moment.date) }}</small></span><button class="icon-button" :aria-label="`编辑${moment.author || '我们'}的小事`" @click="openEditor('moments', moment)"><i class="ph ph-pencil-simple" aria-hidden="true"></i></button></div><p class="moment-text">{{ moment.text }}</p><div v-if="normalizedPhotos(moment).length" class="moment-photos" :class="{ single: normalizedPhotos(moment).length === 1 }"><button v-for="(photo, index) in normalizedPhotos(moment)" :key="photo.id || photo.url" @click="openPhoto(photo, moment.text)"><img :src="photoThumb(photo)" :alt="`这件小事的照片 ${index + 1}`" loading="lazy" /></button></div><div class="moment-actions"><button class="quiet-button" :class="{ selected: moment.rememberedBy?.includes(currentMember) }" :aria-pressed="!!moment.rememberedBy?.includes(currentMember)" :disabled="!!busy" @click="rememberMoment(moment)"><i class="ph ph-heart-straight" aria-hidden="true"></i> 我记得<span v-if="moment.rememberedBy?.length"> · {{ moment.rememberedBy.length }}</span></button><button class="quiet-button" :class="{ selected: moment.starred }" :aria-pressed="!!moment.starred" :disabled="!!busy" @click="starMoment(moment)"><i class="ph ph-bookmark-simple" aria-hidden="true"></i> {{ moment.starred ? '已珍藏' : '珍藏' }}</button></div><p v-if="moment.rememberedBy?.length" class="remembered-names">{{ moment.rememberedBy.join('、') }}也记得</p></article></div>
      <button v-if="moments.length > momentLimit" class="text-button show-more" @click="momentLimit += 6">再看一些小事 <i class="ph ph-arrow-down" aria-hidden="true"></i></button>
    </section>
    <div class="section-heading modules-heading"><div><h2>我们的生活</h2><p class="muted">把常用的放在手边。</p></div><button v-if="!organizing" class="secondary-button" @click="startOrganizing"><i class="ph ph-sliders-horizontal" aria-hidden="true"></i> 整理模块</button></div>
    <section v-if="organizing" class="panel layout-editor" aria-label="整理生活模块"><div class="section-heading"><div><h3>按我们的习惯来</h3><p class="muted">隐藏只收起模块，里面的记录会保留。</p></div><div class="button-row"><button class="secondary-button" :disabled="!!busy" @click="cancelOrganizing">取消</button><button class="primary-button" :disabled="!!busy" @click="saveLayout">{{ busy === 'layout' ? '保存中…' : '保存布局' }}</button></div></div><div class="layout-list"><div v-for="(module, index) in layoutDraft" :key="module.id" class="layout-row"><label><input v-model="module.visible" type="checkbox" :disabled="!!busy" /><i class="ph" :class="moduleInfo(module.id).icon" aria-hidden="true"></i>{{ moduleInfo(module.id).title }}</label><div><button class="icon-button" :disabled="index === 0 || !!busy" :aria-label="`上移${moduleInfo(module.id).title}`" @click="moveModule(index, -1)"><i class="ph ph-arrow-up" aria-hidden="true"></i></button><button class="icon-button" :disabled="index === layoutDraft.length - 1 || !!busy" :aria-label="`下移${moduleInfo(module.id).title}`" @click="moveModule(index, 1)"><i class="ph ph-arrow-down" aria-hidden="true"></i></button></div></div></div></section>
    <div class="module-grid"><template v-for="module in visibleModules" :key="module.id"><CouponModule v-if="module.id === 'coupons'" :items="records('coupons')" :today="today" /><LifeModule v-else :module="module" :items="moduleRecords(module.collection)" :today="today" :busy="!!busy || isReadOnly" :save-quick-todo="addQuickTodo" @edit="openEditor" @water="waterHabit" @toggle="toggleTodo" @book="openBook" @photo="openPhoto" @quick-saved="onQuickTodoSaved" /></template></div>
    <p v-if="!visibleModules.length" class="panel empty-inline">生活模块已收起。点“整理模块”可以随时找回来。</p>
    <dialog v-if="editor" ref="editorDialog" class="life-dialog" @cancel.prevent="closeEditor"><form @submit.prevent="saveEditor"><header class="dialog-heading"><div><p class="eyebrow">{{ editor.isNew ? 'A LITTLE NEW THING' : 'MAKE IT YOURS' }}</p><h2>{{ editorTitle }}</h2></div><button type="button" class="icon-button" aria-label="关闭编辑" :disabled="!!busy" @click="closeEditor"><i class="ph ph-x" aria-hidden="true"></i></button></header><fieldset class="dialog-body" :disabled="!!busy">
      <template v-if="editor.collection === 'moments'"><label>这一刻<textarea v-model="editor.draft.text" rows="4" maxlength="1200" placeholder="比如：下班回家，发现桌上留着我喜欢的汤。" required autofocus /></label><div class="form-grid"><label>谁记下的<select v-model="editor.draft.author"><option>Aosen</option><option>小悦</option></select></label><label>发生在哪天<input v-model="editor.draft.date" type="date" required /></label></div></template>
      <template v-else-if="editor.collection === 'habits'"><label>想养成的小习惯<input v-model="editor.draft.name" maxlength="80" required autofocus /></label><p class="muted">累计记录，不要求连续打卡。漏掉一天也没关系。</p><details class="reward-options"><summary>小奖励（可选）</summary><div v-for="stage in [1, 2, 3]" :key="stage" class="form-grid"><label>累计天数<input v-model.number="editor.draft[`stage${stage}Days`]" type="number" min="1" max="3650" /></label><label>给自己的小奖励<input v-model="editor.draft[`stage${stage}Reward`]" maxlength="80" /></label></div></details></template>
      <template v-else-if="editor.collection === 'todos'"><label>要做什么<input v-model="editor.draft.text" maxlength="200" required autofocus /></label><div class="form-grid"><label>交给谁<select v-model="editor.draft.owner"><option>一起</option><option>Aosen</option><option>小悦</option></select></label><label>计划日期<input v-model="editor.draft.dueDate" type="date" /></label></div><label>重复方式<select v-model="editor.draft.repeatType"><option value="none">只做这一次</option><option value="weekly">固定每周</option><option value="after">完成后再隔几天</option></select></label><label v-if="editor.draft.repeatType === 'weekly'">每周哪一天<select v-model.number="editor.draft.repeatWeekday"><option v-for="(day, index) in weekdays" :key="index" :value="index">{{ day }}</option></select></label><label v-if="editor.draft.repeatType === 'after'">完成后几天<input v-model.number="editor.draft.repeatDays" type="number" min="1" max="365" required /></label><p v-if="editor.draft.repeatType !== 'none'" class="field-help">本次完成后会自动安排下一次，已经完成的记录会保留。</p><p v-if="editor.draft.nextOccurrenceId" class="field-help">这次记录已有下一次待办。调整后续计划，请编辑那条未完成的待办。</p></template>
      <template v-else-if="editor.collection === 'goals'"><label>一起期待什么<input v-model="editor.draft.name" maxlength="80" required autofocus /></label><div class="form-grid"><label>目标金额（元）<input v-model.number="editor.draft.target" type="number" min="1" max="999999999" step="0.01" required /></label><label>已准备（元）<input v-model.number="editor.draft.current" type="number" min="0" max="999999999" step="0.01" required /></label></div></template>
      <template v-else-if="editor.collection === 'dates'"><label>这个日子的名字<input v-model="editor.draft.name" maxlength="80" required autofocus /></label><div class="form-grid"><label>最初的日期<input v-model="editor.draft.date" type="date" required /></label><label>是什么日子<select v-model="editor.draft.type"><option value="anniversary">纪念日</option><option value="birthday">生日</option><option value="event">一次性安排</option></select></label></div><p class="field-help">生日和纪念日每年自动回顾，安排只记录这一次。2 月 29 日在平年按 2 月 28 日显示。</p></template>
      <template v-else-if="editor.collection === 'milestones'"><label>小小的新发现<input v-model="editor.draft.title" maxlength="120" required autofocus /></label><div class="form-grid"><label>日期<input v-model="editor.draft.date" type="date" required /></label><label>记录类型<input v-model="editor.draft.type" list="milestone-types" maxlength="40" /><datalist id="milestone-types"><option>成长记录</option><option>检查记录</option><option>第一次</option><option>日常点滴</option></datalist></label></div><label>想记下的话<textarea v-model="editor.draft.desc" rows="4" maxlength="4000" /></label></template>
      <template v-else-if="editor.collection === 'books'"><label>书名<input v-model="editor.draft.title" maxlength="120" required autofocus /></label><label>作者<input v-model="editor.draft.author" maxlength="120" /></label><label>我的读书笔记<textarea v-model="editor.draft.note" rows="9" maxlength="50000" placeholder="一句喜欢的话，或者一点读后感。支持 Markdown。" /></label><label>封面地址（可选）<input v-model="editor.draft.cover" type="url" placeholder="https://…" /></label></template>
      <div v-if="['moments', 'milestones'].includes(editor.collection)" class="photo-field"><span class="field-label">照片（可选）</span><div class="draft-photos"><div v-for="(photo, index) in editor.draft.photos" :key="photo.id || photo.url"><img :src="photoThumb(photo)" :alt="`已选照片 ${index + 1}`" /><button type="button" class="photo-remove" :disabled="!!busy" :aria-label="`移除照片 ${index + 1}`" @click="editor.draft.photos.splice(index, 1)"><i class="ph ph-x" aria-hidden="true"></i></button></div><div v-for="photo in pendingPhotos" :key="photo.id"><img :src="photo.preview" alt="准备上传的照片" /><button type="button" class="photo-remove" :disabled="!!busy" aria-label="移除准备上传的照片" @click="removePendingPhoto(photo.id)"><i class="ph ph-x" aria-hidden="true"></i></button></div></div><label class="photo-picker secondary-button"><i class="ph ph-image" aria-hidden="true"></i> 选几张照片<input type="file" accept="image/*" multiple :disabled="!!busy" @change="selectPhotos" /></label><p class="field-help">最多 6 张，每张不超过 15 MB。</p></div>
      <p v-if="editorError" role="alert" class="error-message">{{ editorError }}<button type="button" class="text-button" :disabled="!!busy" @click="pauseEditor">保留草稿并收起</button></p>
      <div v-if="discardRequested" class="discard-confirmation" role="alert"><p>这次修改还没有保存，要放弃吗？</p><div class="button-row"><button ref="continueEditingButton" type="button" class="secondary-button" @click="discardRequested = false">继续编辑</button><button type="button" class="danger-button" @click="finishEditor">放弃修改</button></div></div>
    </fieldset><footer class="dialog-actions"><button v-if="!editor.isNew" type="button" class="danger-button" :disabled="!!busy" @click="deleteEditedItem"><i class="ph ph-trash" aria-hidden="true"></i> 移到回收站</button><span class="action-spacer"></span><button type="button" class="secondary-button" :disabled="!!busy" @click="closeEditor">取消</button><button class="primary-button" :disabled="!!busy">{{ busy === 'editor' ? '保存中…' : '保存' }}</button></footer></form></dialog>
    <dialog v-if="activeBook" ref="bookDialog" class="life-dialog book-dialog" @cancel.prevent="closeBook"><header class="dialog-heading"><div><p class="eyebrow">ON OUR BOOKSHELF</p><h2>{{ activeBook.title }}</h2><p class="muted">{{ activeBook.author }}</p></div><button class="icon-button" aria-label="关闭读书笔记" @click="closeBook"><i class="ph ph-x" aria-hidden="true"></i></button></header><div class="dialog-body"><article v-if="bookNote(activeBook)" class="book-note" v-html="renderMarkdown(bookNote(activeBook))"></article><p v-else class="empty-inline">读到喜欢的一句，就先记下一句。</p></div><footer class="dialog-actions"><button class="secondary-button" @click="editActiveBook">编辑笔记</button><button class="primary-button" @click="closeBook">合上书</button></footer></dialog>
    <dialog v-if="activePhoto" ref="photoDialog" class="life-dialog photo-dialog" @cancel.prevent="closePhoto"><header class="dialog-heading"><h2>{{ activePhoto.title }}</h2><button class="icon-button" aria-label="关闭照片" @click="closePhoto"><i class="ph ph-x" aria-hidden="true"></i></button></header><div class="photo-view"><img :src="activePhoto.photo.url" :alt="activePhoto.title" /><p v-if="activePhoto.photo.desc">{{ activePhoto.photo.desc }}</p></div></dialog>
  </main>
</template>

<script setup>
import { computed, inject, nextTick, onActivated, onBeforeUnmount, onDeactivated, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import LifeModule from '../features/life/LifeModule.vue'
import CouponModule from '../features/coupons/CouponModule.vue'
import { couponCalendarEvents } from '../features/coupons/model.js'
import { insertQuickTodo } from '../features/life/quickTodo.js'
import { LIFE_MODULES, bookNote, ensureLifeIds, localDayKey, newLifeId, normalizeLifeLayout, normalizeRecurrence, normalizedPhotos, parseDayKey, stableLifeId, toggleTodoInDraft } from '../features/life/model.js'
import '../features/life/life.css'

const familyData = inject('familyData')
const commitFamily = inject('commitFamily', null), trashItem = inject('trashItem', null), uploadPhotoFile = inject('uploadPhotoFile', null)
const currentMember = inject('currentMember', ref('Aosen'))
const isReadOnly = inject('isDemoMode', ref(false))
const setCurrentMember = inject('setCurrentMember', name => { currentMember.value = name })
const triggerPushNotification = inject('triggerPushNotification', null)
const clock = ref(new Date())
const today = computed(() => localDayKey(clock.value))
const clockTimer = setInterval(() => { clock.value = new Date() }, 30000)
const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const busy = ref(''), actionError = ref(''), actionErrorSource = ref(''), momentLimit = ref(3)
const organizing = ref(false), layoutDraft = ref([]), memoryDismissed = ref(false)
const editor = ref(null), editorDialog = ref(null), editorError = ref(''), pendingPhotos = ref([]), editorHidden = ref(false)
const discardRequested = ref(false), continueEditingButton = ref(null)
const activeBook = ref(null), bookDialog = ref(null), activePhoto = ref(null), photoDialog = ref(null)
let editorSnapshot = '', opener = null
const records = collection => (familyData.value[collection] || []).map((item, index) => ({ ...item, id: stableLifeId(collection, item, index) }))
const moduleRecords = collection => collection === 'dates' ? [...records('dates'), ...couponCalendarEvents(familyData.value.coupons || [])] : records(collection)
const moments = computed(() => records('moments').sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || '')))
const layout = computed(() => normalizeLifeLayout(familyData.value.lifeLayout))
const moduleInfo = id => LIFE_MODULES.find(module => module.id === id)
const visibleModules = computed(() => layout.value.filter(module => module.visible).map(module => moduleInfo(module.id)))
const featuredMemory = computed(() => {
  const preferences = familyData.value.familyPreferences || {}
  if (memoryDismissed.value || preferences.memoriesEnabled === false) return null
  const candidates = moments.value.filter(item => item.starred && item.date < today.value && !(preferences.dismissedMemoryIds || []).includes(item.id))
  return candidates.length ? candidates[Number(today.value.replaceAll('-', '')) % candidates.length] : null
})
const editorTitle = computed(() => ({ moments: editor.value?.isNew ? '留住这一刻' : '编辑这一刻', habits: '照顾一个小习惯', todos: '安排一件小事', goals: '一起期待的事', dates: '记住这个日子', milestones: '宝宝的新发现', books: '留在我们的书架' }[editor.value?.collection]))
const clone = item => JSON.parse(JSON.stringify(item))
const displayDate = value => parseDayKey(value) ? `${value.slice(0, 4)}.${value.slice(5, 7)}.${value.slice(8, 10)}` : '日期待补充'
const photoThumb = photo => photo.thumbnailUrl || photo.url
function find(draft, collection, id) { ensureLifeIds(draft); const item = draft[collection].find(row => String(row.id) === String(id)); if (!item) throw new Error('这条记录已被修改或移除，请刷新后再试。'); return item }
async function commit(mutator, label) { if (!commitFamily) throw new Error('保存服务暂时不可用，请刷新后再试。'); await commitFamily(draft => { ensureLifeIds(draft); mutator(draft) }, { label }) }
async function act(key, operation) { if (busy.value) return false; if (isReadOnly.value) { actionErrorSource.value = 'readonly'; actionError.value = '当前为只读展示，不能修改记录。'; return false }; busy.value = key; actionError.value = ''; actionErrorSource.value = ''; try { await operation(); return true } catch (error) { actionErrorSource.value = key; actionError.value = error.message || '没有保存成功，请再试一次。'; return false } finally { busy.value = '' } }
function notifyReminder(title, content) { if (familyData.value.notificationSettings?.enabled && triggerPushNotification) Promise.resolve(triggerPushNotification(title, content)).catch(() => {}) }
function startOrganizing() { if (isReadOnly.value) { actionError.value = '当前为只读展示，不能调整布局。'; return }; layoutDraft.value = clone(layout.value); organizing.value = true }
function cancelOrganizing() { organizing.value = false; layoutDraft.value = [] }
function moveModule(index, offset) { const next = index + offset; if (next < 0 || next >= layoutDraft.value.length) return; [layoutDraft.value[index], layoutDraft.value[next]] = [layoutDraft.value[next], layoutDraft.value[index]] }
async function saveLayout() { if (await act('layout', () => commit(draft => { draft.lifeLayout = clone(layoutDraft.value) }, '生活布局已保存'))) cancelOrganizing() }
function rememberMoment(moment) { return act(`remember-${moment.id}`, () => commit(draft => { const item = find(draft, 'moments', moment.id); const members = new Set(item.rememberedBy || []); members.has(currentMember.value) ? members.delete(currentMember.value) : members.add(currentMember.value); item.rememberedBy = [...members] }, '已记下这份回应')) }
function starMoment(moment) { return act(`star-${moment.id}`, () => commit(draft => { const item = find(draft, 'moments', moment.id); item.starred = !item.starred }, moment.starred ? '已取消珍藏' : '已放入共同珍藏')) }
function muteMemory(id) { return act('memory', () => commit(draft => { draft.familyPreferences ||= {}; draft.familyPreferences.dismissedMemoryIds = [...new Set([...(draft.familyPreferences.dismissedMemoryIds || []), id])] }, '这条小事不再自动回顾')) }
async function waterHabit(habit) { const changed = await act(`habit-${habit.id}`, () => commit(draft => { const item = find(draft, 'habits', habit.id); if (item.lastWatered === localDayKey()) return; item.growthValue = Number(item.growthValue || 0) + 1; item.lastWatered = localDayKey() }, '今天的一点坚持，收到了')); if (changed) notifyReminder('今天的一点坚持', '家里的小习惯又被照顾了一次。') }
async function addQuickTodo(attempt) { return act(`quick-todo:${attempt.id}`, () => commit(draft => { insertQuickTodo(draft, attempt) }, '待办已记下')) }
function onQuickTodoSaved(id) { if (actionErrorSource.value === `quick-todo:${id}`) { actionError.value = ''; actionErrorSource.value = '' } }
async function toggleTodo(todo) { const changed = await act(`todo-${todo.id}`, () => commit(draft => { toggleTodoInDraft(draft, todo.id) }, todo.completed ? '待办已重新打开' : '又完成了一件小事')); if (changed && !todo.completed) notifyReminder('一件小事完成了', '家庭待办有了新的进展。') }
function openEditor(collection, item) {
  if (isReadOnly.value) { actionError.value = '当前为只读展示，不能修改记录。'; return }
  if (editor.value) { resumeEditor(); return }
  opener = document.activeElement
  const defaults = { moments: { text: '', date: localDayKey(), author: currentMember.value, photos: [], rememberedBy: [], starred: false }, habits: { name: '', growthValue: 0, lastWatered: '', stage1Days: 7, stage1Reward: '', stage2Days: 21, stage2Reward: '', stage3Days: 100, stage3Reward: '' }, todos: { text: '', owner: '一起', dueDate: '', completed: false }, goals: { name: '', target: '', current: 0 }, dates: { name: '', date: '', type: 'anniversary' }, milestones: { title: '', desc: '', type: '成长记录', date: localDayKey(), icon: 'ph-baby', photos: [] }, books: { title: '', author: '', note: '', cover: '' } }
  const draft = { ...defaults[collection], ...(item ? clone(item) : {}), id: item?.id ?? newLifeId(collection) }
  if (['moments', 'milestones'].includes(collection)) draft.photos = normalizedPhotos(draft)
  if (collection === 'books') draft.note = bookNote(item || {})
  if (collection === 'todos') { draft.repeatType = draft.recurrence?.type || 'none'; draft.repeatWeekday = draft.recurrence?.weekday ?? 1; draft.repeatDays = draft.recurrence?.days || 3 }
  editor.value = { collection, draft, isNew: !item }; editorHidden.value = false; discardRequested.value = false; editorError.value = ''; pendingPhotos.value = []; editorSnapshot = JSON.stringify(draft)
  nextTick(() => editorDialog.value?.showModal())
}
function isEditorDirty() { return !!editor.value && (editorSnapshot !== JSON.stringify(editor.value.draft) || pendingPhotos.value.length > 0) }
function clearPendingPhotos() { pendingPhotos.value.forEach(photo => URL.revokeObjectURL(photo.preview)); pendingPhotos.value = [] }
function finishEditor() { editorDialog.value?.close(); editor.value = null; editorHidden.value = false; discardRequested.value = false; clearPendingPhotos(); nextTick(() => opener?.focus?.()) }
function pauseEditor() { if (busy.value) return; editorDialog.value?.close(); editorHidden.value = true; nextTick(() => opener?.focus?.()) }
function resumeEditor() { editorHidden.value = false; nextTick(() => editorDialog.value?.showModal()) }
function closeEditor() { if (busy.value) return; if (isEditorDirty()) { discardRequested.value = true; nextTick(() => continueEditingButton.value?.focus()); return }; finishEditor() }
function selectPhotos(event) {
  editorError.value = ''; const files = [...(event.target.files || [])]; event.target.value = ''
  if (editor.value.draft.photos.length + pendingPhotos.value.length + files.length > 6) { editorError.value = '一条记录最多放 6 张照片。'; return }
  for (const file of files) { if (!file.type.startsWith('image/')) { editorError.value = '请选择图片文件。'; continue } if (file.size > 15 * 1024 * 1024) { editorError.value = '这张图片超过了 15 MB，请选一张小一些的。'; continue } pendingPhotos.value.push({ id: newLifeId('pending'), file, preview: URL.createObjectURL(file) }) }
}
function removePendingPhoto(id) { const photo = pendingPhotos.value.find(item => item.id === id); if (photo) URL.revokeObjectURL(photo.preview); pendingPhotos.value = pendingPhotos.value.filter(item => item.id !== id) }
function validateDraft(collection, draft) {
  const nameField = ({ moments: 'text', habits: 'name', todos: 'text', goals: 'name', dates: 'name', milestones: 'title', books: 'title' })[collection]
  draft[nameField] = String(draft[nameField] || '').trim(); if (!draft[nameField]) throw new Error('先写一点内容，再保存吧。')
  if (['moments', 'dates', 'milestones'].includes(collection) && !parseDayKey(draft.date)) throw new Error('请填一个有效日期。')
  if (collection === 'goals' && (!(Number(draft.target) > 0) || !Number.isFinite(Number(draft.target)) || !(Number(draft.current) >= 0) || !Number.isFinite(Number(draft.current)))) throw new Error('目标金额需大于 0，已准备金额不能为负数。')
  if (collection === 'todos') { if (draft.dueDate && !parseDayKey(draft.dueDate)) throw new Error('请填一个有效的计划日期。'); draft.recurrence = normalizeRecurrence({ type: draft.repeatType, weekday: draft.repeatWeekday, days: draft.repeatDays }); if (draft.repeatType !== 'none' && !draft.recurrence) throw new Error('请检查重复日期，间隔需为 1—365 天的整数。'); delete draft.repeatType; delete draft.repeatWeekday; delete draft.repeatDays }
  if (collection === 'habits') for (const stage of [1, 2, 3]) if (draft[`stage${stage}Reward`] && (!Number.isInteger(Number(draft[`stage${stage}Days`])) || Number(draft[`stage${stage}Days`]) < 1)) throw new Error('有奖励的阶段，请填写至少 1 天的整数。')
  if (collection === 'books') { if (draft.cover && !/^https?:\/\//i.test(draft.cover)) throw new Error('封面地址应以 https:// 或 http:// 开头。'); draft.bookId ||= draft.id }
  delete draft.daysLeft; delete draft.nextDateStr; delete draft.yearsPassed
  return draft
}
async function saveEditor() {
  if (busy.value) return; busy.value = 'editor'; editorError.value = ''
  try {
    const state = editor.value; validateDraft(state.collection, clone(state.draft))
    while (pendingPhotos.value.length) { if (!uploadPhotoFile) throw new Error('照片上传暂时不可用，文字和已选照片仍保留在这里。'); const pending = pendingPhotos.value[0]; const uploaded = await uploadPhotoFile(pending.file); state.draft.photos.push(uploaded); removePendingPhoto(pending.id) }
    const saved = validateDraft(state.collection, clone(state.draft)); saved.updatedAt = new Date().toISOString(); if (state.isNew) { saved.createdAt ||= saved.updatedAt; state.draft.createdAt = saved.createdAt }
    await commit(draft => {
      if (state.isNew) {
        const existing = draft[state.collection].find(item => String(item.id) === String(saved.id))
        // A failed request may later be saved from the global retry panel; reuse its ID.
        if (existing) Object.assign(existing, saved)
        else draft[state.collection].push(saved)
      } else Object.assign(find(draft, state.collection, saved.id), saved)
    }, '已经好好收下了')
    if (state.collection === 'moments') setCurrentMember(saved.author)
    finishEditor()
  } catch (error) { editorError.value = error.message || '没有保存成功，内容还在，请再试一次。' } finally { busy.value = '' }
}
async function deleteEditedItem() { if (busy.value) return; busy.value = 'editor'; editorError.value = ''; try { if (!trashItem) throw new Error('回收站暂时不可用，请稍后再试。'); await trashItem(editor.value.collection, editor.value.draft.id); finishEditor() } catch (error) { editorError.value = error.message || '没有移除成功，请再试一次。' } finally { busy.value = '' } }
function openBook(book) { activeBook.value = book; nextTick(() => bookDialog.value?.showModal()) }
function closeBook() { bookDialog.value?.close(); activeBook.value = null }
function editActiveBook() { const book = activeBook.value; closeBook(); openEditor('books', book) }
function openPhoto(photo, title) { activePhoto.value = { photo, title }; nextTick(() => photoDialog.value?.showModal()) }
function closePhoto() { photoDialog.value?.close(); activePhoto.value = null }
function renderMarkdown(text = '') { return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').split('\n').map(line => { const formatted = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); if (/^#{1,3} /.test(line)) return `<h3>${formatted.replace(/^#{1,3} /, '')}</h3>`; if (line.startsWith('&gt; ')) return `<blockquote>${formatted.slice(5)}</blockquote>`; if (/^[-*] /.test(line)) return `<p class="note-list">• ${formatted.slice(2)}</p>`; return line ? `<p>${formatted}</p>` : '<br />' }).join('') }
onBeforeRouteLeave(() => {
  if (busy.value) { actionError.value = '正在保存，完成后再离开吧。'; return false }
  if (isEditorDirty()) { editorError.value = '还有没保存的内容。请先保存，或点取消放弃这次修改。'; resumeEditor(); return false }
  if (organizing.value && JSON.stringify(layoutDraft.value) !== JSON.stringify(layout.value)) { actionError.value = '布局还没保存。请先保存布局，或点取消。'; return false }
  if (editor.value) finishEditor()
  return true
})
onActivated(() => { clock.value = new Date(); if (editor.value && !editorHidden.value) resumeEditor() })
onDeactivated(() => { editorDialog.value?.close(); bookDialog.value?.close(); photoDialog.value?.close(); activeBook.value = null; activePhoto.value = null; if (editor.value) editorHidden.value = true })
onBeforeUnmount(() => { clearInterval(clockTimer); clearPendingPhotos() })
</script>
