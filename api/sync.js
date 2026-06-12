export default async function handler(req, res) {
  const { method, headers, body } = req;
  
  const PIN = process.env.SYSTEM_PASSWORD;
  const API_KEY = process.env.JSONBIN_API_KEY;
  const BIN_ID = process.env.JSONBIN_BIN_ID;
  const PUSHPLUS_TOKEN = process.env.PUSHPLUS_TOKEN; // 新增的推送 Token

  const authHeader = headers.authorization || '';
  if (authHeader !== PIN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (method === 'GET') {
    try {
      const response = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, { headers: { 'X-Master-Key': API_KEY } });
      const data = await response.json();
      return res.status(200).json(data.record || {});
    } catch (error) {
      return res.status(500).json({ error: 'Failed to read' });
    }
  }

  if (method === 'POST') {
    try {
      // 💡 新增：拦截前台发来的“推送通知”请求
      if (body && body.action === 'notify') {
        if (PUSHPLUS_TOKEN) {
          await fetch('http://www.pushplus.plus/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token: PUSHPLUS_TOKEN,
              title: body.title,
              content: body.content,
              template: 'html'
            })
          });
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
