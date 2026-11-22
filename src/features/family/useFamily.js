import { ref, computed } from 'vue';
import { blankFamily, clone, sharedOnly, mergeChanges } from './model.js';
import { ensureLifeIds } from '../life/model.js';
export function useFamily() {
  const familyData=ref(blankFamily()), familyRevision=ref(0), wealthToken=ref(''), wealthReady=ref(false), mode=ref('real');
  const status=ref('尚未读取'),busy=ref(false),error=ref(''),pending=ref(null),conflict=ref(null);
  const hasCachedDraft=ref(Boolean(sessionStorage.getItem('family-shared-pending')));
  let saved=blankFamily(), queue=Promise.resolve();
  const isMasked=computed(()=>!wealthToken.value||!wealthReady.value);
  async function familyApi(path,options={}) {
    const response=await fetch(path,{...options,headers:{'Content-Type':'application/json',Authorization:sessionStorage.getItem('family_auth_token')||'',...(wealthToken.value?{'X-Wealth-Token':wealthToken.value}:{}),...options.headers}});
    const result=await response.json().catch(()=>{throw new Error('服务未返回有效数据，尚未确认保存成功。');});
    if(!response.ok||result.success===false) throw Object.assign(new Error(result.error||result.message||'请求失败，请重试'),{status:response.status,payload:result});
    return result;
  }
  function normalize(record) {
    const data={...blankFamily(),...clone(record||{})};
    ensureLifeIds(data);
    data.photos=(data.photos||[]).map((p,i)=>({...p,id:p.id||`photo-${i}-${encodeURIComponent(p.url||'').slice(-80)}`}));
    return data;
  }
  function apply(payload) {
    if(!payload?.record||typeof payload.record!=='object'||Array.isArray(payload.record)||!Number.isSafeInteger(payload.revision)||payload.revision<0)throw Error('同步响应缺少有效版本，请刷新后再试。');
    if((payload.revision||0)<familyRevision.value)return;
    if(payload.wealthUnlocked&&!wealthToken.value)payload={...payload,record:sharedOnly(payload.record),wealthUnlocked:false};
    familyData.value=normalize(payload.record);saved=clone(familyData.value);
    wealthReady.value=!!payload.wealthUnlocked&&!!wealthToken.value;
    familyRevision.value=payload.revision||0;mode.value=payload.mode||'real';
    if(payload.wealthUnlocked===false) wealthToken.value='';
    status.value='已保存 · 版本 '+familyRevision.value;
  }
  async function reloadFamily() { busy.value=true; try {apply(await familyApi('/api/sync'));error.value='';} finally {busy.value=false;} }
  function retain(draft,base,label,revision) {
    pending.value={draft:clone(draft),base:clone(base),revision,label};
    hasCachedDraft.value=true;
    // Financial values and secrets never enter the browser's clear-text draft cache.
    try {sessionStorage.setItem('family-shared-pending',JSON.stringify({...pending.value,draft:sharedOnly(draft),base:sharedOnly(base)}));} catch {}
  }
  async function persist(draft,base,label='修改',expectedRevision=familyRevision.value) {
    if(mode.value==='demo') throw Error('公开演示为只读，请进入独立预览体验编辑。');
    busy.value=true;error.value='';status.value='正在保存…';
    retain(draft,base,label,expectedRevision);
    try {
      const payload=await familyApi('/api/sync',{method:'POST',body:JSON.stringify({record:wealthToken.value?draft:sharedOnly(draft),revision:expectedRevision})});
      apply(payload);pending.value=null;conflict.value=null;hasCachedDraft.value=false;sessionStorage.removeItem('family-shared-pending');
      return payload;
    } catch(e) {
      error.value=e.message;status.value=e.status===409?'有另一份更新，请核对':'未保存，输入已保留';
      if(e.status===409) conflict.value={...pending.value,latest:normalize(e.payload.record||e.payload.latest?.record||{}),revision:e.payload.revision??e.payload.latest?.revision};
      throw e;
    } finally {busy.value=false;}
  }
  function commitFamily(mutator,{label='修改',snapshot:initialSnapshot,revision:initialRevision}={}) {
    const task=queue.catch(()=>{}).then(async()=>{
      if(conflict.value) throw Error('请先处理上方的版本冲突，再继续保存。');
      if(wealthToken.value&&!wealthReady.value)throw Error('正在读取理财信息，请稍后再保存；输入仍保留在这里。');
      if(pending.value) throw Error('还有一份未保存的修改，请先点击上方“重试保存”，输入仍保留在编辑框中。');
      const base=clone(initialSnapshot||saved), draft=clone(initialSnapshot||familyData.value);await mutator(draft);
      return persist(draft,base,label,initialRevision??familyRevision.value);
    });queue=task;return task;
  }
  const saveConfig=()=>commitFamily(()=>{}, {label:'保存修改'});
  async function retryPending() {
    if(!pending.value)return;
    const p=pending.value;await persist(p.draft,p.base,p.label,p.revision);
  }
  async function restoreDraft() {
    const raw=JSON.parse(sessionStorage.getItem('family-shared-pending')||'null');
    if(!raw)return;
    conflict.value={...raw,latest:clone(saved),revision:familyRevision.value};pending.value=raw;
  }
  function discardPending() {
    if(conflict.value)apply({record:conflict.value.latest,revision:conflict.value.revision,wealthUnlocked:!!wealthToken.value,mode:mode.value});
    else familyData.value=clone(saved);
    pending.value=null;conflict.value=null;hasCachedDraft.value=false;error.value='';status.value='已放弃本次未保存修改';sessionStorage.removeItem('family-shared-pending');
  }
  async function resolveConflict(choices) {
    const c=conflict.value;if(!c)return;
    const latest=normalize(c.latest), merged=mergeChanges(c.base,c.draft,latest,choices);
    if(merged.conflicts.length)throw Error('请为每个冲突栏目选择要保留的版本。');
    familyRevision.value=c.revision;saved=clone(latest);
    await persist(merged.record,latest,c.label);
  }
  function lockWealth() {wealthToken.value='';wealthReady.value=false;familyData.value={...blankFamily(),...sharedOnly(familyData.value)};saved={...blankFamily(),...sharedOnly(saved)};if(pending.value){pending.value.draft=sharedOnly(pending.value.draft);pending.value.base=sharedOnly(pending.value.base);}if(conflict.value){for(const key of ['base','draft','latest'])conflict.value[key]=sharedOnly(conflict.value[key]);} }
  async function trashItem(collection,id) {
    await commitFamily(d=>{const index=(d[collection]||[]).findIndex(x=>x.id===id||x.url===id);if(index<0)throw Error('这条记录已不存在，请刷新。');const [item]=d[collection].splice(index,1);d.trash ||= [];d.trash.unshift({id:crypto.randomUUID(),collection,item,deletedAt:new Date().toISOString()});},{label:'移入回收站'});
    return familyData.value.trash[0]?.id;
  }
  async function restoreTrash(id) {await commitFamily(d=>{const i=(d.trash||[]).findIndex(x=>x.id===id);if(i<0)return;const entry=d.trash[i];d[entry.collection] ||= [];if(d[entry.collection].some(x=>x.id===entry.item.id))throw Error('原记录已存在，请先核对。');d[entry.collection].unshift(entry.item);d.trash.splice(i,1);},{label:'恢复记录'});}
  localStorage.removeItem('cashflow_family_v11');
  return {familyData,familyRevision,wealthToken,isMasked,mode,status,busy,error,pending,conflict,hasCachedDraft,familyApi,reloadFamily,apply,commitFamily,saveConfig,retryPending,restoreDraft,discardPending,resolveConflict,lockWealth,trashItem,restoreTrash};
}
