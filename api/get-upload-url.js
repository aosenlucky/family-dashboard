import ObsClient from 'esdk-obs-nodejs';

export default async function handler(req, res) {
  // 1. 安全校验：只允许带有密码的请求
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
    const obsClient = new ObsClient({
      access_key_id: process.env.OBS_AK,
      secret_access_key: process.env.OBS_SK,
      server: process.env.OBS_ENDPOINT
    });

    // 3. 生成唯一的文件名，防止同名覆盖
    const uniqueFilename = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9.]/g, '')}`;
    const objectKey = `photos/${uniqueFilename}`;

    // 4. 生成带签名的直传 URL (有效时间 3600 秒)
    const result = obsClient.createSignedUrlSync({
      Method: 'PUT',
      Bucket: process.env.OBS_BUCKET_NAME,
      Key: objectKey,
      Expires: 3600
    });

    // 5. 返回给前端
    return res.status(200).json({
      uploadUrl: result.SignedUrl,
      objectKey: objectKey,
      finalUrl: `${process.env.OBS_ENDPOINT.replace('https://', `https://${process.env.OBS_BUCKET_NAME}.`)}/${objectKey}`
    });

  } catch (error) {
    console.error("生成上传链接失败:", error);
    return res.status(500).json({ error: 'Failed to generate upload URL' });
  }
}