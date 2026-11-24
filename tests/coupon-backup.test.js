import test from 'node:test';
import assert from 'node:assert/strict';
import { createArchive, inspectArchive, couponMediaRef, relinkMedia } from '../src/features/backup/archive.js';
import { fetchCouponBackupMedia } from '../src/features/backup/coupon-media.js';
import { runNodeHandler } from '../cloud-functions/_node-handler-adapter.js';
import { normalizeCoupon } from '../src/features/coupons/model.js';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
const key='coupon/'+ 'a'.repeat(64)+'.png';
const fixture=normalizeCoupon({id:'one',title:'一张券',attachments:[{id:'a'.repeat(64),objectKey:key,filename:'券图.png',contentType:'image/png',bytes:png.length}]});
const backup={version:4,main:{coupons:[fixture],trash:[{collection:'coupons',item:fixture}]},travel:{}};
test('private coupon images require explicit authenticated fetching and survive archive verification/relink', async () => {
  await assert.rejects(createArchive(backup,{origin:'https://home.example'}),/需要家庭授权/);
  const requested=[];
  const result=await createArchive(backup,{origin:'https://home.example',fetcher:()=>{throw Error('private file must not be fetched publicly');},privateFetcher:async value=>{requested.push(value);return new Response(png);}});
  assert.deepEqual(requested,[key]);
  const read=await inspectArchive(result.bytes);
  const newAttachment={objectKey:'coupon/'+ 'b'.repeat(64)+'.png',id:'new'};
  const linked=relinkMedia(read.backup,new Map([[couponMediaRef(key),newAttachment]]));
  assert.equal(linked.main.coupons[0].attachments[0].objectKey,newAttachment.objectKey);
  assert.equal(linked.main.trash[0].item.attachments[0].objectKey,newAttachment.objectKey);
});
test('private backup loader sends authorization only to fixed same-origin endpoint', async () => {
  const calls=[];
  await fetchCouponBackupMedia(key,{authorization:'test-only',fetcher:async(...args)=>{calls.push(args);return new Response(png);}});
  assert.ok(calls[0][0].startsWith('/api/coupon-media?key='));
  assert.equal(calls[0][1].redirect,'error');
  assert.throws(()=>fetchCouponBackupMedia('https://external.example/pic',{authorization:'test-only'}),/无效/);
});
test('malformed or missing coupon attachment metadata cannot silently disappear from a complete backup', async () => {
  for (const attachment of ['https://external.example/a.jpg', {objectKey:null}, {objectKey:key}]) {
    const malformed=structuredClone(backup);malformed.main.coupons[0].attachments=[attachment];
    await assert.rejects(createArchive(malformed,{origin:'https://home.example'}),/截图引用/);
  }
  const malformed=structuredClone(backup);malformed.main.trash[0].item.attachments=[{objectKey:null}];
  await assert.rejects(createArchive(malformed,{origin:'https://home.example'}),/截图引用/);
});
test('EdgeOne adapter preserves binary bytes including non-UTF8 image data', async () => {
  const response=await runNodeHandler((req,res)=>{res.setHeader('Content-Type','image/png');res.write(png.subarray(0,12));res.end(png.subarray(12));},new Request('https://home.example/api/coupon-media'));
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),png);
  assert.equal(response.headers.get('content-type'),'image/png');
});
