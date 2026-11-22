import test from 'node:test';
import assert from 'node:assert/strict';
import {useFamily} from '../src/features/family/useFamily.js';
import {mergeChanges,sharedOnly,safeQuietTime} from '../src/features/family/model.js';
import {paymentSchedule,nextPayments} from '../src/features/family/payments.js';
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};};
test('failed save retains draft, blocks replacement and retries its original revision after reload',async(t)=>{
 globalThis.localStorage=storage();globalThis.sessionStorage=storage();
 let phase=0;const revisions=[];
 t.mock.method(globalThis,'fetch',async(path,options)=>{
  if(options.method==='POST'){const body=JSON.parse(options.body);revisions.push(body.revision);assert.equal(Object.hasOwn(body.record,'assets'),false);if(phase===0)throw Error('offline');return Response.json({error:'conflict',revision:2,record:{todos:[{id:'remote',text:'remote'}]}},{status:409});}
  return Response.json({revision:2,record:{todos:[{id:'remote',text:'remote'}]},wealthUnlocked:false});
 });
 const s=useFamily();s.apply({revision:1,record:{todos:[]},wealthUnlocked:false});
 await assert.rejects(s.commitFamily(d=>d.todos.push({id:'mine',text:'kept input'})),/offline/);
 await assert.rejects(s.commitFamily(d=>d.todos.push({id:'lost'})),/未保存/);
 assert.equal(s.pending.value.draft.todos[0].text,'kept input');
 await s.reloadFamily();phase=1;await assert.rejects(s.retryPending(),/conflict/);
 assert.deepEqual(revisions,[1,1]);assert.equal(s.conflict.value.draft.todos[0].text,'kept input');
});
test('locking clears visible and conflict finance; stale responses never replace newer records',()=>{
 globalThis.localStorage=storage();globalThis.sessionStorage=storage();const s=useFamily();s.wealthToken.value='synthetic';s.apply({revision:3,record:{assets:[{value:12345}],todos:[]},wealthUnlocked:true});
 s.conflict.value={base:{assets:[{value:1}]},draft:{assets:[{value:2}]},latest:{assets:[{value:3}]}};
 s.lockWealth();assert.deepEqual(s.familyData.value.assets,[]);assert.ok(!JSON.stringify(s.conflict.value).includes('assets'));
 s.apply({revision:4,record:{assets:[{value:999}],todos:[{id:'latest'}]},wealthUnlocked:true});assert.deepEqual(s.familyData.value.assets,[]);
 s.apply({revision:2,record:{todos:[{id:'old'}]},wealthUnlocked:false});assert.equal(s.familyData.value.todos[0].id,'latest');
});
test('three-way review preserves independent updates and requires choice for overlapping changes',()=>{
 const base={todos:[1],photos:[1]},draft={todos:[2],photos:[1]},latest={todos:[1],photos:[2]};
 assert.deepEqual(mergeChanges(base,draft,latest),{record:{todos:[2],photos:[2]},conflicts:[]});
 latest.todos=[3];assert.deepEqual(mergeChanges(base,draft,latest).conflicts,['todos']);assert.deepEqual(mergeChanges(base,draft,latest,{todos:'remote'}).record.todos,[3]);
 assert.deepEqual(sharedOnly({todos:[{sourceType:'loan-transfer',text:'bank amount'},{text:'flowers'}],trash:[{collection:'assets',item:{value:12}}],assets:[1],llmApiKey:'secret'}),{todos:[{text:'flowers'}],trash:[]});
});
test('payment schedule clips month-end dates, crosses years, excludes expired transfers and keeps manual check distinct',()=>{
 const data={loans:[{id:'a',day:31,monthly:100,bank:'sample'}],transfers:[{id:'b',day:1,amount:50,expire:'2026-12-31'},{id:'c',day:1,amount:60}]};
 assert.equal(paymentSchedule(data,'2028-02').find(p=>p.type==='还款计划').date,'2028-02-29');
 const week=nextPayments(data,new Date(2026,11,29));assert.ok(week.some(p=>p.date==='2027-01-01'));assert.ok(!week.some(p=>p.id.startsWith('transfer:b:')));assert.ok(week.every(p=>!p.checked));
 assert.equal(safeQuietTime(new Date('2026-11-22T15:00:00Z'),'22:00','08:00'),true);assert.equal(safeQuietTime(new Date('2026-11-22T05:00:00Z'),'22:00','08:00'),false);
});
test('independent records merge, same-record conflicts need an explicit choice without discarding other edits',()=>{
 const base={todos:[{id:'one',text:'old'}]},draft={todos:[{id:'one',text:'mine'},{id:'new-local',text:'added here'}]},latest={todos:[{id:'one',text:'theirs'},{id:'new-remote',text:'added there'}]};
 assert.deepEqual(mergeChanges(base,draft,latest).conflicts,['todos']);
 const resolved=mergeChanges(base,draft,latest,{todos:'local'});assert.equal(resolved.record.todos.length,3);assert.equal(resolved.record.todos.find(x=>x.id==='one').text,'mine');
 const independent=mergeChanges({photos:[]},{photos:[{id:'a',url:'a.jpg'}]},{photos:[{id:'b',url:'b.jpg'}]});assert.equal(independent.record.photos.length,2);assert.deepEqual(independent.conflicts,[]);
});
test('invalid success responses never clear a pending draft or replace shared data',async(t)=>{
 globalThis.localStorage=storage();globalThis.sessionStorage=storage();const s=useFamily();s.apply({record:{todos:[]},revision:1,wealthUnlocked:false});
 t.mock.method(globalThis,'fetch',async()=>new Response('<html>gateway page</html>',{status:200}));
 await assert.rejects(s.commitFamily(d=>d.todos.push({id:'pending',text:'still here'})),/有效数据/);
 assert.equal(s.pending.value.draft.todos[0].text,'still here');assert.deepEqual(s.familyData.value.todos,[]);assert.equal(s.familyRevision.value,1);
});
