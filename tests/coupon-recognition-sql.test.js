import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

let PGlite
try { ({PGlite}=await import('../.local/sql-validation/node_modules/@electric-sql/pglite/dist/index.js')) } catch { /* Optional, isolated PostgreSQL engine already used by the project. */ }

test('coupon migration keeps private storage private and atomically enforces recognition claims/limits', {skip:!PGlite}, async()=>{
  const db=new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id text primary key,bucket_id text);
      alter table storage.objects enable row level security;
      grant usage on schema storage to anon,authenticated,service_role;
      grant select on storage.objects to anon,authenticated;
      create policy old_photo_policy on storage.objects for select to anon,authenticated using(true);
      insert into storage.objects values ('private-ticket','family-coupons'),('normal-photo','photos');`)
    const sql=await readFile(new URL('../supabase/coupon-media.sql',import.meta.url),'utf8')
    await db.exec(sql)
    await db.exec(sql) // Safe repeat installation, no data deletion.
    assert.equal((await db.query("select public from storage.buckets where id='family-coupons'")).rows[0].public,false)
    await db.exec('set role anon')
    assert.deepEqual((await db.query('select id from storage.objects')).rows,[{id:'normal-photo'}])
    await assert.rejects(db.query('select * from coupon_recognition_jobs'),/permission denied/)
    await assert.rejects(db.query("select family_coupon_recognition_claim($1,$2::uuid,1,3,5)",['a'.repeat(64),randomUUID()]),/permission denied/)
    await db.exec('reset role; set role service_role')
    const claim=async(key,id,count=1,daily=3,monthly=5)=>(await db.query('select family_coupon_recognition_claim($1,$2::uuid,$3::integer,$4::integer,$5::integer) as result',[key,id,count,daily,monthly])).rows[0].result
    const finish=async(key,id,result,success)=>(await db.query('select family_coupon_recognition_finish($1,$2::uuid,$3::jsonb,$4::boolean) as result',[key,id,result===null?null:JSON.stringify(result),success])).rows[0].result
    const firstId=randomUUID(),firstKey='a'.repeat(64)
    const competing=await Promise.all([claim(firstKey,firstId),claim(firstKey,randomUUID())])
    assert.equal(competing.filter(x=>x.action==='claimed').length,1)
    assert.equal(competing.filter(x=>x.action==='busy').length,1)
    assert.equal((await db.query('select image_count from coupon_recognition_usage')).rows.every(row=>row.image_count===1),true)
    assert.equal((await finish(firstKey,randomUUID(),{draft:{title:'wrong-owner'}},true)).saved,false)
    assert.equal((await finish(firstKey,firstId,{draft:{title:'hotel'},evidence:{title:'hotel'},warnings:[]},true)).saved,true)
    const cached=await claim(firstKey,randomUUID())
    assert.equal(cached.action,'cached');assert.equal(cached.result.draft.title,'hotel')
    assert.equal((await claim('b'.repeat(64),randomUUID(),3)).action,'limited')
    const secondId=randomUUID(),secondKey='b'.repeat(64)
    assert.equal((await claim(secondKey,secondId,2)).action,'claimed')
    assert.equal((await finish(secondKey,secondId,null,false)).saved,true)
    assert.equal((await claim('c'.repeat(64),randomUUID())).action,'limited')
    // A failed request still consumes quota, preventing an unlimited retry loop.
    assert.equal((await db.query('select image_count from coupon_recognition_usage')).rows.every(row=>row.image_count===3),true)
    await db.query("update coupon_recognition_usage set image_count=case when period like 'month:%' then 5 else 0 end")
    assert.equal((await claim('e'.repeat(64),randomUUID())).action,'limited')
    // Expired lease can be reclaimed once; a late worker cannot overwrite its replacement.
    await db.query("update coupon_recognition_usage set image_count=0")
    const staleId=randomUUID(),replacement=randomUUID(),thirdKey='d'.repeat(64)
    assert.equal((await claim(thirdKey,staleId)).action,'claimed')
    await db.query("update coupon_recognition_jobs set lease_until=now()-interval '1 minute' where cache_key=$1",[thirdKey])
    assert.equal((await claim(thirdKey,replacement)).action,'claimed')
    assert.equal((await finish(thirdKey,staleId,{draft:{}},true)).saved,false)
    assert.equal((await finish(thirdKey,replacement,{draft:{}},true)).saved,true)
    await assert.rejects(claim('not-a-hash',randomUUID()),/Invalid recognition claim/)
  } finally { await db.close() }
})
