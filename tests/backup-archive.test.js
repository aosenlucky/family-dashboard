import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync,zipSync,strToU8,strFromU8 } from 'fflate';
import { allowedMediaUrl,collectMedia,createArchive,inspectArchive,relinkMedia,sanitizeBackup,sha256 } from '../src/features/backup/archive.js';
const png=new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64'));
const origin='http://localhost:5203';
const backup=()=>({version:4,revision:2,exportedAt:'2026-11-22T00:00:00Z',main:{photos:[{id:'a',url:'/media/original.png',thumbnailUrl:'/media/thumb.png'}],moments:[{photos:[{url:'/media/original.png'}]}],appearance:{coverUrl:'/media/cover.png'},books:[{cover:'/media/book.png'}],llmApiKey:'private',diaryEntries:[{photos:['https://private.example/diary.png']}],assets:[{value:2000}]},travel:{plan:{url:'https://map.example'}},mediaOrigins:['https://bucket.example']});
const fetcher=async()=>new Response(png,{headers:{'Content-Type':'image/png'}});
test('archive includes actual original/thumbnail/cover media, unique URL files, checksums, financial records but no private diary/secrets',async()=>{
  const requests=[];
  const result=await createArchive(backup(),{origin,fetcher:async(url,options)=>{requests.push({url,options});return fetcher();}});
  assert.equal(result.manifest.assets.length,4);
  assert.ok(requests.every(r=>r.options.credentials==='omit' && !r.options.headers && r.options.redirect==='error'));
  const read=await inspectArchive(result.bytes);
  assert.equal(read.backup.main.assets[0].value,2000);assert.equal(read.backup.main.llmApiKey,undefined);assert.equal(read.backup.main.diaryEntries,undefined);
  assert.deepEqual(read.files['media/00001.png'],png);
  const linked=relinkMedia(read.backup,new Map([['/media/original.png','https://new.example/new.png']]));
  assert.equal(linked.main.photos[0].url,'https://new.example/new.png');assert.equal(linked.main.moments[0].photos[0].url,'https://new.example/new.png');
  assert.equal(linked.main.photos[0].thumbnailUrl,'/media/thumb.png');
});
test('backup only permits configured origins, forbids embedded credentials and does not fetch private diary URLs',()=>{
  assert.equal(collectMedia(backup()).length,4);
  assert.equal(allowedMediaUrl('/media/a.png',{origin}),origin+'/media/a.png');
  assert.equal(allowedMediaUrl('https://bucket.example/a.png',{origin,mediaOrigins:['https://bucket.example']}),'https://bucket.example/a.png');
  assert.throws(()=>allowedMediaUrl('https://bucket.example.evil/a.png',{origin,mediaOrigins:['https://bucket.example']}),/未配置/);
  assert.throws(()=>allowedMediaUrl('https://user:pass@bucket.example/a.png',{origin,mediaOrigins:['https://bucket.example']}),/登录信息/);
  assert.throws(()=>allowedMediaUrl('http://127.0.0.1:8080/a.png',{origin}),/未配置/);
  assert.equal(sanitizeBackup({main:{diary:[],nested:{password:'no',keep:1}}}).main.nested.keep,1);
});
test('missing or CORS-blocked media prevents successful complete backup',async()=>{
  let call=0;
  await assert.rejects(createArchive(backup(),{origin,fetcher:async()=>{if(++call===2)throw Error('CORS');return fetcher();}}),/备份未完成.*thumb\.png[\s\S]*CORS/);
});
test('import rejects tampered media and records and zip traversal entries',async()=>{
  const complete=await createArchive(backup(),{origin,fetcher});
  const damaged=unzipSync(complete.bytes);damaged['media/00001.png'][20]^=1;
  await assert.rejects(inspectArchive(zipSync(damaged)),/媒体校验失败/);
  const changed=unzipSync(complete.bytes);changed['records.json']=strToU8(strFromU8(changed['records.json']).replace('2000','9000'));
  await assert.rejects(inspectArchive(zipSync(changed)),/家庭记录校验失败/);
  const traversal=unzipSync(complete.bytes);traversal['../payload.js']=strToU8('evil');
  await assert.rejects(inspectArchive(zipSync(traversal)),/非法文件路径/);
});
test('a self-consistent manifest still cannot silently omit a referenced photo',async()=>{
  const complete=await createArchive(backup(),{origin,fetcher}),files=unzipSync(complete.bytes);
  const manifest=JSON.parse(strFromU8(files['manifest.json']));
  delete files[manifest.assets.pop().path];files['manifest.json']=strToU8(JSON.stringify(manifest));
  await assert.rejects(inspectArchive(zipSync(files)),/所有引用照片/);
  assert.equal((await sha256(png)).length,64);
});
