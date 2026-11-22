import {randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,extname} from 'node:path';
import {requireFamily} from '../api/_family-security.js';
const tickets=new Map();
const types={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif','.heic':'image/heic','.heif':'image/heif'};
export function personalPreviewPlugin(){return {name:'personal-preview-media',configureServer(server){
 if(!process.env.PERSONAL_PREVIEW_DIR)return;
 const directory=join(process.env.PERSONAL_PREVIEW_DIR,'media');
 server.middlewares.use(async(req,res,next)=>{
  const url=new URL(req.url,'http://127.0.0.1:5199');
  if(!url.pathname.startsWith('/__preview/media/')&&url.pathname!=='/api/get-upload-url')return next();
  const json=(status,body)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));};
  try{
   if(url.pathname==='/api/get-upload-url'){
    requireFamily(req);if(req.method!=='GET')return json(405,{error:'Method Not Allowed'});
    const type=url.searchParams.get('contentType'),extension=Object.keys(types).find(e=>types[e]===type);
    if(!extension)return json(400,{error:'请选择支持的照片格式。'});
    const filename=randomUUID()+extension,token=randomUUID();tickets.set(token,{filename,type,expires:Date.now()+600000});
    return json(200,{uploadUrl:`/__preview/media/${filename}?ticket=${token}`,finalUrl:`/__preview/media/${filename}`});
   }
   const name=decodeURIComponent(url.pathname.split('/').pop());
   if(!/^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|gif|heic|heif)$/.test(name))return json(400,{error:'无效媒体路径。'});
   const file=join(directory,name);
   if(req.method==='PUT'){
    const token=url.searchParams.get('ticket'),ticket=tickets.get(token);
    if(!ticket||ticket.filename!==name||ticket.expires<Date.now())return json(403,{error:'上传凭据已过期。'});
    let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>40*1024*1024)return json(413,{error:'照片过大。'});chunks.push(chunk);}
    await mkdir(directory,{recursive:true});await writeFile(file,Buffer.concat(chunks));tickets.delete(token);res.statusCode=200;res.end();return;
   }
   if(req.method!=='GET'&&req.method!=='HEAD')return json(405,{error:'Method Not Allowed'});
   const bytes=await readFile(file);res.setHeader('Content-Type',types[extname(name)]);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','private, max-age=300');res.end(req.method==='HEAD'?undefined:bytes);
  }catch(e){json(e.code==='ENOENT'?404:e.status||500,{error:e.status?e.message:'预览媒体暂不可用。'});}
 });
}};}
