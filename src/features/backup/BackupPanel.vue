<script setup>
import { inject, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { createArchive, inspectArchive, relinkMedia, isCouponMediaRef } from './archive.js';
import { fetchCouponBackupMedia, uploadCouponBackupMedia } from './coupon-media.js';
import { uploadBackupFile } from '../gallery/upload.js';

const api=inject('familyApi'), wealthToken=inject('wealthToken'),revision=inject('familyRevision');
const reload=inject('reloadFamily'),unlock=inject('requestWealthUnlock'),notify=inject('showNotification',()=>{});
const canRestore=inject('canRestoreFamily',ref(true));
const emit=defineEmits(['busy-change','restored']);
const busy=ref(false),error=ref(''),progress=ref(''),fileInput=ref(null),selectedName=ref('');
const inspected=shallowRef(null),preview=ref(null),confirmed=ref(false),rollbackConfirm=ref(false);
const mapping=new Map(),lastPoint=ref(null);let generation=0;
try{lastPoint.value=JSON.parse(localStorage.getItem('family-last-restore-point')||'null');}catch{}
function requireUnlocked(){if(!wealthToken.value)throw Error('请先验证理财密码，再读取完整家庭备份。');}
function requireReady(){requireUnlocked();if(!canRestore.value)throw Error('请先处理页面上未保存的修改或版本冲突，再恢复备份。');}
function stillActive(id){if(id!==generation)throw Error('操作已停止，请重新打开备份。');requireUnlocked();}
function reset(){generation++;inspected.value=null;preview.value=null;confirmed.value=false;mapping.clear();busy.value=false;progress.value='';}
watch(wealthToken,value=>{if(!value){reset();selectedName.value='';}});
watch(busy,value=>emit('busy-change',value),{immediate:true});
onBeforeUnmount(()=>{generation++;mapping.clear();inspected.value=null;emit('busy-change',false);});
const dateText=value=>value?new Date(value).toLocaleString('zh-CN'):'未记录';
const sizeText=value=>value<1024*1024?(value/1024).toFixed(1)+' KB':(value/1024/1024).toFixed(1)+' MB';
function savePoint(result){if(!result.restorePointId)return;lastPoint.value={id:result.restorePointId,createdAt:new Date().toISOString()};try{localStorage.setItem('family-last-restore-point',JSON.stringify(lastPoint.value));}catch{}}
async function finishCommitted(result,job,isRollback=false){
  // The server has committed. Preserve the restore-point reference even if the
  // dialog was closed while the response was in flight; a failed refresh must
  // never be presented as a failed restore or invite a duplicate restore.
  savePoint(result);inspected.value=null;preview.value=null;confirmed.value=false;mapping.clear();rollbackConfirm.value=false;
  let refreshError='';try{await reload();}catch(e){refreshError=e.message;}
  if(job!==generation)return;
  emit('restored');progress.value=isRollback?'已回到选中的恢复点，本次操作前的版本也已保留。':'家庭记录与照片已恢复，恢复前的版本也已保留。';
  if(refreshError)error.value='恢复已经完成，但页面刷新失败：'+refreshError+'。请重新打开页面查看，勿重复恢复。';
  notify(isRollback?'已恢复上一个家庭版本':'备份已恢复，可以继续查看家庭空间。');
}
async function download(){
  if(busy.value)return;const job=++generation;busy.value=true;error.value='';progress.value='正在读取家庭记录';
  try{
    requireUnlocked();const backup=await api('/api/data-backup');stillActive(job);
    const result=await createArchive(backup,{origin:location.origin,privateFetcher:key=>{stillActive(job);return fetchCouponBackupMedia(key);},onProgress:state=>{stillActive(job);progress.value=state.message;}});stillActive(job);
    const blob=new Blob([result.bytes],{type:'application/zip'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=`家庭完整备份-${new Date().toISOString().slice(0,10)}.zip`;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
    progress.value=`已准备 ${result.manifest.assets.length} 个媒体文件及家庭记录的完整备份。`;notify('完整备份已开始下载，请保管好这份文件。');
  }catch(e){if(job===generation)error.value=e.message;}finally{if(job===generation)busy.value=false;}
}
async function inspect(event){
  const file=event.target.files?.[0];event.target.value='';if(!file || busy.value)return;
  reset();const job=++generation;selectedName.value=file.name;busy.value=true;error.value='';progress.value='正在校验备份中的记录与每一张照片';
  try{requireUnlocked();if(file.size>260*1024*1024)throw Error('备份文件超过 256 MB。');const result=await inspectArchive(await file.arrayBuffer());stillActive(job);inspected.value=result;await fetchPreview(job);progress.value='文件校验通过。请核对下面的内容，再决定是否恢复。';}
  catch(e){if(job===generation){error.value=e.message;inspected.value=null;}}finally{if(job===generation)busy.value=false;}
}
async function fetchPreview(job=generation){
  const result=await api('/api/data-backup',{method:'POST',body:JSON.stringify({action:'preview',backup:inspected.value.backup})});stillActive(job);preview.value=result;confirmed.value=false;
}
async function refreshPreview(){if(!inspected.value || busy.value)return;busy.value=true;error.value='';try{await fetchPreview();progress.value='已重新读取当前版本，请再次核对并确认。';}catch(e){error.value=e.message;}finally{busy.value=false;}}
async function restore(){
  if(busy.value || !inspected.value || !preview.value || !confirmed.value)return;
  const job=++generation;busy.value=true;error.value='';
  try{
    requireReady();
    const {manifest,files,backup}=inspected.value;
    for(let index=0;index<manifest.assets.length;index++){
      stillActive(job);const asset=manifest.assets[index];progress.value=`恢复照片 ${index+1} / ${manifest.assets.length}`;
      if(mapping.has(asset.sourceUrl))continue;
      const replacement=isCouponMediaRef(asset.sourceUrl)
        ? await uploadCouponBackupMedia(files[asset.path],asset.mime,api)
        : await uploadBackupFile(new File([files[asset.path]],asset.path.split('/').at(-1),{type:asset.mime}));
      stillActive(job);mapping.set(asset.sourceUrl,replacement);
    }
    stillActive(job);requireReady();progress.value='照片已准备好，正在保存恢复点并恢复家庭记录';
    const result=await api('/api/data-backup',{method:'POST',body:JSON.stringify({action:'restore',backup:relinkMedia(backup,mapping),revision:preview.value.revision,confirm:true})});
    await finishCommitted(result,job);
  }catch(e){if(job===generation){error.value=e.status===409?'另一台设备刚刚更新了家庭内容，尚未覆盖任何记录。请重新预览，再确认要恢复的版本。':e.message;if(e.status===409)confirmed.value=false;}}
  finally{if(job===generation)busy.value=false;}
}
async function rollback(){
  if(!lastPoint.value || !rollbackConfirm.value || busy.value)return;
  const job=++generation;busy.value=true;error.value='';progress.value='正在回到恢复前的版本';
  try{requireReady();const result=await api('/api/data-backup',{method:'POST',body:JSON.stringify({action:'rollback',restorePointId:lastPoint.value.id,revision:revision.value,confirm:true})});await finishCommitted(result,job,true);}
  catch(e){if(job===generation)error.value=e.message;}finally{if(job===generation)busy.value=false;}
}
</script>

<template>
  <section class="family-backup">
    <div class="backup-intro"><i class="ph ph-shield-check"></i><div><h3>给回忆留一份完整副本</h3><p>家庭记录、理财数据、照片原图与缩略图会一起下载。私人日记请到日记页单独导出。</p></div></div>
    <div v-if="!wealthToken" class="backup-locked"><p>完整备份包含家庭理财，需要再验证一次。</p><button class="family-primary" @click="unlock">验证后继续</button></div>
    <template v-else>
      <div class="backup-actions"><article><span>01 / 留存</span><h4>下载完整备份</h4><p>ZIP 内含真实照片及逐文件校验清单。这份文件含私人内容，请保存到你信任的位置。</p><button :disabled="busy" class="family-primary" @click="download"><i class="ph ph-download-simple"></i>下载家庭备份</button></article><article><span>02 / 找回</span><h4>从备份中恢复</h4><p>先校验文件，再查看内容。确认恢复时，系统会为当前版本保留一个恢复点。</p><input ref="fileInput" class="backup-file" type="file" accept=".zip,application/zip" @change="inspect"><button :disabled="busy" @click="fileInput.click()"><i class="ph ph-folder-open"></i>选择 ZIP 备份</button></article></div>
      <p class="backup-limit">单次打包最多 256 MB、单张照片 40 MB。任何照片无法下载时会停止，并说明原因；不会生成缺照片的“完整备份”。</p>
      <p v-if="progress" class="backup-progress" role="status"><i :class="busy?'ph ph-spinner':'ph ph-check-circle'"></i>{{ progress }}</p>
      <p v-if="error" class="backup-error" role="alert">{{ error }}</p>
      <article v-if="inspected && preview" class="backup-preview"><span>备份检查通过</span><h4>{{ selectedName }}</h4><p>备份时间：{{ dateText(preview.exportedAt) }}</p><dl><div><dt>相册照片</dt><dd>{{ preview.counts?.photos || 0 }} 张</dd></div><div><dt>那天小事</dt><dd>{{ preview.counts?.moments || 0 }} 条</dd></div><div><dt>待办记录</dt><dd>{{ preview.counts?.todos || 0 }} 条</dd></div><div><dt>券册记录</dt><dd>{{ preview.counts?.coupons || 0 }} 张</dd></div><div><dt>实际媒体文件</dt><dd>{{ inspected.manifest.assets.length }} 个 · {{ sizeText(inspected.bytes) }}</dd></div></dl><p>当前家庭版本 {{ preview.revision }}。恢复会替换共享记录与理财内容；私人日记保持独立。</p><label class="backup-confirm"><input v-model="confirmed" type="checkbox" :disabled="busy">我已核对，恢复这份备份，并保留当前版本的恢复点</label><div class="backup-preview-actions"><button :disabled="busy" @click="refreshPreview">重新预览当前版本</button><button :disabled="busy || !confirmed" class="family-primary" @click="restore">{{ busy?'处理中…':'确认恢复' }}</button></div></article>
      <article v-if="lastPoint" class="backup-rollback"><h4>上一次操作前的版本</h4><p>保存于 {{ dateText(lastPoint.createdAt) }}，可以找回当时的共享记录与照片引用。</p><label class="backup-confirm"><input v-model="rollbackConfirm" type="checkbox" :disabled="busy">将当前共享内容恢复到这个时间点</label><button :disabled="busy || !rollbackConfirm" @click="rollback">回到这个恢复点</button></article>
    </template>
  </section>
</template>

<style scoped>
.family-backup{color:#46513f;font-size:13px}.backup-intro{display:flex;gap:15px;padding:4px 0 22px}.backup-intro>i{font-size:29px;color:#879874;flex-shrink:0}.backup-intro h3{font-size:19px;font-weight:600;margin-bottom:8px}.backup-intro p,.backup-actions p,.backup-preview>p,.backup-rollback p{line-height:1.85;font-size:12px;color:#838c7c}.backup-actions{display:grid;grid-template-columns:1fr 1fr;gap:14px}.backup-actions article,.backup-preview,.backup-rollback{border:1px solid #e3e7dc;background:#ffffffa8;border-radius:14px;padding:20px}.backup-actions article>span,.backup-preview>span{font-size:10px;letter-spacing:.08em;color:#929b86}.backup-actions h4,.backup-preview h4,.backup-rollback h4{font-size:16px;font-weight:600;margin:10px 0}.backup-actions p{min-height:66px;margin:10px 0 18px}.family-backup button{border:1px solid #c7d0bd;border-radius:9px;padding:11px 15px;font-size:12px;color:#647358;display:inline-flex;align-items:center;gap:8px}.family-backup button:disabled{opacity:.45;cursor:not-allowed}.family-backup button:focus-visible{outline:3px solid #a5ad93;outline-offset:3px}.backup-limit{font-size:11px;line-height:1.85;color:#959b8f;margin:16px 0}.backup-file{display:none}.backup-progress{padding:12px;background:#eef3e8;border-radius:10px;font-size:12px;display:flex;gap:9px;align-items:center;margin-top:15px;line-height:1.7}.backup-error{font-size:12px;line-height:1.8;color:#a1533b;white-space:pre-wrap;overflow-wrap:anywhere;margin-top:15px;border:1px solid #e2cbbf;background:#fff6f0;border-radius:10px;padding:12px}.backup-preview,.backup-rollback{margin-top:20px}.backup-preview h4{overflow-wrap:anywhere}.backup-preview dl{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:18px 0;padding:16px;background:#f3f5ef;border-radius:10px}.backup-preview dt{font-size:11px;color:#939b87;margin-bottom:4px}.backup-preview dd{font-size:14px}.backup-confirm{display:flex!important;flex-direction:row!important;align-items:start;gap:10px;line-height:1.8;font-size:12px;margin:20px 0;color:#737e69}.backup-confirm input{width:16px!important;height:16px!important;min-width:16px;margin-top:3px;accent-color:#6b7c5c}.backup-preview-actions{display:flex;justify-content:flex-end;gap:12px;flex-wrap:wrap}.backup-locked{padding:20px;background:#f0f3eb;border-radius:13px}.backup-locked p{margin-bottom:15px}.backup-rollback{background:#f4f3ed}.backup-rollback h4{margin-top:0}@media(max-width:560px){.backup-actions{grid-template-columns:1fr}.backup-actions p{min-height:0}.backup-intro h3{font-size:17px}.backup-actions article,.backup-preview,.backup-rollback{padding:16px}}
</style>
