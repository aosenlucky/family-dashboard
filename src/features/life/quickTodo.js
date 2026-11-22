import { newLifeId } from './model.js'

// Keep this ID until an authoritative family record contains it. A network error
// does not prove that the server failed to save the request.
export function beginQuickTodoAttempt(previous, text, idFactory = newLifeId) {
  return { id: previous?.id || idFactory('todo'), text: String(text).trim() }
}

export function insertQuickTodo(draft, attempt, now = new Date()) {
  draft.todos ||= []
  const existing = draft.todos.find(todo => String(todo.id) === String(attempt.id))
  if (existing) return existing
  const item = { id: attempt.id, text: attempt.text, completed: false, owner: '一起', createdAt: now.toISOString() }
  draft.todos.push(item)
  return item
}

export function reconcileQuickTodo(attempt, input, savedTodos) {
  if (!attempt) return { attempt, input, savedId: null }
  const saved = savedTodos.find(todo => String(todo.id) === String(attempt.id))
  if (!saved) return { attempt, input, savedId: null }
  return {
    attempt: null,
    // Preserve anything typed after the request, including a changed draft whose
    // earlier version was eventually committed through global conflict recovery.
    input: String(input).trim() === saved.text ? '' : input,
    savedId: attempt.id,
  }
}
