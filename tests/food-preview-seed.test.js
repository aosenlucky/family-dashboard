import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { seedFoodPreview } from '../server/food-preview-seed.js'
import { previewTransaction } from '../server/preview-store.js'
import { normalizeFood, validateFoods, dinnerCandidates } from '../src/features/food/model.js'

test('food preview seed augments local records once and preserves later edits and deletions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'family-food-seed-'))
  const previousDirectory = process.env.PERSONAL_PREVIEW_DIR, previousMode = process.env.NODE_ENV
  process.env.PERSONAL_PREVIEW_DIR = directory
  process.env.NODE_ENV = 'test'
  try {
    const own = normalizeFood({ id: 'my-own-food', title: '自己收藏的店', city: '苏州' })
    await previewTransaction(state => { state.records.main = { value: { _familyRevision: 6, foodPlaces: [own], moments: [{ id: 'keep', text: '保留小事' }] } }; return null })
    await seedFoodPreview()
    const first = await previewTransaction(state => state.records.main.value, { write: false })
    validateFoods(first.foodPlaces)
    assert.equal(first._familyRevision, 7)
    assert.equal(first.foodPlaces.length, 13)
    assert.deepEqual(first.foodPlaces[0], own)
    assert.deepEqual(first.moments, [{ id: 'keep', text: '保留小事' }])
    assert.equal(dinnerCandidates(first.foodPlaces, '杭州', { limit: 20 }).length, 4)
    assert.notDeepEqual(dinnerCandidates(first.foodPlaces, '杭州'), dinnerCandidates(first.foodPlaces, '杭州', { offset: 3 }))
    await previewTransaction(state => { const main = state.records.main.value; main.foodPlaces = main.foodPlaces.filter(item => item.id !== 'food-preview-eaves'); main.foodPlaces.find(item => item.id === 'food-preview-steam').title = '我改过的店名'; return null })
    await seedFoodPreview()
    const second = await previewTransaction(state => state.records.main.value, { write: false })
    assert.equal(second._familyRevision, 7)
    assert.equal(second.foodPlaces.length, 12)
    assert.equal(second.foodPlaces.some(item => item.id === 'food-preview-eaves'), false)
    assert.equal(second.foodPlaces.find(item => item.id === 'food-preview-steam').title, '我改过的店名')
  } finally {
    if (previousDirectory === undefined) delete process.env.PERSONAL_PREVIEW_DIR; else process.env.PERSONAL_PREVIEW_DIR = previousDirectory
    if (previousMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousMode
    await rm(directory, { recursive: true, force: true })
  }
})
