import {requireFamily,fail} from './_family-security.js';
import {readMainRecord} from './_data-store.js';
export default async function handler(req,res) {
 res.setHeader('Cache-Control','private, no-store');
 try{
  requireFamily(req);
  if(req.method!=='POST')fail(405,'请使用整理按钮提交。');
  if(process.env.PERSONAL_PREVIEW_DIR)fail(503,'本机预览保留读书整理入口，不调用外部模型。');
  const prompt=req.body?.prompt;
  if(typeof prompt!=='string'||!prompt.trim()||prompt.length>25000)fail(400,'请填写有效的读书笔记。');
  const record=await readMainRecord();
  const key=typeof req.body.apiKey==='string'&&req.body.apiKey.trim()?req.body.apiKey.trim():process.env.DEEPSEEK_API_KEY||record.llmApiKey;
  if(!key)fail(503,'请在服务器配置读书整理密钥，或输入仅供本次使用的密钥。');
  const upstream=await fetch('https://api.deepseek.com/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify({model:'deepseek-v4-pro',messages:[{role:'system',content:'你是一个严谨的读书编辑，只返回可被 JSON.parse 解析的 JSON 对象。'},{role:'user',content:prompt}],temperature:.45,reasoning_effort:'high',thinking:{type:'enabled'},response_format:{type:'json_object'}}),signal:AbortSignal.timeout(120000)});
  if(!upstream.ok)fail(502,'读书整理服务暂时不可用，请稍后重试。');
  const body=await upstream.json();return res.status(200).json({choices:body.choices});
 }catch(e){return res.status(e.status||500).json({error:e.status?e.message:'整理失败，原笔记未改动。'});}
}
