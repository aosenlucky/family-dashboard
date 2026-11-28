import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFood, validateFoods, validateFoodTrash, normalizeCity, foodCities, filterFoods, dinnerCandidates, foodMapUrl, extractSourceUrl, safeFoodUrl } from '../src/features/food/model.js';
import { mergeMain } from '../api/_family-security.js';
import { validateBackup } from '../api/_data-store.js';
import { mergeChanges } from '../src/features/family/model.js';
const food = (id, changes = {}) => normalizeFood({ id, title: '一间面馆', city: '杭州', createdAt: '2026-11-20T00:00:00Z', ...changes });

test('city matching unifies 市/space/case without confusing same district or city substrings', () => {
  const records = [food('hz'), food('hz2', { city: '杭州市' }), food('other', { city: '杭州湾' }), food('sz', { city: '苏州' }), food('unknown', { city: '' })];
  assert.equal(normalizeCity(' 杭 州市 '), '杭州');
  assert.deepEqual(foodCities(records), ['杭州', '杭州湾', '苏州']);
  assert.deepEqual(filterFoods(records, { city: '杭州市' }).map(item => item.id), ['hz', 'hz2']);
  assert.equal(filterFoods(records, { city: '', status: 'all' }).length, 5);
});
test('dinner selection requires explicit city and excludes guides, dishes and already eaten places', () => {
  const records = [food('a'), food('b'), food('c'), food('d'), food('guide', { kind: 'guide' }), food('dish', { kind: 'dish' }), food('eaten', { status: 'eaten' }), food('other', { city: '上海' })];
  assert.deepEqual(dinnerCandidates(records, ''), []);
  assert.deepEqual(dinnerCandidates(records, '杭州').map(x => x.id), ['a', 'b', 'c']);
  assert.deepEqual(dinnerCandidates(records, '杭州', { offset: 3 }).map(x => x.id), ['d', 'a', 'b']);
  assert.equal(new Set(dinnerCandidates(records, '杭州', { limit: 20 }).map(x => x.id)).size, 4);
});
test('search finds original share text and dishes; source links retain access query parameters', () => {
  const records = [food('one', { sourceText: '适合带爸妈去', dishes: '笋干面', sourceUrl: 'https://www.xiaohongshu.com/explore/abc?xsec_token=a%2Bb&xsec_source=pc_share' })];
  assert.equal(filterFoods(records, { query: '爸妈' }).length, 1);
  assert.equal(filterFoods(records, { query: '笋干面' }).length, 1);
  assert.equal(extractSourceUrl('收藏 http://xhslink.com/a/abc?token=123，复制去看看'), 'http://xhslink.com/a/abc?token=123');
  assert.match(records[0].sourceUrl, /xsec_token=a%2Bb&xsec_source=pc_share/);
  for (const unsafe of ['javascript:alert(1)', 'data:text/html,test', 'https://user:password@example.com/', 'https://a.com/\npath']) assert.equal(safeFoodUrl(unsafe), '');
});
test('map lookup is keyword search for a specific place and never claims a precise POI', () => {
  assert.equal(foodMapUrl(food('guide', { kind: 'guide' })), '');
  const url = new URL(foodMapUrl(food('p', { title: '面馆（城东店）', address: '湖畔路 2 号' })));
  assert.equal(url.origin, 'https://uri.amap.com');
  assert.equal(url.searchParams.get('keyword'), '面馆（城东店） 湖畔路 2 号');
  assert.equal(url.searchParams.get('city'), '杭州');
});
test('sync and restore both reject malformed or unsafe food records including recycled attachments', () => {
  const valid = food('one');
  assert.doesNotThrow(() => validateFoods([valid]));
  assert.equal(mergeMain({ foodPlaces: [valid] }, {}, false).foodPlaces[0].title, valid.title);
  assert.equal(validateBackup({ version: 4, main: { foodPlaces: [valid] }, travel: {} }).foodPlaces, 1);
  for (const change of [{ sourceUrl: 'javascript:alert(1)' }, { visitedOn: '2026-02-30' }, { visitedOn: 0 }, { status: 'visited' }, { title: '' }, { author: '陌生人' }, { sourceText: 'x'.repeat(12001) }, { attachments: [{ objectKey: 'https://evil.example/pic' }] }]) {
    const invalid = { ...valid, ...change };
    assert.throws(() => mergeMain({ foodPlaces: [invalid] }, {}, false), error => error.status === 400);
    assert.throws(() => validateBackup({ version: 4, main: { trash: [{ collection: 'foodPlaces', item: invalid }] }, travel: {} }), error => error.status === 400);
    assert.throws(() => validateFoodTrash([{ collection: 'foodPlaces', item: invalid }]));
  }
  assert.throws(() => validateFoods([valid, valid]), /唯一编号/);
});
test('independent shared food edits merge but overlapping edits retain conflict review', () => {
  const original = food('one'), second = food('two');
  const base = { foodPlaces: [original] }, local = { foodPlaces: [{ ...original, reason: '想一起去' }] }, remote = { foodPlaces: [original, second] };
  assert.equal(mergeChanges(base, local, remote).record.foodPlaces.length, 2);
  remote.foodPlaces[0] = { ...original, title: '另一个名字' };
  assert.deepEqual(mergeChanges(base, local, remote).conflicts, ['foodPlaces']);
});
