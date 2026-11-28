import test from 'node:test';
import assert from 'node:assert/strict';
import { imageFromBody } from '../api/_coupon-media.js';
import { sanitizeFoodRecognition, previewFoodRecognition, recognizeFood } from '../api/_food-recognition.js';
import handler from '../api/food-recognize.js';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9p8AAAAASUVORK5CYII=', 'base64');
const attachment = imageFromBody({ contentType: 'image/png', data: PNG.toString('base64') }).attachment;
const extracted = { draft: { title: '山间面馆', kind: 'place', city: '杭州', dishes: '笋干面' }, evidence: { title: '山间面馆', kind: '山间面馆', city: '杭州', dishes: '笋干面' }, warnings: [] };
const request = { allowExternal: true, sourceText: '山间面馆，杭州，笋干面 https://xhslink.com/a/unit', attachmentKeys: [] };
function env(t, values) { for (const [key, value] of Object.entries(values)) { const before = process.env[key]; value === undefined ? delete process.env[key] : process.env[key] = value; t.after(() => { before === undefined ? delete process.env[key] : process.env[key] = before; }); } }
function production(t, claim = { action: 'claimed' }, upstream) {
  env(t, { PERSONAL_PREVIEW_DIR: undefined, SUPABASE_URL: 'https://unit-test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'fake-service-key', DEEPSEEK_API_KEY: 'fake-model-key', COUPON_MODEL: 'deepseek-flash', FOOD_MODEL: undefined });
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    if (url.includes('/bucket/')) return Response.json({ public: false });
    if (url.includes('/object/authenticated/')) return new Response(PNG, { headers: { 'Content-Type': 'image/png' } });
    if (url.endsWith('/family_coupon_recognition_claim')) return Response.json(claim);
    if (url.endsWith('/family_coupon_recognition_finish')) return Response.json({ saved: true });
    if (url === 'https://api.deepseek.com/chat/completions') return upstream ? upstream() : Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(extracted) } }] });
    throw Error('unexpected request: ' + url);
  });
  return calls;
}
test('recognition accepts only evidenced fields and never emits personal reason or visited status', () => {
  const result = sanitizeFoodRecognition({ ...extracted, draft: { ...extracted.draft, address: '猜的地址', reason: '博主说我喜欢', status: 'eaten', sourceUrl: 'https://evil.example' } });
  assert.equal(result.draft.address, '');
  assert.equal(result.draft.reason, undefined); assert.equal(result.draft.status, undefined); assert.equal(result.draft.sourceUrl, undefined);
  const fake = sanitizeFoodRecognition(extracted, { sourceText: 'https://xhslink.com/a/unit', hasImages: false });
  assert.equal(fake.draft.title, ''); assert.equal(fake.draft.city, ''); assert.equal(fake.draft.kind, 'guide');
});
test('multi-place guides do not merge addresses and dishes into a misleading single restaurant', () => {
  const result = sanitizeFoodRecognition({ draft: { title: '杭州三家面馆', kind: 'guide', address: '两家不同地址', dishes: '几家的招牌' }, evidence: { title: '杭州三家面馆', kind: '杭州三家面馆', address: '两家不同地址', dishes: '几家的招牌' } });
  assert.equal(result.draft.kind, 'guide'); assert.equal(result.draft.address, ''); assert.equal(result.draft.dishes, '');
});
test('a real text quote cannot ground an invented field value', () => {
  const sourceText = '店名：山间面馆，城市：杭州，推荐菜：笋干面、葱油面';
  const result = sanitizeFoodRecognition({
    draft: { title: '山间面馆', kind: 'place', city: '上海', address: '湖滨路 3 号', dishes: '笋干面，葱油面' },
    evidence: { title: '山间面馆', kind: '山间面馆', city: '城市：杭州', address: '山间面馆', dishes: '笋干面、葱油面' }
  }, { sourceText, hasImages: false });
  assert.equal(result.draft.city, ''); assert.equal(result.draft.address, '');
  assert.equal(result.draft.title, '山间面馆'); assert.equal(result.draft.dishes, '笋干面，葱油面');
});
test('preview faithfully parses explicit labels without claiming to OCR images or guess link contents', () => {
  const preview = previewFoodRecognition('店名：山间面馆\n城市：杭州\n推荐菜：笋干面', 1);
  assert.equal(preview.draft.title, '山间面馆'); assert.equal(preview.draft.city, '杭州'); assert.equal(preview.draft.kind, 'place');
  assert.match(preview.warnings.join(''), /不识别图片/); assert.equal(preview.source, 'preview');
  const unknown = previewFoodRecognition('https://xhslink.com/a/unit');
  assert.equal(unknown.draft.title, ''); assert.equal(unknown.draft.city, '');
});
test('consent, bounded text, image paths and meaningful content are checked before network calls', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw Error('must not call'); });
  for (const invalid of [null, { ...request, allowExternal: false }, { ...request, sourceText: 'x'.repeat(12001) }, { ...request, sourceText: 'https://xhslink.com/a/only-link' }, { ...request, attachmentKeys: ['https://evil.example/pic'] }, { ...request, attachmentKeys: Array(4).fill(attachment.objectKey) }]) {
    await assert.rejects(recognizeFood(invalid), error => error.status === 400);
  }
});
test('text-only request shares durable quota but never fetches pasted links and sends no tools', async t => {
  const calls = production(t);
  const result = await recognizeFood(request);
  assert.equal(result.draft.title, '山间面馆');
  const claim = JSON.parse(calls.find(call => call.url.endsWith('_claim')).options.body);
  assert.equal(claim.p_image_count, 1);
  const model = calls.filter(call => call.url.includes('api.deepseek.com'));
  assert.equal(model.length, 1); assert.equal(model[0].options.redirect, 'error');
  const payload = JSON.parse(model[0].options.body);
  assert.equal(payload.tools, undefined); assert.equal(payload.messages[1].content.length, 1);
  assert.equal(calls.some(call => call.url.includes('xhslink.com')), false);
});
test('image recognition uses private verified bytes and cache namespace distinct from text-only requests', async t => {
  const calls = production(t);
  await recognizeFood({ ...request, attachmentKeys: [attachment.objectKey] });
  const payload = JSON.parse(calls.find(call => call.url.includes('api.deepseek.com')).options.body);
  assert.match(payload.messages[1].content[1].image_url.url, /^data:image\/png;base64,/);
  assert.ok(calls.some(call => call.url.includes('/object/authenticated/')));
});
test('cached results skip model, limited quota never retries an upstream call', async t => {
  const calls = production(t, { action: 'cached', result: extracted });
  assert.equal((await recognizeFood(request)).cached, true);
  assert.equal(calls.some(call => call.url.includes('api.deepseek.com')), false);
});
test('cached values are rechecked against source text rather than trusting stored evidence blindly', async t => {
  const cached = { ...extracted, draft: { ...extracted.draft, city: '上海' } };
  const calls = production(t, { action: 'cached', result: cached });
  const result = await recognizeFood(request);
  assert.equal(result.cached, true); assert.equal(result.draft.city, '');
  assert.equal(result.draft.kind, 'place'); assert.equal(result.evidence.kind, '山间面馆');
  assert.equal(calls.some(call => call.url.includes('api.deepseek.com')), false);
});
test('shared quota exhaustion blocks model calls', async t => {
  const calls = production(t, { action: 'limited' });
  await assert.rejects(recognizeFood(request), error => error.status === 429);
  assert.equal(calls.some(call => call.url.includes('api.deepseek.com')), false);
});
test('failed model response releases claim without leaking upstream details or implicit retry', async t => {
  const calls = production(t, undefined, () => new Response('fake-model-key upstream secret', { status: 500 }));
  await assert.rejects(recognizeFood(request), error => error.status === 502 && !error.message.includes('fake-model-key'));
  assert.equal(calls.filter(call => call.url.includes('api.deepseek.com')).length, 1);
  assert.equal(JSON.parse(calls.find(call => call.url.endsWith('_finish')).options.body).p_success, false);
});
test('food recognition endpoint rejects unauthenticated and public demo requests', async t => {
  env(t, { SYSTEM_PASSWORD: 'family', DEMO_PASSWORD: 'demo' });
  t.mock.method(globalThis, 'fetch', () => { throw Error('must not call'); });
  for (const authorization of ['', 'demo']) {
    let status;
    await handler({ method: 'POST', headers: { authorization }, body: request }, { setHeader() {}, status(value) { status = value; return this; }, json() {} });
    assert.equal(status, 401);
  }
});
