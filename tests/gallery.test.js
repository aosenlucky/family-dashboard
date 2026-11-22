import test from 'node:test';
import assert from 'node:assert/strict';
import { groupPhotos, photoDate, nextPhotoIndex, drainQueue } from '../src/features/gallery/model.js';
import { persistPhotoItem } from '../src/features/gallery/upload.js';

test('gallery keeps undated and failed-source photos and groups newest months first',()=>{
  const photos=[{id:'old',url:'/missing.jpg'},{id:'uploaded',url:'/upload.jpg',uploadedAt:'2026-11-22T00:00:00Z'},{id:'summer',url:'/summer.jpg',date:'2026-06-03',type:'旅行',tempCity:'杭州'},{id:'autumn',url:'/autumn.jpg',date:'2026-10-01',type:'日常',tempCity:'杭州'}];
  const groups=groupPhotos(photos);
  assert.deepEqual(groups.map(g=>g.key),['2026-10','2026-06','unknown']);
  assert.equal(groups.at(-1).photos.length,2);
  assert.equal(groupPhotos(photos,{place:'杭州',type:'旅行'})[0].photos[0].id,'summer');
  assert.equal(photoDate({date:'2026-02-30'}),'');
  assert.equal(photoDate({date:'2024-02-29'}),'2024-02-29');
  assert.equal(nextPhotoIndex(0,-1,3),2);
  assert.equal(nextPhotoIndex(2,1,3),0);
});
test('upload queue caps concurrency at two and continues after individual failure',async()=>{
  let active=0,peak=0,processed=0;
  const items=Array.from({length:6},(_,id)=>({id,status:'waiting'}));
  await drainQueue(items,async item=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,5));active--;processed++;if(item.id===2)throw Error('offline');item.status='complete';},2);
  assert.equal(peak,2);assert.equal(processed,6);assert.equal(items[2].status,'failed');assert.equal(items[2].error,'offline');assert.equal(items.filter(i=>i.status==='complete').length,5);
});
test('metadata failure retains uploaded original and retries only saving; duplicates still create records',async()=>{
  const item={file:{name:'same.jpg',type:'image/jpeg',size:100},desc:' 一起散步 ',date:'2026-11-22',tempCity:' 公园 ',type:'日常',status:'waiting'};
  const record={photos:[{id:'existing',hash:'same',url:'/existing.jpg'}]};let uploads=0,saves=0;
  const dependencies={existingPhotos:()=>record.photos,queue:[item],hashFile:async()=> 'same',upload:async()=>{uploads++;return{id:'new',url:'/new.jpg',thumbnailUrl:'/thumb.jpg',hash:'same'};},commit:async mutate=>{saves++;if(saves===1)throw Error('record save failed');mutate(record);}};
  await drainQueue([item],row=>persistPhotoItem(row,dependencies));
  assert.equal(item.status,'failed');assert.equal(item.uploaded.url,'/new.jpg');assert.equal(record.photos.length,1);
  await drainQueue([item],row=>persistPhotoItem(row,dependencies));
  assert.equal(item.status,'complete');assert.equal(item.duplicate,true);assert.equal(uploads,1);assert.equal(saves,2);assert.equal(record.photos.length,2);assert.equal(record.photos[0].desc,'一起散步');
  await persistPhotoItem(item,dependencies);assert.equal(record.photos.length,2);assert.equal(uploads,1);
});
