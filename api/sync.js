export default async function handler(req, res) {
  const { method, headers, body } = req;
  
  // 从 Vercel 环境变量中读取配置
  const PIN = process.env.SYSTEM_PASSWORD;
  const API_KEY = process.env.JSONBIN_API_KEY;
  const BIN_ID = process.env.JSONBIN_BIN_ID;
  const PUSHPLUS_TOKENS = process.env.PUSHPLUS_TOKEN; // 支持多个Token，用英文逗号隔开

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
      return res.status(500).json({ error: 'Failed to read' });
    }
  }

  if (method === 'POST') {
    try {
      // 💡 拦截前台发来的“推送通知”请求，并执行微信群发
      if (body && body.action === 'notify') {
        if (PUSHPLUS_TOKENS) {
          // 将逗号隔开的 token 拆分成数组，去除多余空格和空值
          const tokens = PUSHPLUS_TOKENS.split(',').map(t => t.trim()).filter(Boolean);
          
          // 并发向所有用户发送微信推送
          await Promise.all(tokens.map(token => 
            fetch('http://www.pushplus.plus/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token: token,
                title: body.title,
                content: body.content,
                template: 'html'
              })
            })
          ));
        }
        return res.status(200).json({ success: true });
      }

      // 常规的保存 JSONBin 数据逻辑
      const response = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Master-Key': API_KEY },
        body: JSON.stringify(body) 
      });
      const data = await response.json();
      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to save' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
