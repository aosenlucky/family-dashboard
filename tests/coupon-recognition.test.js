import test from 'node:test'
import assert from 'node:assert/strict'
import { imageFromBody } from '../api/_coupon-media.js'
import { POSTER_HASH, previewRecognition, recognizeCoupons, sanitizeRecognition } from '../api/_coupon-recognition.js'
import handler from '../api/coupon-recognize.js'

const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9p8AAAAASUVORK5CYII=','base64')
const attachment=imageFromBody({contentType:'image/png',data:PNG.toString('base64')}).attachment
const request={attachmentKeys:[attachment.objectKey],allowExternal:true}
const extracted={draft:{title:'湖畔酒店',merchant:'湖畔酒店',location:'杭州',category:'hotel',summary:'双人入住两晚',status:'unused',expiresOn:'2027-01-31',advertisedPrice:'¥389',paidPrice:'',rules:'需提前预约'},evidence:{title:'湖畔酒店',merchant:'湖畔酒店',location:'杭州',summary:'双人入住两晚',status:'已付款，待使用',expiresOn:'有效期至2027-01-31',advertisedPrice:'¥389',rules:'需提前预约'},warnings:[]}
function env(t,values){for(const[k,v]of Object.entries(values)){const before=process.env[k];v===undefined?delete process.env[k]:process.env[k]=v;t.after(()=>{before===undefined?delete process.env[k]:process.env[k]=before})}}
function production(t,claim={action:'claimed'},upstream){
  env(t,{PERSONAL_PREVIEW_DIR:undefined,SUPABASE_URL:'https://unit-test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fake-service-key',DEEPSEEK_API_KEY:'fake-model-key',COUPON_MODEL:'deepseek-flash'})
  const calls=[]
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    calls.push({url,options})
    if(url.includes('/bucket/'))return Response.json({public:false})
    if(url.includes('/object/authenticated/'))return new Response(PNG,{'headers':{'Content-Type':'image/png'}})
    if(url.endsWith('/family_coupon_recognition_claim'))return Response.json(claim)
    if(url.endsWith('/family_coupon_recognition_finish'))return Response.json({saved:true})
    if(url==='https://api.deepseek.com/chat/completions')return upstream?upstream():Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(extracted)}}]})
    throw Error('unexpected target')
  });return calls
}
test('recognition only emits grounded schema fields and never confirms dates automatically',()=>{
  const result=sanitizeRecognition({...extracted,draft:{...extracted.draft,expiresOn:'2027-02-30',paidPrice:'389',bookingDeadline:'12月31日',secret:'do-not-keep',attachments:['remote-url']}})
  assert.equal(result.draft.expiresOn,'');assert.equal(result.draft.bookingDeadline,'');assert.equal(result.draft.paidPrice,'')
  assert.equal(result.draft.deadlineConfirmed,false);assert.equal(result.draft.secret,undefined);assert.equal(result.draft.attachments,undefined)
  assert.equal(result.draft.advertisedPrice,'389');assert.ok(result.warnings.length)
})
test('poster preview faithfully keeps truncated text, marketing price and missing expiry',()=>{
  const poster=previewRecognition([{hash:POSTER_HASH}])
  assert.equal(poster.source,'preview');assert.equal(poster.draft.expiresOn,'');assert.equal(poster.draft.status,'wish')
  assert.equal(poster.draft.advertisedPrice,'389');assert.equal(poster.draft.paidPrice,'');assert.match(poster.draft.summary,/双…/)
  const other=previewRecognition([{hash:'other'}]);assert.equal(other.draft.title,'');assert.match(other.warnings.join(''),/未调用外部识别/)
})
test('recognition requires explicit image processing consent and at most three keys',async t=>{
  t.mock.method(globalThis,'fetch',()=>{throw Error('must not call')})
  await assert.rejects(recognizeCoupons({...request,allowExternal:false}),e=>e.status===400)
  await assert.rejects(recognizeCoupons({...request,attachmentKeys:Array(4).fill(attachment.objectKey)}),e=>e.status===400)
  await assert.rejects(recognizeCoupons({...request,attachmentKeys:['https://evil.example/a.png']}),e=>e.status===400)
})
test('completed cache is returned without a model request; durable quota blocks new calls',async t=>{
  const calls=production(t,{action:'cached',result:extracted})
  const cached=await recognizeCoupons(request);assert.equal(cached.cached,true);assert.equal(cached.draft.title,'湖畔酒店')
  assert.equal(calls.some(call=>call.url.includes('api.deepseek.com')),false)
})
test('quota exhaustion and concurrent lease do not invoke model',async t=>{
  const calls=production(t,{action:'limited'})
  await assert.rejects(recognizeCoupons(request),e=>e.status===429)
  assert.equal(calls.some(call=>call.url.includes('api.deepseek.com')),false)
})
test('one model call is bounded, excludes URLs/tools and stores sanitized completion',async t=>{
  const calls=production(t)
  const result=await recognizeCoupons(request)
  assert.equal(result.draft.title,'湖畔酒店');assert.equal(result.draft.deadlineConfirmed,false)
  const modelCalls=calls.filter(call=>call.url.includes('api.deepseek.com'))
  assert.equal(modelCalls.length,1)
  const payload=JSON.parse(modelCalls[0].options.body)
  assert.equal(payload.model,'deepseek-flash');assert.equal(payload.max_tokens,2200);assert.equal(payload.tools,undefined)
  assert.match(payload.messages[1].content[1].image_url.url,/^data:image\/png;base64,/)
  const finish=JSON.parse(calls.find(call=>call.url.endsWith('_finish')).options.body)
  assert.equal(finish.p_success,true);assert.equal(finish.p_result.draft.deadlineConfirmed,false)
})
test('model errors release the durable claim without implicit retries or leaking secrets',async t=>{
  const calls=production(t,undefined,()=>new Response('fake-model-key upstream trace',{status:500}))
  await assert.rejects(recognizeCoupons(request),e=>e.status===502&&!e.message.includes('fake-model-key'))
  assert.equal(calls.filter(call=>call.url.includes('api.deepseek.com')).length,1)
  assert.equal(JSON.parse(calls.find(call=>call.url.endsWith('_finish')).options.body).p_success,false)
})
test('truncated or malformed model output cannot become a saved record',async t=>{
  production(t,undefined,()=>Response.json({choices:[{finish_reason:'length',message:{content:JSON.stringify(extracted)}}]}))
  await assert.rejects(recognizeCoupons(request),e=>e.status===502)
})
test('recognition endpoint rejects demo and unauthenticated requests',async t=>{
  env(t,{SYSTEM_PASSWORD:'family',DEMO_PASSWORD:'demo'})
  t.mock.method(globalThis,'fetch',()=>{throw Error('must not call')})
  for(const authorization of ['','demo']){let status;await handler({method:'POST',headers:{authorization},body:request},{setHeader(){},status(v){status=v;return this},json(){}});assert.equal(status,401)}
})
