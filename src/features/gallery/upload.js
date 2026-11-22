export const MAX_PHOTO_BYTES = 40 * 1024 * 1024;
export async function fingerprint(file) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function checkImage(file) {
  if (!file || !['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'].includes(file.type)) throw Error('请选择 JPG、PNG、WebP、GIF 或 HEIC 照片。');
  if (!file.size || file.size > MAX_PHOTO_BYTES) throw Error('单张照片需小于 40 MB。');
}
async function putImage(file, onProgress) {
  const filename = crypto.randomUUID() + '-' + (file.name || 'photo');
  const query = new URLSearchParams({filename,contentType:file.type || 'application/octet-stream',folder:'photos'});
  const response = await fetch('/api/get-upload-url?' + query, {headers:{Authorization:sessionStorage.getItem('family_auth_token') || ''}});
  const body = await response.json().catch(()=>({}));
  if (!response.ok) throw Error(body.error || '暂时无法准备上传，请稍后重试。');
  if (!body.uploadUrl || !body.finalUrl) throw Error('上传地址无效，请重新登录后重试。');
  const target = new URL(body.uploadUrl,location.origin);
  if (target.protocol !== 'https:' && target.origin !== location.origin) throw Error('上传地址不安全，已停止。');
  await new Promise((resolve,reject)=>{
    const xhr = new XMLHttpRequest();
    xhr.open('PUT',target.href);xhr.timeout=120000;
    xhr.setRequestHeader('Content-Type',file.type || 'application/octet-stream');
    xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress?.(Math.round(e.loaded/e.total*100));};
    xhr.onload=()=>xhr.status>=200&&xhr.status<300?resolve():reject(Error('照片上传失败，请重试此照片。'));
    xhr.onerror=()=>reject(Error('网络暂不可用，照片仍在上传列表中。'));
    xhr.ontimeout=()=>reject(Error('上传超时，请重试此照片。'));
    xhr.send(file);
  });
  return body.finalUrl;
}
async function thumbnail(file) {
  let bitmap;
  try {
    bitmap=await createImageBitmap(file);
    const scale=Math.min(1,720/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.8));
    return blob ? new File([blob],'preview.webp',{type:'image/webp'}) : null;
  } catch { return null; } finally { bitmap?.close?.(); }
}
// Uploads bytes only. The caller must separately persist the record and show
// success only after that commit succeeds. Never sends the family credential to OBS.
export async function uploadPhotoFile(file,{onProgress,knownHash}={}) {
  checkImage(file);
  const hash=knownHash || await fingerprint(file);
  const url=await putImage(file,onProgress);
  let thumbnailUrl=url, thumbnailPending=false;
  const small=await thumbnail(file);
  if(small){try{thumbnailUrl=await putImage(small);}catch{thumbnailPending=true;}}
  return {id:crypto.randomUUID(),url,thumbnailUrl,uploadedAt:new Date().toISOString(),hash,thumbnailPending,filename:file.name || '照片'};
}

// Backup restoration already carries both originals and thumbnails; do not
// create a second thumbnail or a new gallery record for each restored file.
export async function uploadBackupFile(file, {onProgress} = {}) {
  checkImage(file);
  return putImage(file, onProgress);
}

export async function persistPhotoItem(item, {existingPhotos, queue, commit, upload=uploadPhotoFile, hashFile=fingerprint}) {
  item.error='';
  if(!item.uploaded){
    checkImage(item.file);
    item.status='uploading';
    item.hash ||= await hashFile(item.file);
    item.duplicate=existingPhotos().some(p=>p.hash===item.hash) || queue.some(other=>other!==item && other.hash===item.hash);
    item.uploaded=await upload(item.file,{knownHash:item.hash,onProgress:p=>item.progress=p});
  }
  item.status='saving';
  await commit(draft=>{
    draft.photos ||= [];
    if(!draft.photos.some(p=>p.id===item.uploaded.id))draft.photos.unshift({...item.uploaded,desc:item.desc.trim(),date:item.date,type:item.type || '日常记录',tempCity:item.tempCity.trim()});
  },{label:'保存照片到相册'});
  item.status='complete';item.file=null;
}
