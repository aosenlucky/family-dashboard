import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

export const MAX_ARCHIVE_BYTES = 256 * 1024 * 1024;
export const MAX_MEDIA_BYTES = 40 * 1024 * 1024;
const MAX_FILES = 3000;
const mediaKeys = new Set(['thumbnailUrl','photoUrl','imageUrl','cover','coverUrl','backgroundUrl','avatarUrl']);
const mediaArrays = new Set(['photos','images']);
const privateKeys = /^(diar(y|ies|yEntries)|privateDiaries|llmApiKey|wealthPassword|password|accessToken|refreshToken|secretKey|secretId)$/i;
export async function sha256(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
}
export function sanitizeBackup(backup) {
  const clean = value => Array.isArray(value) ? value.map(clean) : value && typeof value==='object' ? Object.fromEntries(Object.entries(value).filter(([key])=>!privateKeys.test(key)).map(([key,v])=>[key,clean(v)])) : value;
  return clean(backup);
}
// Only media fields are collected: ordinary links, API endpoints, notes, and
// private diaries are not requested over the network.
export function collectMedia(backup) {
  const found = new Set();
  function visit(value, key='', ancestors=[], parent={}) {
    if(privateKeys.test(key))return;
    if(typeof value==='string') {
      const media = mediaKeys.has(key) || mediaArrays.has(key) || key==='url' && (ancestors.some(k=>mediaArrays.has(k)) || parent.thumbnailUrl || parent.filename || parent.desc!==undefined);
      if(media && /^([a-z][a-z\d+.-]*:|\/)/i.test(value))found.add(value);
    } else if(Array.isArray(value))value.forEach(item=>visit(item,key,ancestors,parent));
    else if(value && typeof value==='object')for(const [nextKey,v] of Object.entries(value))visit(v,nextKey,[...ancestors,key,...(value.collection==='photos'?['photos']:[])],value);
  }
  visit(backup.main,'main');visit(backup.travel,'travel');
  return [...found];
}
export function allowedMediaUrl(raw, {origin, mediaOrigins=[]}) {
  if(/^data:image\/(png|jpe?g|webp|gif|heic|heif);base64,/i.test(raw))return raw;
  const url=new URL(raw,origin);
  if(url.username || url.password)throw Error('照片地址含登录信息，无法安全下载。');
  const allowed=new Set([origin,...mediaOrigins.filter(v=>{try{return new URL(v).protocol==='https:';}catch{return false;}}).map(v=>new URL(v).origin)]);
  if(!allowed.has(url.origin) || !['https:','http:'].includes(url.protocol) || url.protocol==='http:' && url.origin!==origin)throw Error('照片来自未配置的媒体域名：'+url.hostname);
  return url.href;
}
function mediaType(bytes, reported='') {
  if(bytes[0]===0xff && bytes[1]===0xd8 && bytes[2]===0xff)return 'image/jpeg';
  if(bytes[0]===0x89 && strFromU8(bytes.slice(1,4))==='PNG')return 'image/png';
  if(strFromU8(bytes.slice(0,3))==='GIF')return 'image/gif';
  if(strFromU8(bytes.slice(0,4))==='RIFF' && strFromU8(bytes.slice(8,12))==='WEBP')return 'image/webp';
  if(strFromU8(bytes.slice(4,8))==='ftyp' && /^(heic|heix|hevc|hevx|mif1)/.test(strFromU8(bytes.slice(8,12))))return 'image/heic';
  throw Error('媒体内容不是支持的图片文件'+(reported?'（'+reported+'）':''));
}
const extensions={'image/jpeg':'jpg','image/png':'png','image/gif':'gif','image/webp':'webp','image/heic':'heic'};
async function readBounded(response) {
  if(Number(response.headers.get('content-length'))>MAX_MEDIA_BYTES)throw Error('单个媒体文件超过 40 MB');
  if(!response.body?.getReader){const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.byteLength>MAX_MEDIA_BYTES)throw Error('单个媒体文件超过 40 MB');return bytes;}
  const reader=response.body.getReader(),chunks=[];let total=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_MEDIA_BYTES)throw Error('单个媒体文件超过 40 MB');chunks.push(value);}}
  catch(error){await reader.cancel().catch(()=>{});throw error;}
  const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;
}
export async function createArchive(backup, {origin, fetcher=fetch, onProgress=()=>{}}={}) {
  const clean=sanitizeBackup(backup), urls=collectMedia(clean);
  if(urls.length+2>MAX_FILES)throw Error('照片数量超过单包上限，未生成不完整备份。');
  const files={},assets=[];let total=0;
  const recordBytes=strToU8(JSON.stringify(clean));
  files['records.json']=[recordBytes,{level:6}];total+=recordBytes.byteLength;
  for(let index=0;index<urls.length;index++){
    const sourceUrl=urls[index];onProgress({current:index,total:urls.length,message:'下载媒体 '+(index+1)+' / '+urls.length});
    try{
      const url=allowedMediaUrl(sourceUrl,{origin,mediaOrigins:clean.mediaOrigins});
      const response=await fetcher(url,{credentials:'omit',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(60000)});
      if(!response.ok)throw Error('下载失败（'+response.status+'）');
      const bytes=await readBounded(response),mime=mediaType(bytes,response.headers.get('content-type'));
      total+=bytes.byteLength;if(total>MAX_ARCHIVE_BYTES)throw Error('完整照片超过本次浏览器打包上限 256 MB');
      const path=`media/${String(index+1).padStart(5,'0')}.${extensions[mime]}`;
      files[path]=[bytes,{level:0}];assets.push({path,sourceUrl,bytes:bytes.byteLength,mime,sha256:await sha256(bytes)});
    }catch(error){throw Error('备份未完成：'+sourceUrl+'\n'+error.message+'。所有原始记录仍保留，请解决后重新下载。');}
  }
  const manifest={format:'family-space-media-backup',version:1,exportedAt:clean.exportedAt || new Date().toISOString(),records:{path:'records.json',bytes:recordBytes.byteLength,sha256:await sha256(recordBytes)},assets};
  files['manifest.json']=[strToU8(JSON.stringify(manifest,null,2)),{level:6}];
  onProgress({current:urls.length,total:urls.length,message:'正在生成带校验清单的 ZIP'});
  return {bytes:zipSync(files),manifest};
}
export async function inspectArchive(input) {
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
  if(bytes.byteLength>MAX_ARCHIVE_BYTES+4*1024*1024)throw Error('备份包超过 256 MB，请使用更小的备份包。');
  const names=new Set();let total=0;
  let files;
  try{files=unzipSync(bytes,{filter:entry=>{
    if(!/^(manifest\.json|records\.json|media\/\d{5}\.(jpg|png|webp|gif|heic))$/.test(entry.name) || names.has(entry.name))throw Error('备份包含重复或非法文件路径');
    names.add(entry.name);total+=entry.originalSize;
    if(names.size>MAX_FILES || total>MAX_ARCHIVE_BYTES || entry.originalSize>(entry.name==='records.json'?10*1024*1024:MAX_MEDIA_BYTES))throw Error('备份解压大小超出限制');
    return true;
  }});}catch(error){throw Error('无法读取此备份包：'+error.message);}
  if(!files['manifest.json'] || !files['records.json'])throw Error('备份缺少文件清单或家庭记录。');
  let manifest,backup;
  try{manifest=JSON.parse(strFromU8(files['manifest.json']));backup=JSON.parse(strFromU8(files['records.json']));}catch{throw Error('备份中的 JSON 记录损坏。');}
  if(manifest.format!=='family-space-media-backup' || manifest.version!==1 || !Array.isArray(manifest.assets) || !backup.main || ![3,4].includes(backup.version))throw Error('不支持的家庭备份版本。');
  const record=manifest.records;
  if(record?.path!=='records.json' || record.bytes!==files['records.json'].byteLength || record.sha256!==await sha256(files['records.json']))throw Error('家庭记录校验失败，未进行恢复。');
  const expected=new Set(['manifest.json','records.json']),sources=new Set();
  for(const asset of manifest.assets){
    if(!asset || typeof asset.sourceUrl!=='string' || expected.has(asset.path) || sources.has(asset.sourceUrl))throw Error('媒体清单有重复或非法记录。');
    expected.add(asset.path);sources.add(asset.sourceUrl);
    const data=files[asset.path];
    if(!data || data.byteLength!==asset.bytes || await sha256(data)!==asset.sha256)throw Error('媒体校验失败：'+asset.path);
    if(mediaType(data)!==asset.mime)throw Error('媒体类型与文件清单不符：'+asset.path);
  }
  if(Object.keys(files).some(path=>!expected.has(path)))throw Error('备份含未登记的文件。');
  const clean=sanitizeBackup(backup),required=collectMedia(clean);
  if(required.length!==sources.size || required.some(url=>!sources.has(url)))throw Error('备份没有包含所有引用照片，无法作为完整备份恢复。');
  return {backup:clean,manifest,files,bytes:total};
}
export function relinkMedia(backup, mapping) {
  const replace=value=>typeof value==='string'?(mapping.get(value)||value):Array.isArray(value)?value.map(replace):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,replace(v)])):value;
  return replace(backup);
}
