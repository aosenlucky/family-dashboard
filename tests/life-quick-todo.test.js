import test from 'node:test'
import assert from 'node:assert/strict'
import { beginQuickTodoAttempt, insertQuickTodo, reconcileQuickTodo } from '../src/features/life/quickTodo.js'

test('a failed quick save retains its ID and global recovery clears exactly the saved draft', () => {
  const text = '准备下周的水果'
  const attempt = beginQuickTodoAttempt(null, text, () => 'quick-1')
  assert.equal(reconcileQuickTodo(attempt, text, []).attempt.id, 'quick-1')
  const retry = beginQuickTodoAttempt(attempt, text, () => 'must-not-use')
  assert.equal(retry.id, attempt.id)
  const remote = { todos: [] }
  insertQuickTodo(remote, attempt)
  insertQuickTodo(remote, retry)
  assert.equal(remote.todos.length, 1)
  const reconciled = reconcileQuickTodo(attempt, text, remote.todos)
  assert.equal(reconciled.input, '')
  assert.equal(reconciled.savedId, 'quick-1')
  assert.equal(reconciled.attempt, null)
})

test('global recovery does not clear newer input or another task with identical text', () => {
  const attempt = beginQuickTodoAttempt(null, '准备水果', () => 'quick-1')
  assert.equal(reconcileQuickTodo(attempt, '准备水果', [{ id: 'unrelated', text: '准备水果' }]).savedId, null)
  const saved = [{ id: 'quick-1', text: '准备水果' }]
  const newer = reconcileQuickTodo(attempt, ' 顺便买花 ', saved)
  assert.equal(newer.input, ' 顺便买花 ')
  assert.equal(newer.attempt, null)
  assert.equal(newer.savedId, 'quick-1')
  const changedAttempt = beginQuickTodoAttempt(attempt, '顺便买花')
  assert.equal(reconcileQuickTodo(changedAttempt, '顺便买花', saved).input, '顺便买花')
})

test('a genuine new task can reuse the same text after previous success', () => {
  const first = beginQuickTodoAttempt(null, '准备水果', () => 'quick-1')
  const data = { todos: [] }
  insertQuickTodo(data, first)
  const completed = reconcileQuickTodo(first, '准备水果', data.todos)
  const next = beginQuickTodoAttempt(completed.attempt, '准备水果', () => 'quick-2')
  insertQuickTodo(data, next)
  assert.equal(data.todos.length, 2)
  assert.notEqual(data.todos[0].id, data.todos[1].id)
})
