// Vercel Serverless Function: 充当安全中转站，保护密钥不被前端泄露
export default async function handler(req, res) {
  const { method, headers, body } = req;
  
  // 从 Vercel 环境变量中读取机密信息（绝对安全，外部不可见）
  const PIN = process.env.SYSTEM_PASSWORD;
  const API_KEY = process.env.JSONBIN_API_KEY;
  const BIN_ID = process.env.JSONBIN_BIN_ID;

  // 1. 安全拦截：校验前端传来的密码
  const authHeader = headers.authorization || '';
  if (authHeader !== PIN) {
    return res.status(401).json({ error: '密码错误或未授权的访问' });
  }

  // 2. 授权通过，如果是拉取数据 (GET)
  if (method === 'GET') {
    try {
      const response = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
        headers: { 'X-Master-Key': API_KEY }
      });
      const data = await response.json();
      return res.status(200).json(data.record || {});
    } catch (error) {
      return res.status(500).json({ error: '读取云端数据失败' });
    }
  }

  // 3. 授权通过，如果是保存数据 (POST)
  if (method === 'POST') {
    try {
      const response = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': API_KEY
        },
        body: JSON.stringify(body) // 直接透传前端发来的数据
      });
      const data = await response.json();
      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: '保存云端数据失败' });
    }
  }

  // 4. 非法请求方式拦截
  return res.status(405).json({ error: 'Method Not Allowed' });
}
