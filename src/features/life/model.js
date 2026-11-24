export const LIFE_MODULES = Object.freeze([
  { id: 'habits', collection: 'habits', title: '习惯花园', icon: 'ph-plant', description: '慢慢来，每一点都算数。' },
  { id: 'todos', collection: 'todos', title: '待办协作', icon: 'ph-check-square-offset', description: '一起分担，给日子留一点从容。' },
  { id: 'goals', collection: 'goals', title: '梦想金库', icon: 'ph-sparkle', description: '为心里的小期待，慢慢准备。' },
  { id: 'dates', collection: 'dates', title: '温馨日历', icon: 'ph-calendar-heart', description: '值得记住的日子，放在这里。' },
  { id: 'coupons', collection: 'coupons', title: '我们的券册', icon: 'ph-ticket', description: '把期待收好，把日子安排好。' },
  { id: 'milestones', collection: 'milestones', title: '宝宝时光', icon: 'ph-baby', description: '收好每一次新的发现。' },
  { id: 'reading', collection: 'books', title: '我们的书架', icon: 'ph-books', description: '读过的故事，也成为我们的故事。' },
])

export function newLifeId(prefix = 'life') {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
}

export function stableLifeId(collection, item, index) {
  if (item.id !== undefined && item.id !== null && item.id !== '') return item.id
  if (collection === 'books' && item.bookId) return `book-${item.bookId}`
  const seed = `${collection}|${index}|${item.name || item.title || item.text || ''}|${item.date || ''}`
  let hash = 2166136261
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return `legacy-${collection}-${(hash >>> 0).toString(36)}`
}

// Assign IDs in memory before editing. Existing fields and collection order are preserved.
export function ensureLifeIds(data) {
  for (const collection of ['moments', ...LIFE_MODULES.map(module => module.collection)]) {
    if (!Array.isArray(data[collection])) data[collection] = []
    const used = new Set()
    data[collection].forEach((item, index) => {
      let id = stableLifeId(collection, item, index)
      if (used.has(String(id))) id = `${id}-duplicate-${index}`
      item.id = id
      if (collection === 'todos' && !item.owner) item.owner = ['Aosen', '小悦'].includes(item.assignee) ? item.assignee : '一起'
      used.add(String(id))
    })
  }
  return data
}

export function normalizeLifeLayout(layout) {
  const supported = new Set(LIFE_MODULES.map(module => module.id))
  const seen = new Set()
  const result = []
  for (const item of Array.isArray(layout) ? layout : []) {
    const id = typeof item === 'string' ? item : item?.id
    if (!supported.has(id) || seen.has(id)) continue
    seen.add(id)
    result.push({ id, visible: typeof item === 'string' || item.visible !== false })
  }
  for (const module of LIFE_MODULES) {
    if (!seen.has(module.id)) result.push({ id: module.id, visible: true })
  }
  return result
}

export function localDayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function parseDayKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '')
  if (!match) return null
  const [, year, month, day] = match.map(Number)
  const date = new Date(year, month - 1, day, 12)
  return localDayKey(date) === value ? date : null
}

export function normalizeRecurrence(recurrence) {
  if (recurrence?.type === 'weekly') {
    const weekday = Number(recurrence.weekday)
    if (Number.isInteger(weekday) && weekday >= 0 && weekday <= 6) return { type: 'weekly', weekday }
  }
  if (recurrence?.type === 'after') {
    const days = Number(recurrence.days)
    if (Number.isInteger(days) && days >= 1 && days <= 365) return { type: 'after', days }
  }
  return null
}

export function nextTodoDate(todo, completedAt = new Date()) {
  const recurrence = normalizeRecurrence(todo.recurrence)
  if (!recurrence) return null
  const completed = completedAt instanceof Date ? completedAt : new Date(completedAt)
  if (Number.isNaN(completed.getTime())) return null
  const day = parseDayKey(localDayKey(completed))
  if (recurrence.type === 'after') {
    day.setDate(day.getDate() + recurrence.days)
  } else {
    // Completing early still advances beyond this occurrence; overdue tasks skip missed weeks.
    const due = parseDayKey(todo.dueDate)
    if (due && due > day) day.setTime(due.getTime())
    const difference = (recurrence.weekday - day.getDay() + 7) % 7 || 7
    day.setDate(day.getDate() + difference)
  }
  return localDayKey(day)
}

export function toggleTodoInDraft(data, id, completedAt = new Date(), idFactory = newLifeId) {
  ensureLifeIds(data)
  const todo = data.todos.find(item => String(item.id) === String(id))
  if (!todo) throw new Error('这条待办已被修改或移除，请刷新后再试。')
  if (todo.completed) {
    todo.completed = false
    // Keep nextOccurrenceId so reopening and completing cannot duplicate a recurring task.
    delete todo.completedAt
    return { todo, next: null }
  }
  todo.completed = true
  todo.completedAt = completedAt.toISOString()
  const dueDate = nextTodoDate(todo, completedAt)
  if (!dueDate || todo.nextOccurrenceId) return { todo, next: null }
  const next = {
    id: idFactory('todo'), text: todo.text, owner: todo.owner || '一起', completed: false,
    dueDate, recurrence: normalizeRecurrence(todo.recurrence),
    seriesId: todo.seriesId || todo.id, previousOccurrenceId: todo.id,
    createdAt: completedAt.toISOString(),
  }
  todo.nextOccurrenceId = next.id
  todo.seriesId ||= todo.id
  data.todos.push(next)
  return { todo, next }
}

export function nextAnniversary(item, now = new Date()) {
  const original = parseDayKey(item.date)
  if (!original) return { ...item, daysLeft: null, nextDateStr: '请补充日期' }
  const today = parseDayKey(localDayKey(now))
  const dayNumber = date => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000
  if (item.type === 'event') return { ...item, daysLeft: dayNumber(original) - dayNumber(today), nextDateStr: `${original.getMonth() + 1}月${original.getDate()}日`, yearsPassed: 0 }
  function occurrence(year) {
    const lastDay = new Date(year, original.getMonth() + 1, 0).getDate()
    return new Date(year, original.getMonth(), Math.min(original.getDate(), lastDay), 12)
  }
  let next = occurrence(Math.max(today.getFullYear(), original.getFullYear()))
  if (next < today) next = occurrence(today.getFullYear() + 1)
  // UTC day arithmetic avoids daylight-saving changes in the local timezone.
  return { ...item, daysLeft: dayNumber(next) - dayNumber(today), nextDateStr: `${next.getMonth() + 1}月${next.getDate()}日`, yearsPassed: next.getFullYear() - original.getFullYear() }
}

export const bookNote = book => book?.note ?? book?.aiNote ?? book?.markdownNote ?? ''

export function normalizedPhotos(item) {
  return (Array.isArray(item?.photos) ? item.photos : []).map(photo => typeof photo === 'string' ? { url: photo } : photo).filter(photo => photo?.url)
}
