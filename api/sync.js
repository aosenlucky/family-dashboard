export default async function handler(req, res) {
  const { method, headers, body } = req;
  
  const PIN = process.env.SYSTEM_PASSWORD;
  const API_KEY = process.env.JSONBIN_API_KEY;
  const BIN_ID = process.env.JSONBIN_BIN_ID;
  // 兼容你可能填在旧变量里，或者新建的变量
  const PUSH_TOKENS = process.env.SERVERCHAN_KEY || process.env.PUSHPLUS_TOKEN; 

  const authHeader = headers.authorization || '';
  if (authHeader !== PIN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (method === 'GET') {
    try {
      const response = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, { 
        headers: { 'X-Master-Key': API_KEY } 
      });
      const data = await response.json();
      return res.status(200).json(data.record || {});
    } catch (error) {
      return res.status(500).json({ error: 'Failed to read JSONBin' });
    }
  }

  if (method === 'POST') {
    try {
      // 💡 微信群发专项处理模块
      if (body && body.action === 'notify') {
        console.log("【Vercel后端】接收到前端推送指令，标题:", body.title);
        
        if (PUSH_TOKENS) {
          const tokens = PUSH_TOKENS.split(',').map(t => t.trim()).filter(Boolean);
          console.log(`【Vercel后端】准备发送给 ${tokens.length} 个用户`);
          
          await Promise.all(tokens.map(async (token) => {
              // 智能识别：如果是 Server酱 (SCT开头)
              if (token.startsWith('SCT')) {
                  // Server酱不支持复杂HTML，将其清洗为纯文本/Markdown
                  const cleanText = body.content.replace(/<br>/g, '\n\n').replace(/<[^>]+>/g, '');
                  return fetch(`https://sctapi.ftqq.com/${token}.send`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ title: body.title, desp: cleanText })
                  }).catch(err => console.error("【Server酱请求错误】:", err));
              } 
              // 兜底保留：如果还是之前的 PushPlus Token
              else {
                  return fetch('https://www.pushplus.plus/send', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                          token: token, title: body.title, content: body.content, template: 'html'
                      })
                  }).catch(err => console.error("【PushPlus请求错误】:", err));
              }
          }));
        } else {
          console.log("【Vercel后端】未检测到推送 Token 环境变量");
        }
        return res.status(200).json({ success: true, message: "推送指令已执行" });
      }

      // 常规的保存 JSONBin 数据逻辑
      const response = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Master-Key': API_KEY },
        body: JSON.stringify(body) 
      });
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("【Vercel后端】系统处理异常:", error);
      return res.status(500).json({ error: 'Failed to process request' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
