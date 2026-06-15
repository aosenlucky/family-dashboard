import ObsClient from 'esdk-obs-nodejs';

export default async function handler(req, res) {
  const PIN = process.env.SYSTEM_PASSWORD;
  if (req.headers.authorization !== PIN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 💡 修复：同时接收文件名和图片类型(ContentType)
  const { filename, contentType } = req.query;
  if (!filename) {
    return res.status(400).json({ error: 'Filename is required' });
  }

  try {
    const obsClient = new ObsClient({
      access_key_id: process.env.OBS_AK,
      secret_access_key: process.env.OBS_SK,
      server: process.env.OBS_ENDPOINT
    });

    const safeFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, '');
    const uniqueFilename = `${Date.now()}_${safeFilename}`;
    const objectKey = `photos/${uniqueFilename}`;

    // 💡 修复：将前端要上传的 Content-Type 加入到华为云的签名计算中！这步不加必报 403 失败
    const signParams = {
      Method: 'PUT',
      Bucket: process.env.OBS_BUCKET_NAME,
      Key: objectKey,
      Expires: 3600
    };
    if (contentType) {
      signParams.Headers = { 'Content-Type': contentType };
    }

    const result = obsClient.createSignedUrlSync(signParams);

    // 💡 修复：改回正确的 SDK 属性直读方式
    const uploadUrl = result.SignedUrl;

    if (!uploadUrl) {
      throw new Error('签名生成失败，请检查 AK/SK 配置');
    }

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