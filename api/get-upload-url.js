import ObsClient from 'esdk-obs-nodejs';

export default async function handler(req, res) {
  // 1. 安全校验：验证请求是否携带了正确的家庭空间密码
  const PIN = process.env.SYSTEM_PASSWORD;
  if (req.headers.authorization !== PIN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { filename } = req.query;
  if (!filename) {
    return res.status(400).json({ error: 'Filename is required' });
  }

  try {
    // 2. 初始化华为云客户端
    // OBS_ENDPOINT 格式应为：https://obs.cn-east-3.myhuaweicloud.com (不要带桶名和结尾的斜杠)
    const obsClient = new ObsClient({
      access_key_id: process.env.OBS_AK,
      secret_access_key: process.env.OBS_SK,
      server: process.env.OBS_ENDPOINT
    });

    // 3. 生成安全的唯一文件名，防止中文字符乱码或同名覆盖
    const safeFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, '');
    const uniqueFilename = `${Date.now()}_${safeFilename}`;
    const objectKey = `photos/${uniqueFilename}`;

    // 4. 生成带签名的直传 URL
    const result = obsClient.createSignedUrlSync({
      Method: 'PUT',
      Bucket: process.env.OBS_BUCKET_NAME,
      Key: objectKey,
      Expires: 3600
    });

    // 💡 核心修复：正确解析华为云深层嵌套的返回结果
    if (result.CommonMsg && result.CommonMsg.Status >= 300) {
      console.error("【OBS 签名拒绝】:", result.CommonMsg);
      return res.status(500).json({ error: 'OBS signature refused', details: result.CommonMsg });
    }

    // 拿到真正的直传 URL
    const uploadUrl = result.InterfaceResult.SignedUrl;

    // 5. 拼装最终在画廊中显示的公网图片访问地址
    const endpointWithoutProtocol = process.env.OBS_ENDPOINT.replace('https://', '').replace('http://', '');
    const finalUrl = `https://${process.env.OBS_BUCKET_NAME}.${endpointWithoutProtocol}/${objectKey}`;

    return res.status(200).json({
      uploadUrl: uploadUrl,
      objectKey: objectKey,
      finalUrl: finalUrl
    });

  } catch (error) {
    console.error("【后端处理异常】:", error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}