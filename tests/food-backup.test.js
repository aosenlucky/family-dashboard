import test from 'node:test';
import assert from 'node:assert/strict';
import { createArchive, inspectArchive, couponMediaRef, collectMedia, relinkMedia } from '../src/features/backup/archive.js';
import { normalizeFood } from '../src/features/food/model.js';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
const key = 'coupon/' + 'a'.repeat(64) + '.png';
const fixture = normalizeFood({ id: 'one', title: '河边面馆', sourceUrl: 'https://www.xiaohongshu.com/explore/test', sourceText: 'https://unsafe.example/should-never-be-fetched', attachments: [{ id: 'a'.repeat(64), objectKey: key, filename: '美食截图.png', contentType: 'image/png', bytes: png.length }] });

test('private food images in active and recycled records are backed up once without fetching source posts', async () => {
  const backup = { version: 4, main: { foodPlaces: [fixture], trash: [{ collection: 'foodPlaces', item: fixture }] }, travel: {} };
  assert.deepEqual(collectMedia(backup), [couponMediaRef(key)]);
  await assert.rejects(createArchive(backup, { origin: 'https://home.example' }), /需要家庭授权/);
  const calls = [];
  const archive = await createArchive(backup, { origin: 'https://home.example', fetcher: () => { throw Error('do not fetch public or source links'); }, privateFetcher: async objectKey => { calls.push(objectKey); return new Response(png); } });
  assert.deepEqual(calls, [key]);
  const read = await inspectArchive(archive.bytes);
  const replacement = { objectKey: 'coupon/' + 'b'.repeat(64) + '.png', id: 'b'.repeat(64) };
  const restored = relinkMedia(read.backup, new Map([[couponMediaRef(key), replacement]]));
  assert.equal(restored.main.foodPlaces[0].attachments[0].objectKey, replacement.objectKey);
  assert.equal(restored.main.trash[0].item.attachments[0].objectKey, replacement.objectKey);
  assert.equal(restored.main.foodPlaces[0].sourceUrl, fixture.sourceUrl);
});
test('malformed attachments in trash cannot be silently omitted from a complete archive', () => {
  const invalid = { ...fixture, attachments: [{ objectKey: key }] };
  assert.throws(() => collectMedia({ main: { trash: [{ collection: 'foodPlaces', item: invalid }] } }), /截图引用/);
});
