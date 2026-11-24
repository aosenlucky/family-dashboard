import test from 'node:test'
import assert from 'node:assert/strict'
import { bookNote, ensureLifeIds, normalizeLifeLayout, nextTodoDate, toggleTodoInDraft, nextAnniversary, localDayKey, parseDayKey } from '../src/features/life/model.js'

test('layout preserves saved order and hidden modules without touching their records', () => {
  const data = { goals: [{ name: '海边旅行', target: 6000, current: 20 }], lifeLayout: [{ id: 'goals', visible: false }, { id: 'todos', visible: true }, { id: 'goals' }, { id: 'unknown' }] }
  const before = JSON.stringify(data.goals)
  const layout = normalizeLifeLayout(data.lifeLayout)
  assert.equal(layout.length, 7)
  assert.deepEqual(layout.slice(0, 2), [{ id: 'goals', visible: false }, { id: 'todos', visible: true }])
  layout.reverse()
  assert.equal(JSON.stringify(data.goals), before)
  assert.equal(data.lifeLayout[0].id, 'goals')
})

test('legacy IDs are stable, unique and preserve records and existing IDs', () => {
  const source = { goals: [{ name: '同一愿望' }, { name: '同一愿望' }], todos: [{ id: 17, text: '保留' }, { id: 17, text: '旧重复 id' }], books: [{ bookId: 'abc', aiNote: '旧笔记' }] }
  const first = ensureLifeIds(structuredClone(source))
  const again = ensureLifeIds(structuredClone(source))
  assert.deepEqual(first, again)
  assert.notEqual(first.goals[0].id, first.goals[1].id)
  assert.equal(first.todos[0].id, 17)
  assert.equal(first.todos[0].owner, '一起')
  assert.notEqual(first.todos[1].id, 17)
  assert.equal(first.books[0].aiNote, '旧笔记')
  assert.deepEqual(ensureLifeIds(first), again)
})

test('legacy todo assignments and all book notes remain editable without losing an intentional empty note', () => {
  const data = ensureLifeIds({ todos: [{ assignee: '小悦' }, { assignee: '共同' }] })
  assert.equal(data.todos[0].owner, '小悦')
  assert.equal(data.todos[1].owner, '一起')
  assert.equal(bookNote({ aiNote: '旧笔记' }), '旧笔记')
  assert.equal(bookNote({ markdownNote: '预览笔记' }), '预览笔记')
  assert.equal(bookNote({ note: '', aiNote: '旧笔记' }), '')
})

test('completion plus N days crosses month, leap day and year correctly', () => {
  const todo = { recurrence: { type: 'after', days: 3 } }
  assert.equal(nextTodoDate(todo, new Date(2026, 0, 30, 23)), '2026-02-02')
  assert.equal(nextTodoDate(todo, new Date(2028, 1, 27, 1)), '2028-03-01')
  assert.equal(nextTodoDate(todo, new Date(2026, 11, 30, 22)), '2027-01-02')
  assert.equal(nextTodoDate({ recurrence: { type: 'after', days: 0 } }), null)
})

test('fixed weekly recurrence remains on weekday and avoids duplicate same-day occurrences', () => {
  const weekly = { recurrence: { type: 'weekly', weekday: 1 }, dueDate: '2026-12-28' }
  assert.equal(nextTodoDate(weekly, new Date(2026, 11, 28, 9)), '2027-01-04')
  assert.equal(nextTodoDate(weekly, new Date(2026, 11, 31, 9)), '2027-01-04')
  assert.equal(nextTodoDate(weekly, new Date(2026, 11, 27, 9)), '2027-01-04')
  assert.equal(nextTodoDate(weekly, new Date(2027, 0, 14, 9)), '2027-01-18')
})

test('completion preserves old occurrence and creates exactly one next occurrence on repeated toggles', () => {
  const data = { todos: [{ id: 'task1', text: '给花浇水', owner: '小悦', recurrence: { type: 'after', days: 2 } }] }
  const done = new Date(2026, 10, 22, 8)
  toggleTodoInDraft(data, 'task1', done, () => 'task2')
  assert.equal(data.todos.length, 2)
  assert.equal(data.todos[0].completed, true)
  assert.equal(data.todos[1].owner, '小悦')
  assert.equal(data.todos[1].dueDate, '2026-11-24')
  toggleTodoInDraft(data, 'task1', done)
  toggleTodoInDraft(data, 'task1', done)
  assert.equal(data.todos.length, 2)
})

test('anniversaries treat today as zero and leap birthday as February 28 in ordinary years', () => {
  assert.equal(nextAnniversary({ date: '2020-11-22' }, new Date(2026, 10, 22, 23)).daysLeft, 0)
  const leap = nextAnniversary({ date: '2024-02-29' }, new Date(2027, 1, 27, 23))
  assert.equal(leap.daysLeft, 1)
  assert.equal(leap.nextDateStr, '2月28日')
  assert.equal(nextAnniversary({ date: 'bad' }).daysLeft, null)
  assert.equal(parseDayKey('2026-02-30'), null)
  assert.equal(localDayKey(new Date(2026, 0, 1, 0, 1)), '2026-01-01')
  assert.equal(nextAnniversary({ date: '2026-11-21', type: 'event' }, new Date(2026, 10, 22)).daysLeft, -1)
})
