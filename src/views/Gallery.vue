<script setup>
import { computed, inject, nextTick, onBeforeUnmount, ref } from 'vue';
import { drainQueue, groupPhotos, nextPhotoIndex, photoDate, photoKey, photoPlace, safePhotoUrl } from '../features/gallery/model.js';
import { persistPhotoItem } from '../features/gallery/upload.js';
import '../features/gallery/gallery.css';

const familyData = inject('familyData');
const commitFamily = inject('commitFamily');
const trashItem = inject('trashItem');
const notify = inject('showNotification', () => {});
const photos = computed(() => familyData.value.photos || []);
const filters = ref({type:'', place:'', month:''});
const groups = computed(() => groupPhotos(photos.value, filters.value));
const visiblePhotos = computed(() => groups.value.flatMap(group => group.photos));
const types = computed(() => [...new Set(photos.value.map(p => p.type || '日常记录'))]);
const places = computed(() => [...new Set(photos.value.map(p => photoPlace(p) || '未记录地点'))]);
const months = computed(() => [...new Set(photos.value.map(p => photoDate(p).slice(0,7) || 'unknown'))].sort().reverse());
const failures = ref({}), retries = ref({}), viewer = ref(null), viewerKey = ref('');
const activeIndex = computed(() => visiblePhotos.value.findIndex(p => photoKey(p) === viewerKey.value));
const activePhoto = computed(() => visiblePhotos.value[activeIndex.value]);
let previousScroll = 0, touchStart = 0;
const fullFailed = ref(false);
function retry(p) { delete failures.value[photoKey(p)]; retries.value[photoKey(p)] = (retries.value[photoKey(p)] || 0) + 1; }
async function openPhoto(photo) { viewerKey.value = photoKey(photo); fullFailed.value=false; previousScroll=window.scrollY; await nextTick(); viewer.value.showModal(); }
function closePhoto() { viewer.value?.close(); window.scrollTo({top:previousScroll, behavior:'instant'}); }
function navigate(direction) { viewerKey.value = photoKey(visiblePhotos.value[nextPhotoIndex(activeIndex.value,direction,visiblePhotos.value.length)]); fullFailed.value=false; }
function onViewerKeys(event) { if(event.target.closest('input,textarea,select'))return; if(event.key==='ArrowRight'){event.preventDefault();navigate(1);} if(event.key==='ArrowLeft'){event.preventDefault();navigate(-1);} }
const editor = ref(null), editing = ref(null), editBusy = ref(false), editError = ref('');
async function edit(photo) { editing.value={key:photoKey(photo),desc:photo.desc || '',date:photoDate(photo),type:photo.type || '日常记录',tempCity:photoPlace(photo)}; editError.value=''; await nextTick();editor.value.showModal(); }
async function saveEdit() {
  if(editBusy.value)return;
  editBusy.value=true;editError.value='';
  try {
    const {key,...values}=editing.value;
    await commitFamily(draft=>{const photo=draft.photos.find(p=>photoKey(p)===key);if(!photo)throw Error('这张照片已被移走，请刷新相册。');Object.assign(photo,values);delete photo.city;delete photo.location;},{label:'保存照片信息'});
    editor.value.close();notify('照片信息已保存');
  } catch(error){editError.value=error.message;} finally{editBusy.value=false;}
}
const removing=ref(false), removeError=ref('');
async function removePhoto(){
  if(!activePhoto.value || removing.value)return;
  removing.value=true;removeError.value='';
  try{await trashItem('photos',activePhoto.value.id || photoKey(activePhoto.value));closePhoto();}
  catch(error){removeError.value=error.message;}finally{removing.value=false;}
}
const uploader = ref(null), fileInput=ref(null), queue=ref([]), uploadBusy=ref(false);
const localToday=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const uploadDefaults=ref({date:localToday(),type:'日常记录',tempCity:''}),queueError=ref('');
const statusText={waiting:'等待上传',uploading:'上传照片',saving:'保存到相册',complete:'已完成',failed:'未完成'};
const completed=computed(()=>queue.value.filter(i=>i.status==='complete').length);
const failed=computed(()=>queue.value.filter(i=>i.status==='failed'));
function openUpload(){queueError.value='';uploader.value.showModal();}
function filesSelected(event){
  for(const file of event.target.files || [])queue.value.push({id:crypto.randomUUID(),file,name:file.name,status:'waiting',progress:0,error:'',desc:'',date:uploadDefaults.value.date,type:uploadDefaults.value.type,tempCity:uploadDefaults.value.tempCity,uploaded:null,duplicate:false});
  event.target.value='';
}
async function processItem(item){
  return persistPhotoItem(item,{existingPhotos:()=>photos.value,queue:queue.value,commit:commitFamily});
}
async function uploadItems(retryFailed=false){
  if(uploadBusy.value)return;
  const pending=queue.value.filter(i=>retryFailed?i.status==='failed':i.status==='waiting');
  if(!pending.length)return;
  uploadBusy.value=true;queueError.value='';
  await drainQueue(pending,processItem,2);
  uploadBusy.value=false;
  if(failed.value.length)queueError.value='有照片尚未完成。已经上传的照片重试时只会补存相册记录。';
  else notify(`已保存 ${completed.value} 张照片`);
}
function dismissUploader(event){if(uploadBusy.value){event?.preventDefault();queueError.value='请等当前照片完成；离开页面会中断剩余上传。';return;}uploader.value.close();}
function beforeLeave(event){if(uploadBusy.value){event.preventDefault();event.returnValue='';}}
window.addEventListener('beforeunload',beforeLeave);
onBeforeUnmount(()=>window.removeEventListener('beforeunload',beforeLeave));
</script>

<template>
  <main class="family-gallery">
    <header class="gallery-heading"><div><p class="gallery-eyebrow">OUR LITTLE COLLECTION</p><h1>把日子，留在照片里</h1><p class="gallery-subtitle">{{ photos.length ? `${photos.length} 张照片，都是一起走过的日常。` : '一张照片，一句当时的心情。' }}</p></div><button class="gallery-primary" @click="openUpload"><i class="ph ph-plus"></i>添加照片</button></header>
    <section class="gallery-filters" aria-label="筛选照片">
      <label>日期<select v-model="filters.month"><option value="">全部年月</option><option v-for="month in months" :key="month" :value="month">{{ month==='unknown'?'日期未记录':month.replace('-', ' 年 ')+' 月' }}</option></select></label>
      <label>分类<select v-model="filters.type"><option value="">全部分类</option><option v-for="type in types" :key="type">{{ type }}</option></select></label>
      <label>地点<select v-model="filters.place"><option value="">全部地点</option><option v-for="place in places" :key="place">{{ place }}</option></select></label>
      <button v-if="filters.type || filters.place || filters.month" class="gallery-text-button" @click="filters={type:'',place:'',month:''}">清除筛选</button><span class="gallery-filter-count">{{ visiblePhotos.length }} 张照片</span>
    </section>
    <section v-if="!groups.length" class="gallery-empty"><i class="ph ph-images"></i><h2>{{ photos.length?'没有符合筛选的照片':'我们的相册，从这一张开始' }}</h2><p>{{ photos.length?'试着换个日期、分类或地点。':'周末的散步、餐桌上的花，平凡的日子也值得留下。' }}</p><button class="gallery-primary" @click="photos.length?filters={type:'',place:'',month:''}:openUpload()">{{ photos.length?'查看全部照片':'添加第一张照片' }}</button></section>
    <section v-for="group in groups" :key="group.key" class="gallery-month">
      <header><h2>{{ group.title }}</h2><span>{{ group.photos.length }} 张</span><p v-if="group.key==='unknown'">旧照片也保留在这里，可以随时补上日期。</p></header>
      <div class="gallery-grid"><article v-for="photo in group.photos" :key="photoKey(photo)" class="gallery-card">
        <button class="gallery-photo-button" :aria-label="`查看照片：${photo.desc || '未填写说明'}`" @click="openPhoto(photo)"><img v-if="!failures[photoKey(photo)]" :key="retries[photoKey(photo)] || 0" :src="safePhotoUrl(photo.thumbnailUrl || photo.url)" :alt="photo.desc || '家庭相册照片'" loading="lazy" decoding="async" @error="failures[photoKey(photo)]=true"><span v-else class="gallery-photo-failed"><i class="ph ph-image-broken"></i>照片暂时加载不了<span>说明和记录仍然保留</span></span></button>
        <div class="gallery-card-info"><p>{{ photo.desc || '还没有写说明，记得的细节可以慢慢补。' }}</p><div><span>{{ photoDate(photo) || '日期未记录' }}</span><span v-if="photoPlace(photo)">{{ photoPlace(photo) }}</span></div><footer><span>{{ photo.type || '日常记录' }}</span><button v-if="failures[photoKey(photo)]" @click="retry(photo)">重新加载</button><button @click="edit(photo)">{{ photoDate(photo)?'编辑':'补充日期' }}</button></footer></div>
      </article></div>
    </section>
    <dialog ref="viewer" class="gallery-viewer" aria-label="查看照片" @keydown="onViewerKeys" @close="removeError=''" @cancel="closePhoto">
      <template v-if="activePhoto"><header><span>{{ activeIndex+1 }} / {{ visiblePhotos.length }}</span><button autofocus aria-label="关闭照片" @click="closePhoto"><i class="ph ph-x"></i></button></header>
        <div class="gallery-viewer-stage" @touchstart.passive="touchStart=$event.changedTouches[0].clientX" @touchend.passive="Math.abs($event.changedTouches[0].clientX-touchStart)>60 && navigate($event.changedTouches[0].clientX<touchStart?1:-1)"><button v-if="visiblePhotos.length>1" class="gallery-prev" aria-label="上一张照片" @click="navigate(-1)"><i class="ph ph-caret-left"></i></button><img v-if="!fullFailed" :key="activePhoto.url" :src="safePhotoUrl(activePhoto.url)" :alt="activePhoto.desc || '家庭照片原图'" @error="fullFailed=true"><div v-else class="gallery-original-error"><i class="ph ph-image-broken"></i><p>原图暂时无法加载</p><button @click="fullFailed=false">重试加载</button></div><button v-if="visiblePhotos.length>1" class="gallery-next" aria-label="下一张照片" @click="navigate(1)"><i class="ph ph-caret-right"></i></button></div>
        <footer class="gallery-viewer-info"><div><p>{{ activePhoto.desc || '尚未填写照片说明' }}</p><small>{{ photoDate(activePhoto) || '日期未记录' }} · {{ photoPlace(activePhoto) || '地点未记录' }} · {{ activePhoto.type || '日常记录' }}</small></div><div class="gallery-viewer-actions"><button @click="edit(activePhoto)">编辑信息</button><a :href="safePhotoUrl(activePhoto.url)" target="_blank" rel="noopener noreferrer">查看原图</a><button :disabled="removing" @click="removePhoto">{{ removing?'正在移动…':'移入回收站' }}</button></div><p v-if="removeError" role="alert">{{ removeError }}</p></footer>
      </template>
    </dialog>
    <dialog ref="editor" class="gallery-form-dialog" aria-labelledby="photo-edit-title"><form v-if="editing" @submit.prevent="saveEdit"><header><h2 id="photo-edit-title">给照片添一点记忆</h2><button type="button" aria-label="关闭编辑" :disabled="editBusy" @click="editor.close()"><i class="ph ph-x"></i></button></header><label>照片说明<textarea v-model="editing.desc" rows="3" maxlength="1200" placeholder="这一天，有什么想记住的？" /></label><label>拍摄 / 记录日期<input v-model="editing.date" type="date"></label><label>分类<input v-model="editing.type" list="gallery-types" maxlength="40"></label><label>地点<input v-model="editing.tempCity" maxlength="80" placeholder="如：家里、上海、海边"></label><p v-if="editError" class="gallery-error" role="alert">{{ editError }}</p><button class="gallery-primary" :disabled="editBusy">{{ editBusy?'正在保存…':'保存照片信息' }}</button></form></dialog>
    <datalist id="gallery-types"><option v-for="type in types" :key="type" :value="type"/><option value="日常记录"/><option value="旅行风景"/><option value="成长记录"/></datalist>
    <dialog ref="uploader" class="gallery-upload-dialog" aria-labelledby="photo-upload-title" @cancel="dismissUploader">
      <header><div><h2 id="photo-upload-title">添加照片</h2><p>保留原图，为相册准备轻巧的预览。</p></div><button :disabled="uploadBusy" aria-label="关闭上传" @click="dismissUploader"><i class="ph ph-x"></i></button></header>
      <div class="gallery-upload-defaults"><label>默认日期<input v-model="uploadDefaults.date" type="date" :disabled="uploadBusy"></label><label>默认分类<input v-model="uploadDefaults.type" list="gallery-types" :disabled="uploadBusy"></label><label>默认地点<input v-model="uploadDefaults.tempCity" placeholder="可不填" :disabled="uploadBusy"></label></div>
      <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif" multiple class="gallery-hidden-input" @change="filesSelected"><button class="gallery-pick-files" :disabled="uploadBusy" @click="fileInput.click()"><i class="ph ph-upload-simple"></i>选择照片（可多选）<small>每张不超过 40 MB · 一次同时上传 2 张</small></button>
      <ul v-if="queue.length" class="gallery-upload-list"><li v-for="item in queue" :key="item.id" :class="'upload-'+item.status"><div class="gallery-upload-row"><strong>{{ item.name }}</strong><span>{{ statusText[item.status] }}{{ item.status==='uploading'?` ${item.progress}%`:'' }}</span><button v-if="item.status==='waiting' && !uploadBusy" aria-label="移除此待上传照片" @click="queue=queue.filter(q=>q.id!==item.id)"><i class="ph ph-x"></i></button></div><template v-if="item.status==='waiting'"><input v-model="item.desc" placeholder="这张照片的说明" maxlength="1200" :disabled="uploadBusy"><div class="gallery-upload-metadata"><input v-model="item.date" type="date" aria-label="照片日期" :disabled="uploadBusy"><input v-model="item.type" aria-label="照片分类" list="gallery-types" :disabled="uploadBusy"><input v-model="item.tempCity" placeholder="地点" aria-label="照片地点" :disabled="uploadBusy"></div></template><progress v-if="item.status==='uploading'" :value="item.progress" max="100"/><small v-if="item.duplicate">发现相同内容的照片，仍按本次的日期和说明独立保存。</small><small v-if="item.uploaded && item.status==='failed'">照片文件已上传，仅相册记录待保存。</small><p v-if="item.error" class="gallery-error">{{ item.error }}</p></li></ul>
      <p v-if="queueError" class="gallery-error" role="alert">{{ queueError }}</p><footer><span aria-live="polite">{{ completed }} / {{ queue.length }} 张已保存</span><button v-if="failed.length" :disabled="uploadBusy" @click="uploadItems(true)">仅重试未完成的 {{ failed.length }} 张</button><button class="gallery-primary" :disabled="uploadBusy || !queue.some(i=>i.status==='waiting')" @click="uploadItems()">{{ uploadBusy?'正在上传与保存…':'开始上传' }}</button></footer>
    </dialog>
  </main>
</template>
