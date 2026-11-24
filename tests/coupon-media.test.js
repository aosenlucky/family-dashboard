import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import media from '../api/coupon-media.js'
import edgeMedia from '../cloud-functions/api/coupon-media.js'
import { imageFromBody, readCouponImage, saveCouponImage, validateObjectKey } from '../api/_coupon-media.js'

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9p8AAAAASUVORK5CYII=', 'base64')
const upload = { filename:'coupon.png',contentType:'image/png',data:PNG.toString('base64') }
function env(t, values) { for (const [key,value] of Object.entries(values)) { const before=process.env[key]; value === undefined ? delete process.env[key] : process.env[key]=value; t.after(()=>{before===undefined?delete process.env[key]:process.env[key]=before}) } }
async function call(req) { let status=200,body;const headers={};await media({query:{},body:{},headers:{},...req},{setHeader(k,v){headers[k]=v},status(v){status=v;return this},json(v){body=v;return this},end(v){body=v}});return{status,body,headers} }

test('coupon media rejects unauthenticated/demo callers before any storage request', async t=>{
  env(t,{SYSTEM_PASSWORD:'family',DEMO_PASSWORD:'demo',PERSONAL_PREVIEW_DIR:undefined})
  t.mock.method(globalThis,'fetch',()=>{throw Error('must not access storage')})
  assert.equal((await call({method:'GET',query:{key:'../../secrets'}})).status,401)
  assert.equal((await call({method:'POST',headers:{authorization:'demo'},body:upload})).status,401)
})

test('private preview attachment upload/read is durable, authenticated and content-verified',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'coupon-media-'))
  t.after(()=>rm(directory,{recursive:true,force:true}))
  env(t,{SYSTEM_PASSWORD:'family',PERSONAL_PREVIEW_DIR:directory,NODE_ENV:'test'})
  t.mock.method(globalThis,'fetch',()=>{throw Error('preview cannot reach cloud')})
  const stored=await call({method:'POST',headers:{authorization:'family'},body:upload})
  assert.equal(stored.status,200)
  assert.match(stored.body.attachment.objectKey,/^coupon\/[a-f0-9]{64}\.png$/)
  const read=await call({method:'GET',headers:{authorization:'family'},query:{key:stored.body.attachment.objectKey}})
  assert.equal(read.status,200);assert.deepEqual(read.body,PNG)
  assert.equal(read.headers['Cache-Control'],'private, no-store, max-age=0')
  assert.equal(read.headers['Content-Type'],'image/png')
  const file=join(directory,'coupon-media',stored.body.attachment.objectKey.split('/')[1])
  assert.deepEqual(await readFile(file),PNG)
  const duplicate=await saveCouponImage(upload);assert.equal(duplicate.objectKey,stored.body.attachment.objectKey)
  await writeFile(file,Buffer.concat([PNG,Buffer.from('tampered')]))
  await assert.rejects(readCouponImage(duplicate.objectKey),e=>e.status===409)
})

test('media parser rejects URLs, traversal, disguised SVG, mismatched MIME and oversized input',()=>{
  for(const key of ['../records.json','coupon/../x.png','https://example.test/a.png','coupon/'+ 'a'.repeat(64)+'.svg','coupon/'+ 'A'.repeat(64)+'.png']) assert.throws(()=>validateObjectKey(key))
  assert.throws(()=>imageFromBody({...upload,data:'data:image/png;base64,'+upload.data}))
  assert.throws(()=>imageFromBody({...upload,data:Buffer.from('<svg onload="alert(1)"></svg>').toString('base64')}))
  assert.throws(()=>imageFromBody({...upload,contentType:'image/jpeg'}))
  assert.throws(()=>imageFromBody({...upload,data:'A'.repeat(9*1024*1024)}))
  assert.equal(imageFromBody({...upload,filename:'../../my\u0000image.png'}).attachment.filename,'....myimage.png')
})

test('maximum-size base64 is validated without recursive regex stack overflow',()=>{
  const bytes=Buffer.alloc(4*1024*1024)
  PNG.copy(bytes)
  const parsed=imageFromBody({...upload,data:bytes.toString('base64')})
  assert.equal(parsed.attachment.bytes,bytes.length)
})

test('production storage refuses a public bucket before uploading bytes',async t=>{
  env(t,{PERSONAL_PREVIEW_DIR:undefined,SUPABASE_URL:'https://unit-test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-service-key'})
  const calls=[]
  t.mock.method(globalThis,'fetch',async(url,options)=>{calls.push({url,options});return Response.json({public:true})})
  await assert.rejects(saveCouponImage(upload),e=>e.status===503&&e.message.includes('私有'))
  assert.equal(calls.length,1)
  assert.equal(calls[0].url,'https://unit-test.supabase.co/storage/v1/bucket/family-coupons')
})

test('production attachment reads are authenticated and errors do not expose upstream details',async t=>{
  env(t,{SYSTEM_PASSWORD:'family',PERSONAL_PREVIEW_DIR:undefined,SUPABASE_URL:'https://unit-test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'hidden-service-key'})
  const key=imageFromBody(upload).attachment.objectKey
  t.mock.method(globalThis,'fetch',async url=>url.includes('/bucket/')?Response.json({public:false}):new Response('hidden-service-key internal database error',{status:500}))
  const result=await call({method:'GET',headers:{authorization:'family'},query:{key}})
  assert.equal(result.status,503);assert.equal(JSON.stringify(result).includes('hidden-service-key'),false)
})

test('production cannot enable preview media storage accidentally',async t=>{
  env(t,{PERSONAL_PREVIEW_DIR:'some-preview',NODE_ENV:'production'})
  await assert.rejects(saveCouponImage(upload),e=>e.status===503)
})

test('EdgeOne wrapper preserves uploaded binary bytes and denies raw unauthenticated image URLs',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'coupon-edge-binary-'))
  t.after(()=>rm(directory,{recursive:true,force:true}))
  env(t,{SYSTEM_PASSWORD:'family',PERSONAL_PREVIEW_DIR:directory,NODE_ENV:'test'})
  const stored=await edgeMedia({request:new Request('https://family.example/api/coupon-media',{method:'POST',headers:{Authorization:'family','Content-Type':'application/json'},body:JSON.stringify(upload)})})
  const {attachment}=await stored.json()
  const url=`https://family.example/api/coupon-media?key=${encodeURIComponent(attachment.objectKey)}`
  const image=await edgeMedia({request:new Request(url,{headers:{Authorization:'family'}})})
  assert.equal(image.status,200);assert.deepEqual(Buffer.from(await image.arrayBuffer()),PNG)
  const anonymous=await edgeMedia({request:new Request(url)})
  assert.equal(anonymous.status,401)
})
