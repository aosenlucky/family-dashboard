<template>
  <section class="panel module-panel" :aria-labelledby="`heading-${module.id}`">
    <div class="section-heading"><div><h2 :id="`heading-${module.id}`"><i class="ph" :class="module.icon" aria-hidden="true"></i> {{ module.title }}</h2><p class="muted">{{ module.description }}</p></div><button class="icon-button add-button" :aria-label="`添加${module.title}记录`" @click="$emit('edit', module.collection)"><i class="ph ph-plus" aria-hidden="true"></i></button></div>
    <template v-if="module.id === 'habits'">
      <div v-for="habit in items" :key="habit.id" class="item-card"><div class="item-heading"><div><h3>{{ habit.name }}</h3><p class="muted">累计照顾了 {{ habit.growthValue || 0 }} 天</p></div><button class="icon-button" :aria-label="`编辑习惯：${habit.name}`" @click="$emit('edit', 'habits', habit)"><i class="ph ph-pencil-simple" aria-hidden="true"></i></button></div><div class="habit-bottom"><div class="habit-reward"><span v-if="nextReward(habit)">下一份小奖励：{{ nextReward(habit).name }}<small>再积累 {{ Math.max(0, nextReward(habit).days - (habit.growthValue || 0)) }} 天</small></span><span v-else>不用连续，每一天都算数。</span></div><button class="secondary-button" :disabled="habit.lastWatered === today || busy" @click="$emit('water', habit)"><i class="ph" :class="habit.lastWatered === today ? 'ph-check' : 'ph-drop'" aria-hidden="true"></i>{{ habit.lastWatered === today ? '今天已照顾' : '浇点水' }}</button></div></div><p v-if="!items.length" class="empty-inline">种下一个想慢慢养成的小习惯。</p>
    </template>
    <template v-if="module.id === 'todos'">
      <form class="quick-todo" @submit.prevent="addQuickTodo"><label class="sr-only" for="quick-todo">添加一件待办</label><input id="quick-todo" v-model="quickText" placeholder="记一件要一起做的小事" maxlength="200" /><button class="primary-button" :disabled="busy || !quickText.trim()" aria-label="添加待办"><i class="ph ph-plus" aria-hidden="true"></i></button></form>
      <div v-for="todo in activeTodos" :key="todo.id" class="todo-row"><label class="todo-check"><input type="checkbox" :checked="todo.completed" :disabled="busy" :aria-label="`完成待办：${todo.text}`" @change="toggleFromInput($event, todo)" /></label><button class="todo-content" @click="$emit('edit', 'todos', todo)"><span>{{ todo.text }}</span><small>{{ todo.owner || '一起' }}<template v-if="todo.dueDate"> · {{ displayDate(todo.dueDate) }}</template><template v-if="todo.recurrence"> · {{ recurrenceLabel(todo.recurrence) }}</template></small></button><button class="icon-button" :aria-label="`编辑待办：${todo.text}`" @click="$emit('edit', 'todos', todo)"><i class="ph ph-pencil-simple" aria-hidden="true"></i></button></div>
      <p v-if="!activeTodos.length" class="empty-inline">今天没有待办，可以轻松一点。</p>
      <details v-if="completedTodos.length" class="completed-todos"><summary>已完成 {{ completedTodos.length }} 件</summary><div v-for="todo in completedTodos" :key="todo.id" class="todo-row"><label class="todo-check"><input type="checkbox" checked :disabled="busy" :aria-label="`重新打开待办：${todo.text}`" @change="toggleFromInput($event, todo)" /></label><button class="todo-content completed" @click="$emit('edit', 'todos', todo)"><span>{{ todo.text }}</span><small>{{ todo.owner || '一起' }}<template v-if="todo.nextOccurrenceId"> · 已安排下一次</template></small></button><button class="icon-button" :aria-label="`编辑待办：${todo.text}`" @click="$emit('edit', 'todos', todo)"><i class="ph ph-pencil-simple" aria-hidden="true"></i></button></div></details>
    </template>
    <template v-if="module.id === 'goals'"><button v-for="goal in items" :key="goal.id" class="item-card goal-card" @click="$emit('edit', 'goals', goal)"><span class="item-heading"><span><strong>{{ goal.name }}</strong><small class="muted">目标 {{ money(goal.target) }}</small></span><i class="ph ph-pencil-simple" aria-hidden="true"></i></span><span class="goal-numbers"><strong>{{ money(goal.current) }}</strong><small>{{ goalPercent(goal) }}%</small></span><span class="progress-track" role="progressbar" :aria-valuenow="goalPercent(goal)" aria-valuemin="0" aria-valuemax="100" :aria-label="goal.name"><span :style="{ width: `${goalPercent(goal)}%` }"></span></span></button><p v-if="!items.length" class="empty-inline">一起期待的事，从一个小目标开始。</p></template>
    <template v-if="module.id === 'dates'"><button v-for="date in upcomingDates" :key="date.id" class="date-card" @click="date.sourceType === 'coupon' ? router.push({ path: '/life/coupons', query: { coupon: date.couponId } }) : $emit('edit', 'dates', date)"><span class="date-icon"><i class="ph" :class="date.sourceType === 'coupon' ? 'ph-ticket' : date.type === 'birthday' ? 'ph-cake' : 'ph-heart'" aria-hidden="true"></i></span><span class="date-copy"><strong>{{ date.name }}</strong><small>{{ date.nextDateStr }}<template v-if="date.sourceType === 'coupon'"> · 券册关联</template><template v-if="date.yearsPassed > 0"> · {{ date.yearsPassed }}{{ date.type === 'birthday' ? ' 岁' : ' 周年' }}</template></small></span><span class="date-count"><strong>{{ date.daysLeft === 0 ? '今天' : date.daysLeft === null ? '—' : Math.abs(date.daysLeft) }}</strong><small v-if="date.daysLeft">{{ date.daysLeft < 0 ? '天前' : '天后' }}</small></span></button><p v-if="!items.length" class="empty-inline">记下一个生日或纪念日。</p></template>
    <template v-if="module.id === 'milestones'"><article v-for="milestone in milestones" :key="milestone.id" class="milestone-card"><div class="item-heading"><span class="milestone-date">{{ displayDate(milestone.date) }}<small v-if="milestone.type"> · {{ milestone.type }}</small></span><button class="icon-button" :aria-label="`编辑宝宝记录：${milestone.title}`" @click="$emit('edit', 'milestones', milestone)"><i class="ph ph-pencil-simple" aria-hidden="true"></i></button></div><h3>{{ milestone.title }}</h3><p v-if="milestone.desc" class="milestone-description">{{ milestone.desc }}</p><div v-if="normalizedPhotos(milestone).length" class="milestone-photos"><button v-for="(photo, index) in normalizedPhotos(milestone)" :key="photo.id || photo.url" @click="$emit('photo', photo, milestone.title)"><img :src="photo.thumbnailUrl || photo.url" :alt="`${milestone.title}，照片 ${index + 1}`" loading="lazy" /></button></div></article><p v-if="!items.length" class="empty-inline">第一张照片、第一次小小的变化，都放在这里。</p></template>
    <template v-if="module.id === 'reading'"><div class="books-grid"><article v-for="book in items" :key="book.id" class="book-card"><button class="book-open" @click="$emit('book', book)"><img :src="getBookCoverSrc(book)" :alt="`《${book.title}》封面`" loading="lazy" @error="useGeneratedBookCover($event, book)" /><span><strong>{{ book.title }}</strong><small>{{ book.author || '作者待补充' }}</small><small class="book-note-status">{{ bookNote(book) ? '翻开读书笔记' : '留下一点读后感' }}</small></span></button><button class="icon-button" :aria-label="`编辑图书：${book.title}`" @click="$emit('edit', 'books', book)"><i class="ph ph-pencil-simple" aria-hidden="true"></i></button></article></div><p v-if="!items.length" class="empty-inline">最近读到了哪本喜欢的书？</p></template>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
const router = useRouter()
import { getBookCoverSrc, useGeneratedBookCover } from '../../utils/bookCovers'
import { bookNote, nextAnniversary, normalizedPhotos, parseDayKey } from './model.js'
import { beginQuickTodoAttempt, reconcileQuickTodo } from './quickTodo.js'
const props = defineProps({ module: Object, items: { type: Array, default: () => [] }, busy: Boolean, today: String, saveQuickTodo: Function })
const emit = defineEmits(['edit', 'water', 'toggle', 'book', 'photo', 'quick-saved'])
const quickText = ref(''), quickAttempt = ref(null)
const activeTodos = computed(() => props.items.filter(item => !item.completed).sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999')))
const completedTodos = computed(() => props.items.filter(item => item.completed).reverse())
const upcomingDates = computed(() => props.items.map(item => nextAnniversary(item, parseDayKey(props.today) || new Date())).sort((a, b) => (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity)))
const milestones = computed(() => [...props.items].sort((a, b) => (b.date || '').localeCompare(a.date || '')))
const displayDate = value => parseDayKey(value) ? `${value.slice(0, 4)}.${value.slice(5, 7)}.${value.slice(8, 10)}` : '日期待补充'
const money = value => `¥${Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`
const goalPercent = goal => Number(goal.target) > 0 ? Math.min(100, Math.max(0, Math.round(Number(goal.current || 0) / Number(goal.target) * 100))) : 0
const recurrenceLabel = recurrence => recurrence.type === 'weekly' ? `每周${['日', '一', '二', '三', '四', '五', '六'][Number(recurrence.weekday)] || ''}` : recurrence.type === 'after' ? `完成后 ${recurrence.days} 天` : ''
const nextReward = habit => [1, 2, 3].map(stage => ({ days: Number(habit[`stage${stage}Days`]), name: habit[`stage${stage}Reward`] })).filter(item => item.days > Number(habit.growthValue || 0) && item.name).sort((a, b) => a.days - b.days)[0]
function toggleFromInput(event, todo) { event.target.checked = !!todo.completed; emit('toggle', todo) }
function reconcileQuickSaved() {
  const reconciled = reconcileQuickTodo(quickAttempt.value, quickText.value, props.items)
  if (!reconciled.savedId) return
  quickAttempt.value = reconciled.attempt
  quickText.value = reconciled.input
  emit('quick-saved', reconciled.savedId)
}
watch(() => props.items, reconcileQuickSaved)
async function addQuickTodo() {
  reconcileQuickSaved()
  const text = quickText.value.trim()
  if (!text) return
  quickAttempt.value = beginQuickTodoAttempt(quickAttempt.value, text)
  await props.saveQuickTodo(quickAttempt.value)
  reconcileQuickSaved()
}
</script>
